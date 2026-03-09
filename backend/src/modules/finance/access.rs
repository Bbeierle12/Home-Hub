use std::sync::Arc;

use chrono::Utc;
use uuid::Uuid;

use crate::{
    auth::middleware::{require_admin, require_household_access, CurrentUser, MembershipRecord},
    error::ApiError,
    types::HouseholdRole,
    AppState,
};

use super::models::{FinanceSettingsRecord, MemberFinanceAccess};

pub async fn get_settings(
    state: &Arc<AppState>,
    household_id: Uuid,
) -> Result<FinanceSettingsRecord, ApiError> {
    let settings = sqlx::query_as::<_, FinanceSettingsRecord>(
        r#"
        SELECT household_id, member_access, income_enabled, sensitive_reauth_ttl_minutes, updated_at
        FROM household_finance_settings
        WHERE household_id = $1
        "#,
    )
    .bind(household_id)
    .fetch_optional(&state.db)
    .await?;

    Ok(settings.unwrap_or(FinanceSettingsRecord {
        household_id,
        member_access: MemberFinanceAccess::None.as_str().to_owned(),
        income_enabled: false,
        sensitive_reauth_ttl_minutes: 10,
        updated_at: Utc::now(),
    }))
}

pub async fn require_finance_read(
    state: &Arc<AppState>,
    current_user: &CurrentUser,
    household_id: Uuid,
) -> Result<(MembershipRecord, FinanceSettingsRecord), ApiError> {
    let membership = require_household_access(state, current_user, household_id).await?;
    let settings = get_settings(state, household_id).await?;
    let role = HouseholdRole::try_from(membership.role.as_str())
        .map_err(|_| ApiError::forbidden("Unsupported household role for finance access"))?;

    match role {
        HouseholdRole::Admin => Ok((membership, settings)),
        HouseholdRole::Member => match MemberFinanceAccess::try_from(settings.member_access.as_str())
            .map_err(|_| ApiError::forbidden("Unsupported finance access policy"))?
        {
            MemberFinanceAccess::ReadOnly | MemberFinanceAccess::Full => Ok((membership, settings)),
            MemberFinanceAccess::None => Err(ApiError::forbidden(
                "Finance access is disabled for members in this household",
            )),
        },
        HouseholdRole::Child | HouseholdRole::Guest => Err(ApiError::forbidden(
            "Finance data is not visible for this household role",
        )),
    }
}

pub async fn require_finance_write(
    state: &Arc<AppState>,
    current_user: &CurrentUser,
    household_id: Uuid,
) -> Result<(MembershipRecord, FinanceSettingsRecord), ApiError> {
    let membership = require_household_access(state, current_user, household_id).await?;
    let settings = get_settings(state, household_id).await?;
    let role = HouseholdRole::try_from(membership.role.as_str())
        .map_err(|_| ApiError::forbidden("Unsupported household role for finance access"))?;

    match role {
        HouseholdRole::Admin => Ok((membership, settings)),
        HouseholdRole::Member => match MemberFinanceAccess::try_from(settings.member_access.as_str())
            .map_err(|_| ApiError::forbidden("Unsupported finance access policy"))?
        {
            MemberFinanceAccess::Full => Ok((membership, settings)),
            MemberFinanceAccess::ReadOnly | MemberFinanceAccess::None => Err(ApiError::forbidden(
                "Finance write access is disabled for members in this household",
            )),
        },
        HouseholdRole::Child | HouseholdRole::Guest => Err(ApiError::forbidden(
            "Finance writes are not allowed for this household role",
        )),
    }
}

pub async fn require_finance_admin(
    state: &Arc<AppState>,
    current_user: &CurrentUser,
    household_id: Uuid,
) -> Result<(MembershipRecord, FinanceSettingsRecord), ApiError> {
    let membership = require_admin(state, current_user, household_id).await?;
    let settings = get_settings(state, household_id).await?;
    Ok((membership, settings))
}
