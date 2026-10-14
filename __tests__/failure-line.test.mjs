import { describe, it, expect } from "vitest";
import { failureLine, pairedFailureLine } from "../src/logic.js";

const err = (props, message = "hub text") => Object.assign(new Error(message), props);
const words = { action: "save your partner", thing: "partner" };

describe("failureLine", () => {
  it("names a duplicate by code, or by the hub's text while production lags", () => {
    expect(failureLine(err({ status: 400, code: "UNIQUE_CONSTRAINT" }), words)).toBe("That partner already exists.");
    expect(failureLine(err({ status: 400 }, "UNIQUE constraint failed: x.id"), words)).toBe("That partner already exists.");
  });
  it("names a refusal without asking for a retry", () => {
    expect(failureLine(err({ status: 403 }), words)).toBe("You don’t have permission to save your partner.");
    expect(failureLine(err({ status: 507 }), words)).toBe("The household’s storage is full — free up space first.");
    expect(failureLine(err({ status: 429 }), words)).toBe("Too many tries — wait a minute and try again.");
  });
  it("splits a write that changed nothing by the caller's re-read", () => {
    expect(failureLine(null, { ...words, found: false })).toBe("This partner has been removed.");
    expect(failureLine(null, { ...words, found: true })).toBe("You don’t have permission to save your partner.");
  });
  it("reads a 404 as removed and a 409 as changed", () => {
    expect(failureLine(err({ status: 404 }), words)).toBe("This partner has been removed.");
    expect(failureLine(err({ status: 409 }), words)).toBe("This partner was changed by someone else — check it first.");
  });
  it("asks for a retry only when retrying can work", () => {
    for (const e of [err({}), err({ status: 500 }), err({ status: 503 }), err({ status: 400 }), new TypeError("Failed to fetch"), undefined]) {
      expect(failureLine(e, words)).toBe("Couldn’t save your partner — try again.");
    }
  });
  it("keeps a line the app wrote for the user, and never shows hub text", () => {
    expect(failureLine(err({ forUser: true }, "Pick someone first."), words)).toBe("Pick someone first.");
    expect(failureLine(err({ status: 500 }, "D1_ERROR: boom"), words)).not.toMatch(/D1_ERROR/);
  });
});

describe("pairedFailureLine", () => {
  const send = { action: "send the message", thing: "message" };
  it("reads a partner endpoint's 409 as the pairing no longer being mutual", () => {
    expect(pairedFailureLine(err({ status: 409 }), send)).toBe("You’re no longer paired with your partner — check your partner setting.");
  });
  it("falls back to the table for everything else", () => {
    expect(pairedFailureLine(err({ status: 403 }), send)).toBe("You don’t have permission to send the message.");
    expect(pairedFailureLine(err({ status: 429 }), send)).toBe("Too many tries — wait a minute and try again.");
    expect(pairedFailureLine(err({ status: 400 }), send)).toBe("Couldn’t send the message — try again.");
    expect(pairedFailureLine(new TypeError("Failed to fetch"), send)).toBe("Couldn’t send the message — try again.");
  });
});
