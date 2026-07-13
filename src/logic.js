// Pure, browser-free logic for Accountability Partner — unit-tested in
// __tests__/logic.test.mjs. No DOM, no network, no module-level state.

/** A check-in status counts toward a streak unless it is an explicit miss. */
export const KEPT_STATUSES = ["on_track", "partial"];
export function isKept(status) {
  return KEPT_STATUSES.includes(status);
}

/** Local YYYY-MM-DD for a Date (the check_date key we store and compare on). */
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** dateKey for `offset` days before `from` (offset > 0 = further in the past). */
export function dayBefore(from, offset) {
  const d = new Date(`${from}T00:00:00`);
  d.setDate(d.getDate() - offset);
  return dateKey(d);
}

/**
 * Map of check_date -> status for one commitment. When a day somehow has more
 * than one row (it shouldn't — max_per_member prevents it), the latest by
 * created_at wins.
 */
export function statusByDate(checkins, commitmentId) {
  const rows = checkins
    .filter((c) => c.commitment_id === commitmentId)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const map = new Map();
  for (const r of rows) map.set(r.check_date, r.status);
  return map;
}

/** The stored status for one commitment on one day, or null if not checked in. */
export function statusForDay(checkins, commitmentId, date = dateKey()) {
  return statusByDate(checkins, commitmentId).get(date) ?? null;
}

/**
 * Current streak: consecutive days (ending today, or yesterday if today isn't
 * logged yet) whose status is "kept" (on_track/partial). A "missed" status or a
 * gap ends the streak. Today being un-logged does NOT break an existing streak.
 */
export function computeStreak(checkins, commitmentId, today = dateKey()) {
  const byDate = statusByDate(checkins, commitmentId);
  let streak = 0;
  let cursor = today;
  // Grace for today: if today isn't logged, start counting from yesterday.
  if (!byDate.has(today)) cursor = dayBefore(today, 1);
  while (isKept(byDate.get(cursor))) {
    streak += 1;
    cursor = dayBefore(cursor, 1);
  }
  return streak;
}

/**
 * Kept check-ins for a commitment within the trailing 7 days (inclusive of
 * today) — the numerator for a weekly target like "gym 4x/week".
 */
export function weeklyKept(checkins, commitmentId, today = dateKey()) {
  const byDate = statusByDate(checkins, commitmentId);
  let kept = 0;
  for (let i = 0; i < 7; i++) {
    if (isKept(byDate.get(dayBefore(today, i === 0 ? 0 : i)))) kept += 1;
  }
  return kept;
}

/** Whole days elapsed since an ISO timestamp (null-safe). */
export function daysSince(iso, now = new Date()) {
  if (!iso) return Infinity;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Infinity;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

/**
 * Is a partner "overdue" — silent past their configured window? Used for the
 * free in-app overdue banner (the paid email path is inactivity_alerts' cron).
 * `lastCheckinIso` is the most recent check-in we can see for that member.
 */
export function isOverdue(lastCheckinIso, intervalHours = 48, now = new Date()) {
  if (!lastCheckinIso) return true;
  const then = new Date(lastCheckinIso).getTime();
  if (Number.isNaN(then)) return true;
  return now.getTime() - then > intervalHours * 3_600_000;
}

/** Milestone reached when a streak crosses one of these day counts. */
export const MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365];
export function milestoneReached(previousStreak, newStreak) {
  return MILESTONES.find((m) => previousStreak < m && newStreak >= m) ?? null;
}
