use std::sync::Arc;

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::State,
    routing::post,
    Json, Router,
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    auth::{
        jwt::TokenKind,
        middleware::CurrentUser,
    },
    error::ApiError,
    types::{HouseholdRole, TokenBundle},
    AppState,
};

pub mod jwt;
pub mod middleware;
pub mod totp;

const REFRESH_COOKIE_NAME: &str = "refresh_token";

#[derive(Debug, Deserialize)]
struct RegisterRequest {
    email: String,
    password: String,
    display_name: String,
}

#[derive(Debug, Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct TwoFactorChallengeRequest {
    temp_token: String,
    code: String,
}

#[derive(Debug, Deserialize)]
struct VerifySetupRequest {
    code: String,
}

#[derive(Debug, Deserialize)]
struct BackupCodeRecoveryRequest {
    email: String,
    password: String,
    backup_code: String,
}

#[derive(Debug, Serialize)]
struct AuthenticatedUser {
    id: Uuid,
    email: String,
    display_name: String,
    household_id: Option<Uuid>,
    role: Option<HouseholdRole>,
    totp_enabled: bool,
}

#[derive(Debug, Serialize)]
struct AuthResponse {
    user: AuthenticatedUser,
    tokens: TokenBundle,
}

#[derive(Debug, Serialize)]
struct LoginChallengeResponse {
    status: &'static str,
    temp_token: String,
}

#[derive(Debug, Serialize, FromRow)]
struct UserRecord {
    id: Uuid,
    email: String,
    password_hash: String,
    display_name: String,
    totp_secret: Option<String>,
    totp_enabled: bool,
}

#[derive(Debug, FromRow)]
struct MembershipSummary {
    household_id: Uuid,
    role: String,
}

#[derive(Debug, FromRow)]
struct BackupCodeRecord {
    id: Uuid,
    code_hash: String,
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/refresh", post(refresh))
        .route("/logout", post(logout))
        .route("/2fa/setup", post(two_factor_setup))
        .route("/2fa/verify-setup", post(two_factor_verify_setup))
        .route("/2fa/challenge", post(two_factor_challenge))
        .route("/2fa/disable", post(two_factor_disable))
        .route("/2fa/recover", post(two_factor_recover))
        .route(
            "/2fa/backup-codes/regenerate",
            post(two_factor_regenerate_backup_codes),
        )
}

async fn register(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RegisterRequest>,
) -> Result<Json<AuthenticatedUser>, ApiError> {
    if request.password.len() < 12 {
        return Err(ApiError::bad_request(
            "Password must be at least 12 characters for this scaffold",
        ));
    }

    let password_hash = hash_password(&request.password)?;
    let user_id = Uuid::new_v4();

    let insert = sqlx::query(
        r#"
        INSERT INTO users (id, email, password_hash, display_name)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(user_id)
    .bind(request.email.trim().to_lowercase())
    .bind(password_hash)
    .bind(request.display_name.trim())
    .execute(&state.db)
    .await;

    if let Err(error) = insert {
        if let sqlx::Error::Database(database_error) = &error {
            if database_error.is_unique_violation() {
                return Err(ApiError::conflict("Email address is already registered"));
            }
        }

        return Err(ApiError::from(error));
    }

    Ok(Json(AuthenticatedUser {
        id: user_id,
        email: request.email.trim().to_lowercase(),
        display_name: request.display_name.trim().to_owned(),
        household_id: None,
        role: None,
        totp_enabled: false,
    }))
}

async fn login(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    Json(request): Json<LoginRequest>,
) -> Result<(CookieJar, Json<serde_json::Value>), ApiError> {
    let user = find_user_by_email(&state, &request.email).await?;
    verify_password(&user.password_hash, &request.password)?;

    let membership = fetch_primary_membership(&state, user.id).await?;
    let role = membership
        .as_ref()
        .and_then(|membership| HouseholdRole::try_from(membership.role.as_str()).ok());
    let household_id = membership.as_ref().map(|membership| membership.household_id);

    if user.totp_enabled && matches!(role, Some(HouseholdRole::Admin | HouseholdRole::Member)) {
        let temp_token = jwt::encode_two_factor_token(&state.config, user.id, household_id, role)?;
        return Ok((
            jar,
            Json(serde_json::json!(LoginChallengeResponse {
                status: "2fa_required",
                temp_token,
            })),
        ));
    }

    let (jar, response) =
        issue_tokens(&state, jar, &user, household_id, role).await?;
    Ok((jar, Json(serde_json::json!(response))))
}

async fn refresh(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
) -> Result<(CookieJar, Json<AuthResponse>), ApiError> {
    let refresh_cookie = jar
        .get(REFRESH_COOKIE_NAME)
        .ok_or_else(|| ApiError::unauthorized("Missing refresh token cookie"))?;

    let claims = jwt::decode_token(refresh_cookie.value(), &state.config.jwt_secret)?;
    if claims.token_kind != TokenKind::Refresh {
        return Err(ApiError::unauthorized("Refresh token is invalid for this route"));
    }

    let session_id = claims
        .jti
        .clone()
        .ok_or_else(|| ApiError::unauthorized("Refresh token is missing a session id"))?;

    let mut redis = state.redis.get_multiplexed_async_connection().await?;
    let cache_key = format!("refresh:{session_id}");
    let session_exists: bool = redis.exists(&cache_key).await?;
    if !session_exists {
        return Err(ApiError::unauthorized("Refresh token has expired or was revoked"));
    }

    redis.del::<_, ()>(&cache_key).await?;

    let user = find_user_by_id(&state, claims.sub).await?;
    let role = claims.role;
    let (jar, response) = issue_tokens(&state, jar, &user, claims.household_id, role).await?;
    Ok((jar, Json(response)))
}

async fn logout(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
) -> Result<(CookieJar, Json<serde_json::Value>), ApiError> {
    if let Some(cookie) = jar.get(REFRESH_COOKIE_NAME) {
        if let Ok(claims) = jwt::decode_token(cookie.value(), &state.config.jwt_secret) {
            if let Some(session_id) = claims.jti {
                let mut redis = state.redis.get_multiplexed_async_connection().await?;
                let cache_key = format!("refresh:{session_id}");
                redis.del::<_, ()>(cache_key).await?;
            }
        }
    }

    let jar = jar.remove(Cookie::from(REFRESH_COOKIE_NAME));
    Ok((jar, Json(serde_json::json!({ "logged_out": true }))))
}

async fn two_factor_setup(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user = find_user_by_id(&state, current_user.user_id).await?;
    let secret = totp::generate_secret();
    let provisioning_uri = totp::provisioning_uri(&state.config, &user.email, &secret)?;

    let mut redis = state.redis.get_multiplexed_async_connection().await?;
    let cache_key = format!("2fa:setup:{}", current_user.user_id);
    redis.set_ex::<_, _, ()>(cache_key, secret.clone(), 600).await?;

    Ok(Json(serde_json::json!({
        "secret": secret,
        "otpauth_url": provisioning_uri
    })))
}

async fn two_factor_verify_setup(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
    Json(request): Json<VerifySetupRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let mut redis = state.redis.get_multiplexed_async_connection().await?;
    let cache_key = format!("2fa:setup:{}", current_user.user_id);
    let secret: Option<String> = redis.get(&cache_key).await?;
    let secret = secret.ok_or_else(|| {
        ApiError::bad_request("No pending 2FA enrollment was found for this user")
    })?;

    if !totp::verify_code(&secret, &request.code)? {
        return Err(ApiError::bad_request("The supplied TOTP code is invalid"));
    }

    sqlx::query(
        r#"
        UPDATE users
        SET totp_secret = $2, totp_enabled = TRUE, updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(current_user.user_id)
    .bind(secret)
    .execute(&state.db)
    .await?;

    redis.del::<_, ()>(cache_key).await?;
    let backup_codes = regenerate_backup_codes(&state, current_user.user_id).await?;

    Ok(Json(serde_json::json!({
        "enabled": true,
        "backup_codes": backup_codes
    })))
}

async fn two_factor_challenge(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    Json(request): Json<TwoFactorChallengeRequest>,
) -> Result<(CookieJar, Json<AuthResponse>), ApiError> {
    let claims = jwt::decode_token(&request.temp_token, &state.config.jwt_secret)?;
    if claims.token_kind != TokenKind::TwoFactorPending {
        return Err(ApiError::unauthorized("Temporary 2FA token is invalid"));
    }

    let user = find_user_by_id(&state, claims.sub).await?;
    let secret = user
        .totp_secret
        .as_deref()
        .ok_or_else(|| ApiError::bad_request("User does not have TOTP configured"))?;

    if !totp::verify_code(secret, &request.code)? {
        return Err(ApiError::unauthorized("Incorrect TOTP code"));
    }

    let (jar, response) = issue_tokens(&state, jar, &user, claims.household_id, claims.role).await?;
    Ok((jar, Json(response)))
}

async fn two_factor_disable(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
) -> Result<Json<serde_json::Value>, ApiError> {
    sqlx::query(
        r#"
        UPDATE users
        SET totp_enabled = FALSE, totp_secret = NULL, updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(current_user.user_id)
    .execute(&state.db)
    .await?;

    sqlx::query("DELETE FROM totp_backup_codes WHERE user_id = $1")
        .bind(current_user.user_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "disabled": true })))
}

async fn two_factor_recover(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    Json(request): Json<BackupCodeRecoveryRequest>,
) -> Result<(CookieJar, Json<AuthResponse>), ApiError> {
    let user = find_user_by_email(&state, &request.email).await?;
    verify_password(&user.password_hash, &request.password)?;

    let backup_codes = sqlx::query_as::<_, BackupCodeRecord>(
        r#"
        SELECT id, code_hash
        FROM totp_backup_codes
        WHERE user_id = $1 AND used_at IS NULL
        "#,
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;

    let matching_code = backup_codes
        .into_iter()
        .find(|backup_code| verify_password(&backup_code.code_hash, &request.backup_code).is_ok())
        .ok_or_else(|| ApiError::unauthorized("Backup code is invalid"))?;

    sqlx::query("UPDATE totp_backup_codes SET used_at = NOW() WHERE id = $1")
        .bind(matching_code.id)
        .execute(&state.db)
        .await?;

    let membership = fetch_primary_membership(&state, user.id).await?;
    let household_id = membership.as_ref().map(|membership| membership.household_id);
    let role = membership
        .as_ref()
        .and_then(|membership| HouseholdRole::try_from(membership.role.as_str()).ok());

    let (jar, response) = issue_tokens(&state, jar, &user, household_id, role).await?;
    Ok((jar, Json(response)))
}

async fn two_factor_regenerate_backup_codes(
    State(state): State<Arc<AppState>>,
    current_user: CurrentUser,
) -> Result<Json<serde_json::Value>, ApiError> {
    let backup_codes = regenerate_backup_codes(&state, current_user.user_id).await?;
    Ok(Json(serde_json::json!({ "backup_codes": backup_codes })))
}

async fn find_user_by_email(state: &Arc<AppState>, email: &str) -> Result<UserRecord, ApiError> {
    sqlx::query_as::<_, UserRecord>(
        r#"
        SELECT id, email, password_hash, display_name, totp_secret, totp_enabled
        FROM users
        WHERE email = $1
        "#,
    )
    .bind(email.trim().to_lowercase())
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::unauthorized("Invalid email or password"))
}

async fn find_user_by_id(state: &Arc<AppState>, user_id: Uuid) -> Result<UserRecord, ApiError> {
    sqlx::query_as::<_, UserRecord>(
        r#"
        SELECT id, email, password_hash, display_name, totp_secret, totp_enabled
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::not_found("User not found"))
}

async fn fetch_primary_membership(
    state: &Arc<AppState>,
    user_id: Uuid,
) -> Result<Option<MembershipSummary>, ApiError> {
    sqlx::query_as::<_, MembershipSummary>(
        r#"
        SELECT household_id, role
        FROM household_members
        WHERE user_id = $1
        ORDER BY joined_at ASC
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(ApiError::from)
}

async fn issue_tokens(
    state: &Arc<AppState>,
    jar: CookieJar,
    user: &UserRecord,
    household_id: Option<Uuid>,
    role: Option<HouseholdRole>,
) -> Result<(CookieJar, AuthResponse), ApiError> {
    let access_token = jwt::encode_access_token(&state.config, user.id, household_id, role)?;
    let session_id = Uuid::new_v4().to_string();
    let refresh_token =
        jwt::encode_refresh_token(&state.config, user.id, household_id, role, session_id.clone())?;

    let mut redis = state.redis.get_multiplexed_async_connection().await?;
    let cache_key = format!("refresh:{session_id}");
    redis
        .set_ex::<_, _, ()>(
            cache_key,
            user.id.to_string(),
            state.config.jwt_refresh_expiry_seconds as u64,
        )
        .await?;

    let cookie = Cookie::build((REFRESH_COOKIE_NAME, refresh_token.clone()))
        .http_only(true)
        .same_site(SameSite::Lax)
        .path("/")
        .build();

    let jar = jar.add(cookie);

    Ok((
        jar,
        AuthResponse {
            user: AuthenticatedUser {
                id: user.id,
                email: user.email.clone(),
                display_name: user.display_name.clone(),
                household_id,
                role,
                totp_enabled: user.totp_enabled,
            },
            tokens: TokenBundle {
                access_token,
                refresh_token,
                expires_in_seconds: state.config.jwt_access_expiry_seconds,
            },
        },
    ))
}

fn hash_password(password: &str) -> Result<String, ApiError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|value| value.to_string())
        .map_err(|error| ApiError::internal(format!("Password hashing failed: {error}")))
}

fn verify_password(hash: &str, password: &str) -> Result<(), ApiError> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|error| ApiError::internal(format!("Stored password hash is invalid: {error}")))?;

    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| ApiError::unauthorized("Invalid email or password"))
}

async fn regenerate_backup_codes(
    state: &Arc<AppState>,
    user_id: Uuid,
) -> Result<Vec<String>, ApiError> {
    sqlx::query("DELETE FROM totp_backup_codes WHERE user_id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await?;

    let mut plaintext_codes = Vec::with_capacity(8);
    for _ in 0..8 {
        let code = format!("{}-{}", random_digits(4), random_digits(4));
        let code_hash = hash_password(&code)?;
        sqlx::query(
            r#"
            INSERT INTO totp_backup_codes (id, user_id, code_hash)
            VALUES ($1, $2, $3)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(code_hash)
        .execute(&state.db)
        .await?;
        plaintext_codes.push(code);
    }

    Ok(plaintext_codes)
}

fn random_digits(len: usize) -> String {
    let value = Uuid::new_v4().simple().to_string();
    value.chars().filter(|c| c.is_ascii_digit()).take(len).collect()
}
