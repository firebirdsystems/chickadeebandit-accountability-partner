CREATE INDEX IF NOT EXISTS app_accountability_partner__checkins_retention_idx
  ON app_accountability_partner__checkins (created_at, id);

CREATE INDEX IF NOT EXISTS app_accountability_partner__messages_retention_idx
  ON app_accountability_partner__messages (sent_at, id);
