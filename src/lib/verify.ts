// Postconditions checked AFTER the receipt says SUCCESS, against reloaded
// accepted state. A record that merely has the expected id is not proof:
// every written field must match the submission.

import { pyStrip } from "./pytext.ts";
import type { FailureReport, Statement } from "./types.ts";

export type RecordSubmission = { me: string; otherWallet: string; label: string; text: string; statementId: string };

export function recordVerified(s: Statement | null, sub: RecordSubmission): boolean {
  if (!s) return false;
  const assertion = s.outcome === "PRESENT_FACT" && s.kind === "ASSERTION" && s.state === "OPEN" && s.remaining === 1;
  const undertaking = s.outcome === "FUTURE_COMMITMENT" && s.kind === "UNDERTAKING" && s.state === "RUNNING" && s.remaining === 30;
  return (
    (assertion || undertaking) &&
    s.statement_id === sub.statementId &&
    s.author.toLowerCase() === sub.me.toLowerCase() &&
    s.other_wallet === sub.otherWallet &&
    s.other_label === pyStrip(sub.label) &&
    s.text === pyStrip(sub.text) &&
    s.failure_count === 0 &&
    s.challenge_note === "" &&
    s.answer_note === ""
  );
}

export function challengeVerified(after: Statement | null, note: string): boolean {
  return !!after && after.kind === "ASSERTION" && after.state === "CHALLENGED" && after.challenge_note === pyStrip(note) && after.remaining === 0;
}

export function acceptVerified(after: Statement | null): boolean {
  return !!after && after.kind === "ASSERTION" && after.state === "ACCEPTED" && after.challenge_note === "" && after.remaining === 0;
}

export function reportVerified(before: Statement, after: Statement | null, reports: FailureReport[], note: string): boolean {
  if (!after) return false;
  const n = before.failure_count + 1;
  const row = reports.find((r) => r.index === n);
  return (
    after.kind === "UNDERTAKING" && after.state === "RUNNING" && after.failure_count === n &&
    after.remaining === 30 - n && !!row && row.note === pyStrip(note) && row.answer === ""
  );
}

export function answerVerified(before: Statement, after: Statement | null, reports: FailureReport[], index: number, note: string): boolean {
  if (!after || after.state !== before.state || after.failure_count !== before.failure_count) return false;
  if (before.kind === "ASSERTION") return after.answer_note === pyStrip(note) && after.challenge_note === before.challenge_note;
  return reports.find((r) => r.index === index)?.answer === pyStrip(note);
}
