//! Compatibility helpers for running Home-Hub against different database backends.
//!
//! These thin wrappers centralise UUID / timestamp generation so that every
//! INSERT supplies its own values instead of relying on PostgreSQL `DEFAULT`
//! expressions (`gen_random_uuid()`, `NOW()`).

use chrono::{DateTime, Duration, NaiveDate, Utc};
use uuid::Uuid;

/// Generate a new random UUID for use as a primary key.
pub fn new_id() -> Uuid {
    Uuid::new_v4()
}

/// Current UTC timestamp, suitable for binding to TIMESTAMPTZ columns.
pub fn now_utc() -> DateTime<Utc> {
    Utc::now()
}

/// Current UTC date, suitable for binding to DATE columns.
pub fn now_date() -> NaiveDate {
    Utc::now().date_naive()
}

/// Invite expiry: 7 days from now.
pub fn invite_expires_at() -> DateTime<Utc> {
    Utc::now() + Duration::days(7)
}
