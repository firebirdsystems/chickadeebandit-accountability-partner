# Accountability Partner

Pair up with **one** accountability partner — a sponsor, a sobriety or fitness
buddy, a goal-keeping friend — and support each other. Not romantic, not a group:
two people, mutually chosen.

## What it does

- **Pair up** — pick your partner; you're connected once they pick you back
  (`partner_link`, adults only).
- **Commitments** — each of you sets your own goals ("Stay sober today",
  "Gym 4×/week"), daily or a weekly target.
- **Daily check-ins & streaks** — tap on-track / partial / missed each day; a
  streak builds from consecutive kept days. You see each other's progress.
- **Encouragement** — send immutable notes with read receipts
  (`paired_messages`).
- **SOS** — one tap sends your partner an urgent "I need support now"
  notification and drops a message in your thread.
- **Missed check-in alert** — arm a switch so your partner is emailed if you go
  silent past a window you choose (`inactivity_alerts`; needs the hub's paid
  `cron` + `email` capabilities). A free in-app "hasn't checked in" banner works
  regardless.

## Security model (server-enforced)

All confidentiality/integrity is enforced by `row_policies`, never the client:

- `partner_config` — `owner_only` + `endpoint_writes_only`; written only by the
  `partner_link` endpoint, read only by its owner.
- `commitments` / `checkins` — `couple_scoped` (`require_reciprocal`): both
  partners read them; `INSERT` forces `member_id` to the caller (you can only log
  your own check-ins / create your own goals); `delete_owner_only` keeps each
  person's rows deletable only by their author; `checkins` adds
  `max_per_member` (one per commitment per day).
- `messages` — `couple_scoped` + `endpoint_writes_only`; the `paired_messages`
  endpoint is the only writer (stamps sender/time/read receipts).
- `profiles` — `owner_only` (`adults_bypass:false`); each member owns their own
  alert switch. The `inactivity_alerts` cron reads it and emails the partner.

`accountability.checkin_logged` / `accountability.milestone` are published for
cross-app consumers (gated `require_role: adult` via `publish_acls`).

## Develop

```bash
npm install
npm run dev      # http://localhost:3001 (demo mode — no partner/DB needed)
npm test         # pure-logic unit tests (src/logic.js)
npm run build    # writes dist/bundle.json
```

Behavioral `scenarios.json` covers couple scoping, `max_per_member`, the
`endpoint_writes_only` tables, and `owner_only` profile isolation; the hub's
nightly app-exercise suite replays it against the published bundle.
