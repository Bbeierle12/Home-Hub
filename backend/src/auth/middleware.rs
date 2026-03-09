use std::sync::Arc;

use axum::{
    extract::{FromRef, FromRequestParts},
    http::{request::Parts, header},
};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    auth::jwt::{self, TokenKind},
    error::ApiError,
    types::HouseholdRole,
    AppState,
};

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct CurrentUser {
    pub user_id: Uuid,
    pub household_id: Option<Uuid>,
    pub role: Option<HouseholdRole>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct MembershipRecord {
    pub user_id: Uuid,
    pub household_id: Uuid,
    pub role: String,
}

impl<S> FromRequestParts<S> for CurrentUser
where
    Arc<AppState>: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ApiError;

    fn from_request_parts(
        parts: &mut Parts,
        state: &S,
    ) -> impl std::future::Future<Output = Result<Self, Self::Rejection>> + Send {
        let state = Arc::<AppState>::from_ref(state);
        let output = (|| {
            let authorization = parts
                .headers
                .get(header::AUTHORIZATION)
                .and_then(|value| value.to_str().ok())
                .ok_or_else(|| ApiError::unauthorized("Missing Authorization header"))?;

            let token = authorization.strip_prefix("Bearer ").ok_or_else(|| {
                ApiError::unauthorized("Authorization header must use Bearer tokens")
            })?;

            let claims = jwt::decode_token(token, &state.config.jwt_secret)?;
            if claims.token_kind != TokenKind::Access {
                return Err(ApiError::unauthorized(
                    "This endpoint requires an access token",
                ));
            }

            Ok(Self {
                user_id: claims.sub,
                household_id: claims.household_id,
                role: claims.role,
            })
        })();

        std::future::ready(output)
    }
}

pub async fn require_household_access(
    state: &Arc<AppState>,
    current_user: &CurrentUser,
    household_id: Uuid,
) -> Result<MembershipRecord, ApiError> {
    let membership = sqlx::query_as::<_, MembershipRecord>(
        r#"
        SELECT user_id, household_id, role
        FROM household_members
        WHERE household_id = $1 AND user_id = $2
        "#,
    )
    .bind(household_id)
    .bind(current_user.user_id)
    .fetch_optional(&state.db)
    .await?;

    membership.ok_or_else(|| ApiError::forbidden("User is not a member of this household"))
}

pub async fn require_admin(
    state: &Arc<AppState>,
    current_user: &CurrentUser,
    household_id: Uuid,
) -> Result<MembershipRecord, ApiError> {
    let membership = require_household_access(state, current_user, household_id).await?;
    if membership.role != "admin" {
        return Err(ApiError::forbidden(
            "This route requires the household admin role",
        ));
    }

    Ok(membership)
}

pub async fn require_shared_write(
    state: &Arc<AppState>,
    current_user: &CurrentUser,
    household_id: Uuid,
) -> Result<MembershipRecord, ApiError> {
    let membership = require_household_access(state, current_user, household_id).await?;
    if !matches!(membership.role.as_str(), "admin" | "member") {
        return Err(ApiError::forbidden(
            "This route requires admin or member permissions",
        ));
    }

    Ok(membership)
}
