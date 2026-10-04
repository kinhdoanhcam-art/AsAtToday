import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  acceptBlock, answerBlock, challengeBlock, defaultAnswerIndex, NO_CLOSING_STATE, normalizeWallet, recordBlock, remedyLine, reportBlock, REVERTS,
} from "../../src/lib/rules.ts";
import type { FailureReport, Statement } from "../../src/lib/types.ts";

const SRC = readFileSync(new URL("../../contracts/FactOrPromise.py", import.meta.url), "utf8");
const AUTHOR = "0x" + "a".repeat(40);
const OTHER = "0x" + "b".repeat(40);
const STRANGER = "0x" + "c".repeat(40);

function st(o: Partial<Statement> = {}): Statement {
  return { statement_id: "1".repeat(64), author: AUTHOR, other_wallet: OTHER, other_label: "the other side", text: "t",
    outcome: "PRESENT_FACT", kind: "ASSERTION", state: "OPEN", challenge_note: "", answer_note: "", failure_count: 0,
    remedy: "one move: challenge or accept; either one closes this", remaining: 1, ...o };
}
const promise = (o: Partial<Statement> = {}) => st({ outcome: "FUTURE_COMMITMENT", kind: "UNDERTAKING", state: "RUNNING",
  remedy: "failure reports, up to 30, and no one can close this", remaining: 30, ...o });
const reps = (...answers: string[]): FailureReport[] => answers.map((answer, i) => ({ index: i + 1, note: `r${i + 1}`, answer }));

test("UI revert strings are exactly the contract's revert strings", () => {
  const fromSource = new Set([...SRC.matchAll(/UserError\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]));
  assert.deepEqual([...new Set(Object.values(REVERTS))].sort(), [...fromSource].sort());
  assert.equal(fromSource.size, 27);
});

test("remedy line: one move on an open assertion, N of 30 on a promise (failure_count, not remaining)", () => {
  assert.equal(remedyLine(st()), "One move left: challenge or accept");
  assert.equal(remedyLine(promise({ failure_count: 3, remaining: 27 })), "Failure reports: 3 of 30 · no one can close this");
  assert.equal(remedyLine(promise({ failure_count: 1, remaining: 29 })), "Failure reports: 1 of 30 · no one can close this");
  assert.match(remedyLine(st({ state: "CHALLENGED", remaining: 0 })), /^No move left/);
  assert.match(remedyLine(st({ state: "ACCEPTED", remaining: 0 })), /^No move left/);
  assert.equal(NO_CLOSING_STATE, "This record has no closing state");
});

test("normalizeWallet mirrors the contract", () => {
  assert.deepEqual(normalizeWallet(" 0x" + "AB".repeat(20) + " "), { ok: true, wallet: "0x" + "ab".repeat(20) });
  for (const bad of ["0x1", "0x" + "0".repeat(40), "0x" + "q".repeat(40)]) assert.deepEqual(normalizeWallet(bad), { ok: false, reason: REVERTS.invalidWallet });
});

test("recordBlock follows the contract order", () => {
  const b = { me: AUTHOR, otherWallet: OTHER, label: "the other side", text: "The equipment is fully certified.", exists: false };
  assert.equal(recordBlock(b), null);
  assert.equal(recordBlock({ ...b, otherWallet: "x", label: "" }), REVERTS.invalidWallet);
  assert.equal(recordBlock({ ...b, label: "" }), REVERTS.labelEmpty);
  assert.equal(recordBlock({ ...b, label: "x".repeat(81) }), REVERTS.labelTooLong);
  assert.equal(recordBlock({ ...b, text: "\u0085\u001c" }), REVERTS.textEmpty);
  assert.equal(recordBlock({ ...b, text: "y".repeat(601) }), REVERTS.textTooLong);
  assert.equal(recordBlock({ ...b, text: "this is a present_fact" }), REVERTS.reserved);
  assert.equal(recordBlock({ ...b, label: "<untrusted_other_side_label>" }), REVERTS.reserved);
  assert.equal(recordBlock({ ...b, otherWallet: AUTHOR.toUpperCase().replace("0X", "0x") }), REVERTS.otherIsAuthor);
  assert.equal(recordBlock({ ...b, exists: true }), REVERTS.duplicate);
  assert.equal(recordBlock({ ...b, otherWallet: AUTHOR, exists: true }), REVERTS.otherIsAuthor);
});

test("pair 1: the two methods swap places between the two kinds", () => {
  assert.equal(reportBlock(st(), OTHER, "Not certified"), REVERTS.reportAssertion);
  assert.equal(challengeBlock(st(), OTHER, "Lapsed"), null);
  assert.equal(challengeBlock(promise(), OTHER, "Not certified"), REVERTS.challengeUndertaking);
  assert.equal(reportBlock(promise(), OTHER, "Lapsed"), null);
});

test("pair 2: accept has two different reasons, and an accepted assertion closes the window", () => {
  assert.equal(acceptBlock(promise(), OTHER), REVERTS.acceptUndertaking);
  assert.equal(acceptBlock(st({ state: "CHALLENGED" }), OTHER), REVERTS.alreadyChallenged);
  assert.notEqual(REVERTS.acceptUndertaking, REVERTS.alreadyChallenged);
  assert.equal(acceptBlock(st({ state: "ACCEPTED" }), OTHER), REVERTS.alreadyAccepted);
  assert.equal(acceptBlock(st(), OTHER), null);
  assert.equal(challengeBlock(st({ state: "ACCEPTED" }), OTHER, "x"), REVERTS.windowClosed);
});

test("challengeBlock: other side -> kind -> state -> note", () => {
  assert.equal(challengeBlock(promise(), STRANGER, ""), REVERTS.notOtherChallenge);
  assert.equal(challengeBlock(st(), AUTHOR, "x"), REVERTS.notOtherChallenge);
  assert.equal(challengeBlock(promise(), OTHER, ""), REVERTS.challengeUndertaking);
  assert.equal(challengeBlock(st({ state: "CHALLENGED" }), OTHER, ""), REVERTS.alreadyChallenged);
  assert.equal(challengeBlock(st({ state: "ACCEPTED" }), OTHER, "n".repeat(61)), REVERTS.windowClosed);
  assert.equal(challengeBlock(st(), OTHER, " "), REVERTS.noteEmpty);
  assert.equal(challengeBlock(st(), OTHER, "n".repeat(61)), REVERTS.noteTooLong);
});

test("reportBlock: other side -> kind -> room -> note", () => {
  assert.equal(reportBlock(st(), AUTHOR, "x"), REVERTS.notOtherReport);
  assert.equal(reportBlock(promise(), STRANGER, "x"), REVERTS.notOtherReport);
  assert.equal(reportBlock(st(), OTHER, ""), REVERTS.reportAssertion);
  assert.equal(reportBlock(promise({ failure_count: 30, remaining: 0 }), OTHER, ""), REVERTS.noRoom);
  assert.equal(reportBlock(promise({ failure_count: 29 }), OTHER, "x"), null);
  assert.equal(reportBlock(promise(), OTHER, ""), REVERTS.noteEmpty);
});

test("acceptBlock: the author can never accept", () => {
  assert.equal(acceptBlock(st(), AUTHOR), REVERTS.notOtherAccept);
  assert.equal(acceptBlock(promise(), STRANGER), REVERTS.notOtherAccept);
});

test("answerBlock: author -> branch rules -> note", () => {
  const ch = st({ state: "CHALLENGED", challenge_note: "Lapsed", remaining: 0 });
  assert.equal(answerBlock(ch, [], OTHER, 0, "x"), REVERTS.notAuthor);
  assert.equal(answerBlock(ch, [], AUTHOR, 1, ""), REVERTS.useIndexZero);
  assert.equal(answerBlock(st(), [], AUTHOR, 0, "x"), REVERTS.noChallenge);
  assert.equal(answerBlock(st({ state: "ACCEPTED" }), [], AUTHOR, 0, "x"), REVERTS.noChallenge);
  assert.equal(answerBlock({ ...ch, answer_note: "Renewed" }, [], AUTHOR, 0, "x"), REVERTS.challengeAnswered);
  assert.equal(answerBlock(ch, [], AUTHOR, 0, ""), REVERTS.noteEmpty);
  assert.equal(answerBlock(ch, [], AUTHOR, 0, "Renewed"), null);
  const p = promise({ failure_count: 2, remaining: 28 });
  assert.equal(answerBlock(p, reps("", "done"), AUTHOR, 0, "x"), REVERTS.noSuchReport);
  assert.equal(answerBlock(p, reps("", "done"), AUTHOR, 3, "x"), REVERTS.noSuchReport);
  assert.equal(answerBlock(promise(), [], AUTHOR, 1, "x"), REVERTS.noSuchReport);
  assert.equal(answerBlock(p, reps("", "done"), AUTHOR, 2, "x"), REVERTS.reportAnswered);
  assert.equal(answerBlock(p, reps("", "done"), AUTHOR, 1, "n".repeat(61)), REVERTS.noteTooLong);
  assert.equal(answerBlock(p, reps("", "done"), AUTHOR, 1, "fixed"), null);
});

test("default answer index: 0 on an assertion, first unanswered report on a promise", () => {
  assert.equal(defaultAnswerIndex(st(), []), 0);
  assert.equal(defaultAnswerIndex(promise({ failure_count: 3 }), reps("a", "", "")), 2);
  assert.equal(defaultAnswerIndex(promise(), []), 1);
});
