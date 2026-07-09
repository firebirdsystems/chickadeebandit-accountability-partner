// Mirrors the handful of /hub-sdk.js helpers that src/logic.js relies on, so the
// pure logic can be imported in Node (tests) without the browser-only SDK.
// The browser app imports the real versions from /hub-sdk.js.

export function isAdult(member, members = []) {
  if (!member) return false;
  const m = typeof member === "string" ? members.find((x) => x.id === member) : member;
  return (m?.role ?? "") === "adult";
}
