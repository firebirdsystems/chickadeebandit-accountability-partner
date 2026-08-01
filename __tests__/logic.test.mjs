import { describe, it, expect } from "vitest";
import {
  isKept,
  searchableFields,
  dateKey,
  dayBefore,
  statusForDay,
  computeStreak,
  weeklyKept,
  daysSince,
  isOverdue,
  milestoneReached,
} from "../src/logic.js";

// Helper: build a check-in row.
const ci = (commitment_id, check_date, status = "on_track", created_at = `${check_date}T09:00:00Z`) =>
  ({ id: `${commitment_id}-${check_date}`, commitment_id, check_date, status, created_at });

describe("date helpers", () => {
  it("dateKey formats local YYYY-MM-DD", () => {
    expect(dateKey(new Date(2026, 6, 8))).toBe("2026-07-08"); // month is 0-indexed
  });
  it("dayBefore walks back across month boundaries", () => {
    expect(dayBefore("2026-07-01", 1)).toBe("2026-06-30");
    expect(dayBefore("2026-07-08", 0)).toBe("2026-07-08");
    expect(dayBefore("2026-03-01", 1)).toBe("2026-02-28");
  });
});

describe("isKept", () => {
  it("on_track and partial count; missed and unknown do not", () => {
    expect(isKept("on_track")).toBe(true);
    expect(isKept("partial")).toBe(true);
    expect(isKept("missed")).toBe(false);
    expect(isKept(undefined)).toBe(false);
  });
});

describe("statusForDay", () => {
  const rows = [ci("c1", "2026-07-08", "on_track"), ci("c1", "2026-07-07", "missed")];
  it("returns the stored status or null", () => {
    expect(statusForDay(rows, "c1", "2026-07-08")).toBe("on_track");
    expect(statusForDay(rows, "c1", "2026-07-07")).toBe("missed");
    expect(statusForDay(rows, "c1", "2026-07-06")).toBe(null);
    expect(statusForDay(rows, "c2", "2026-07-08")).toBe(null);
  });
});

describe("computeStreak", () => {
  const today = "2026-07-08";
  it("counts consecutive kept days ending today", () => {
    const rows = [
      ci("c1", "2026-07-08"),
      ci("c1", "2026-07-07"),
      ci("c1", "2026-07-06", "partial"),
    ];
    expect(computeStreak(rows, "c1", today)).toBe(3);
  });
  it("gives grace for an unlogged today (counts from yesterday)", () => {
    const rows = [ci("c1", "2026-07-07"), ci("c1", "2026-07-06")];
    expect(computeStreak(rows, "c1", today)).toBe(2);
  });
  it("a missed day breaks the streak", () => {
    const rows = [ci("c1", "2026-07-08"), ci("c1", "2026-07-07", "missed"), ci("c1", "2026-07-06")];
    expect(computeStreak(rows, "c1", today)).toBe(1);
  });
  it("a gap breaks the streak", () => {
    const rows = [ci("c1", "2026-07-08"), ci("c1", "2026-07-06")]; // 07-07 missing
    expect(computeStreak(rows, "c1", today)).toBe(1);
  });
  it("is zero when nothing kept", () => {
    expect(computeStreak([], "c1", today)).toBe(0);
    expect(computeStreak([ci("c1", "2026-07-08", "missed")], "c1", today)).toBe(0);
  });
  it("does not count another commitment's check-ins", () => {
    const rows = [ci("c2", "2026-07-08"), ci("c2", "2026-07-07")];
    expect(computeStreak(rows, "c1", today)).toBe(0);
  });
});

describe("weeklyKept", () => {
  const today = "2026-07-08";
  it("counts kept days within the trailing 7 days", () => {
    const rows = [
      ci("c1", "2026-07-08"),
      ci("c1", "2026-07-05"),
      ci("c1", "2026-07-02", "missed"), // not kept
      ci("c1", "2026-06-30"),           // outside 7-day window
    ];
    expect(weeklyKept(rows, "c1", today)).toBe(2);
  });
});

describe("daysSince / isOverdue", () => {
  const now = new Date("2026-07-08T12:00:00Z");
  it("daysSince is null-safe and floors", () => {
    expect(daysSince(null, now)).toBe(Infinity);
    expect(daysSince("2026-07-06T12:00:00Z", now)).toBe(2);
    expect(daysSince("2026-07-08T00:00:00Z", now)).toBe(0);
  });
  it("isOverdue trips only past the window", () => {
    expect(isOverdue(null, 48, now)).toBe(true);
    expect(isOverdue("2026-07-08T00:00:00Z", 48, now)).toBe(false); // 12h ago
    expect(isOverdue("2026-07-05T00:00:00Z", 48, now)).toBe(true);  // ~3.5d ago
  });
});

describe("milestoneReached", () => {
  it("fires when a streak crosses a milestone", () => {
    expect(milestoneReached(6, 7)).toBe(7);
    expect(milestoneReached(2, 3)).toBe(3);
    expect(milestoneReached(7, 8)).toBe(null);
    expect(milestoneReached(29, 45)).toBe(30); // first crossed milestone
  });
});

describe("searchableFields", () => {
  it("matches on the message body, not just the sender", () => {
    expect(searchableFields({ content: "proud of you for the gym run" }, "Sam"))
      .toContain("proud of you for the gym run");
  });

  it("includes the sender name, which the row itself only carries as an id", () => {
    expect(searchableFields({ content: "hi", sender_id: "m1" }, "Sam")).toContain("Sam");
  });
});
