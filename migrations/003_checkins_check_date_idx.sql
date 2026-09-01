-- The checkins preload now windows on check_date (365 days, matching the
-- retention default) and orders by it; the existing lookup index leads with
-- member_id so it cannot serve the range. `id` tiebreak keeps the plan stable.
CREATE INDEX IF NOT EXISTS app_accountability_partner__checkins_check_date_idx
  ON app_accountability_partner__checkins (check_date, id);
