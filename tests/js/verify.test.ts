import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptVerified, answerVerified, challengeVerified, recordVerified, reportVerified } from "../../src/lib/verify.ts";
import type { FailureReport, Statement } from "../../src/lib/types.ts";

const ME = "0x" + "a".repeat(40);
const OTHER = "0x" + "b".repeat(40);
const ID = "1".repeat(64);
const st = (o: Partial<Statement> = {}): Statement => ({ statement_id: ID, author: ME, other_wallet: OTHER, other_label: "the other side",
  text: "The equipment is fully certified.", outcome: "PRESENT_FACT", kind: "ASSERTION", state: "OPEN", challenge_note: "", answer_note: "",
  failure_count: 0, remedy: "", remaining: 1, ...o });
const pr = (o: Partial<Statement> = {}) => st({ outcome: "FUTURE_COMMITMENT", kind: "UNDERTAKING", state: "RUNNING", remaining: 30, ...o });
const sub = { me: ME, otherWallet: OTHER, label: " the other side ", text: " The equipment is fully certified. ", statementId: ID };
const reps = (...rows: [string, string][]): FailureReport[] => rows.map(([note, answer], i) => ({ index: i + 1, note, answer }));

test("record postcondition accepts either reading but every field must match", () => {
  assert.equal(recordVerified(st(), sub), true);
  assert.equal(recordVerified(pr(), sub), true);
  assert.equal(recordVerified(st({ kind: "UNDERTAKING" }), sub), false);
  assert.equal(recordVerified(st({ outcome: "FUTURE_COMMITMENT" }), sub), false);
  assert.equal(recordVerified(st({ text: "Other." }), sub), false);
  assert.equal(recordVerified(st({ other_wallet: ME }), sub), false);
  assert.equal(recordVerified(st({ statement_id: "2".repeat(64) }), sub), false);
  assert.equal(recordVerified(null, sub), false);
});

test("challenge and accept postconditions", () => {
  assert.equal(challengeVerified(st({ state: "CHALLENGED", challenge_note: "Lapsed", remaining: 0 }), " Lapsed "), true);
  assert.equal(challengeVerified(st({ state: "CHALLENGED", challenge_note: "Other", remaining: 0 }), "Lapsed"), false);
  assert.equal(challengeVerified(st(), "Lapsed"), false);
  assert.equal(acceptVerified(st({ state: "ACCEPTED", remaining: 0 })), true);
  assert.equal(acceptVerified(st({ state: "CHALLENGED", remaining: 0 })), false);
  assert.equal(acceptVerified(null), false);
});

test("report postcondition: one more row, still RUNNING", () => {
  const before = pr({ failure_count: 1, remaining: 29 });
  assert.equal(reportVerified(before, pr({ failure_count: 2, remaining: 28 }), reps(["a", ""], ["Still lapsed", ""]), "Still lapsed"), true);
  assert.equal(reportVerified(before, pr({ failure_count: 1, remaining: 29 }), reps(["a", ""]), "Still lapsed"), false);
  assert.equal(reportVerified(before, pr({ failure_count: 2, remaining: 28, state: "CLOSED" }), reps(["a", ""], ["Still lapsed", ""]), "Still lapsed"), false);
});

test("answer postcondition: note written, state unchanged", () => {
  const ch = st({ state: "CHALLENGED", challenge_note: "Lapsed", remaining: 0 });
  assert.equal(answerVerified(ch, { ...ch, answer_note: "Renewed" }, [], 0, "Renewed"), true);
  assert.equal(answerVerified(ch, { ...ch, answer_note: "Renewed", state: "OPEN" }, [], 0, "Renewed"), false);
  const p = pr({ failure_count: 2, remaining: 28 });
  assert.equal(answerVerified(p, p, reps(["a", ""], ["b", "fixed"]), 2, "fixed"), true);
  assert.equal(answerVerified(p, p, reps(["a", ""], ["b", ""]), 2, "fixed"), false);
});
