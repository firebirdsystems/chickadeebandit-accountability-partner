-- Accountability Partner — two people supporting each other's goals.
--
-- Confidentiality / integrity is enforced server-side by row_policies:
--   * partner_config is owner_only + endpoint_writes_only: a member reads only
--     their OWN pairing row and can never write it via /api/db — the trusted
--     partner_link endpoint (/api/partner) is the only writer, and it mints the
--     shared reciprocal session_id once both partners point at each other.
--   * commitments and checkins are couple_scoped (require_reciprocal): a member
--     and their reciprocal partner both read them, INSERT forces member_id to the
--     caller (so you can only log your OWN check-ins / create your OWN goals), and
--     delete_owner_only keeps each person's rows deletable only by their author.
--     checkins additionally uses unique_per_member so there is at most one
--     check-in per commitment per calendar day.
--   * messages is couple_scoped + endpoint_writes_only: written only by the
--     trusted paired_messages endpoint (/api/paired-message), which stamps the
--     sender, timestamp, and read receipts. content is immutable once sent.
--   * profiles is owner_only (adults_bypass:false): each member owns the arming
--     switch for their own missed-check-in alert. The inactivity_alerts cron
--     reads it (bypassing policies) and emails the recipients when overdue.
--
-- Encryption at rest: free-text columns (title, detail, note, content, message)
-- are NOT on the skip-list, so they are encrypted at rest. We never filter/sort
-- on them in SQL. Columns we DO filter/sort on are plaintext by suffix
-- (_id / _at / _date), by the skip-list (status), or by db_plaintext_columns
-- (active, interval_hours).

-- One pairing row per member, written only by the partner_link endpoint.
CREATE TABLE IF NOT EXISTS app_accountability_partner__partner_config (
  member_id  TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  session_id TEXT,
  PRIMARY KEY (member_id)
);

-- Each partner's own goals / commitments. Visible to both; edited by the owner.
CREATE TABLE IF NOT EXISTS app_accountability_partner__commitments (
  id              TEXT NOT NULL,
  member_id       TEXT NOT NULL,          -- owner (forced to caller on INSERT)
  title           TEXT NOT NULL,
  detail          TEXT NOT NULL DEFAULT '',
  cadence         TEXT NOT NULL DEFAULT 'daily',   -- 'daily' | 'weekly'
  target_per_week INTEGER NOT NULL DEFAULT 7 CHECK (target_per_week > 0),
  active          INTEGER NOT NULL DEFAULT 1,       -- 1 = active, 0 = archived
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS app_accountability_partner__idx_commitments_member
  ON app_accountability_partner__commitments (member_id, active);

-- Daily check-ins. At most one per (commitment, calendar day) per member.
CREATE TABLE IF NOT EXISTS app_accountability_partner__checkins (
  id            TEXT NOT NULL,
  member_id     TEXT NOT NULL,            -- owner (forced to caller on INSERT)
  commitment_id TEXT NOT NULL,
  check_date    TEXT NOT NULL,            -- YYYY-MM-DD (plaintext by _date suffix)
  status        TEXT NOT NULL DEFAULT 'on_track', -- 'on_track' | 'partial' | 'missed'
  note          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS app_accountability_partner__idx_checkins_lookup
  ON app_accountability_partner__checkins (member_id, commitment_id, check_date);

-- Immutable partner-to-partner messages (encouragement + SOS), plus read
-- receipts. Written only by the paired_messages endpoint.
CREATE TABLE IF NOT EXISTS app_accountability_partner__messages (
  id           TEXT NOT NULL,
  sender_id    TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  content      TEXT NOT NULL,
  sent_at      TEXT NOT NULL,
  read_at      TEXT,
  session_id   TEXT,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS app_accountability_partner__idx_messages_thread
  ON app_accountability_partner__messages (recipient_id, sent_at);

-- Missed-check-in alert switch (one per member). The inactivity_alerts cron
-- emails recipient_member_ids when the member has been silent past
-- interval_hours. active / interval_hours are plaintext (db_plaintext_columns)
-- so the cron can read them without decryption.
CREATE TABLE IF NOT EXISTS app_accountability_partner__profiles (
  id                   TEXT    NOT NULL,
  member_id            TEXT    NOT NULL,
  active               INTEGER NOT NULL DEFAULT 0,   -- 0 = off, 1 = alerting armed
  interval_hours       INTEGER NOT NULL DEFAULT 48 CHECK (interval_hours > 0),
  message              TEXT    NOT NULL DEFAULT '',  -- included in the alert email
  recipient_member_ids TEXT    NOT NULL DEFAULT '[]',-- JSON array of member ids (the partner)
  last_checkin_at      TEXT,                         -- ISO, endpoint-stamped
  last_alerted_at      TEXT,                         -- ISO, cron-stamped (dedupe)
  created_at           TEXT    NOT NULL,
  updated_at           TEXT    NOT NULL,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS app_accountability_partner__idx_profiles_member
  ON app_accountability_partner__profiles (member_id);
