// Mirrors every revert of contracts/FactOrPromise.py that can be predicted from
// state already read, in the SAME order the contract checks them. A disabled
// button shows the contract's exact sentence. Only the model's label is
// unpredictable, so only record_statement with all checks passing is ever sent.

import { pyContainsToken, pyLen, pyStrip } from "./pytext.ts";
import type { FailureReport, Statement } from "./types.ts";

export const MAX_TEXT_LENGTH = 600;
export const MAX_LABEL_LENGTH = 80;
export const MAX_NOTE_LENGTH = 60;
export const MAX_FAILURE_REPORTS = 30;

export const RESERVED_TOKENS = [
  "<UNTRUSTED_STATEMENT_TEXT>",
  "</UNTRUSTED_STATEMENT_TEXT>",
  "<UNTRUSTED_OTHER_SIDE_LABEL>",
  "</UNTRUSTED_OTHER_SIDE_LABEL>",
  "PRESENT_FACT",
  "FUTURE_COMMITMENT",
] as const;

export const REVERTS = {
  invalidWallet: "Invalid wallet address",
  labelEmpty: "Label is empty",
  labelTooLong: "Label is too long",
  textEmpty: "Text is empty",
  textTooLong: "Text is too long",
  noteEmpty: "Note is empty",
  noteTooLong: "Note is too long",
  reserved: "Text or label contains a reserved token",
  unknownStatement: "Unknown statement id",
  otherIsAuthor: "The other side cannot be the author",
  duplicate: "This statement already exists",
  notOtherChallenge: "Only the named other side may challenge",
  challengeUndertaking: "Nothing is asserted as at today; report a failure to perform instead",
  alreadyChallenged: "This statement has already been challenged",
  windowClosed: "The window is closed",
  notOtherReport: "Only the named other side may report a failure",
  reportAssertion: "This is asserted as at today; challenge it instead of reporting a failure",
  noRoom: "No room for further reports",
  notOtherAccept: "Only the named other side may accept",
  acceptUndertaking: "There is nothing to accept as at today; a forward promise stays open",
  alreadyAccepted: "This statement has already been accepted",
  notAuthor: "Only the author may answer",
  useIndexZero: "Use index 0 to answer the challenge",
  noChallenge: "There is no challenge to answer",
  challengeAnswered: "This challenge has already been answered",
  noSuchReport: "No such report",
  reportAnswered: "This report has already been answered",
} as const;

export const NO_CLOSING_STATE = "This record has no closing state";

/** The line under the title, built from get_statement().kind/.state/.failure_count. */
export function remedyLine(s: Statement): string {
  if (s.kind === "UNDERTAKING") return `Failure reports: ${s.failure_count} of ${MAX_FAILURE_REPORTS} · no one can close this`;
  if (s.state === "OPEN") return "One move left: challenge or accept";
  if (s.state === "CHALLENGED") return "No move left: the other side challenged this";
  return "No move left: the other side accepted this";
}

const ZERO = "0x0000000000000000000000000000000000000000";

export type WalletCheck = { ok: true; wallet: string } | { ok: false; reason: string };

/** The contract's _normalize_wallet. */
export function normalizeWallet(value: string): WalletCheck {
  const wallet = pyStrip(value).toLowerCase();
  if (wallet.length !== 42 || !wallet.startsWith("0x") || !/^[0-9a-f]{40}$/.test(wallet.slice(2)) || wallet === ZERO) {
    return { ok: false, reason: REVERTS.invalidWallet };
  }
  return { ok: true, wallet };
}

function noteBlock(note: string): string | null {
  const n = pyStrip(note);
  if (pyLen(n) === 0) return REVERTS.noteEmpty;
  if (pyLen(n) > MAX_NOTE_LENGTH) return REVERTS.noteTooLong;
  return null;
}

export type RecordInput = {
  me: string;
  otherWallet: string;
  label: string;
  text: string;
  exists: boolean; // accepted-state probe: get_statement(localId) is not "{}"
};

/** record_statement order: wallet -> label -> text -> reserved -> other != author -> duplicate. */
export function recordBlock(i: RecordInput): string | null {
  const w = normalizeWallet(i.otherWallet);
  if (!w.ok) return w.reason;
  const label = pyStrip(i.label);
  if (pyLen(label) === 0) return REVERTS.labelEmpty;
  if (pyLen(label) > MAX_LABEL_LENGTH) return REVERTS.labelTooLong;
  const text = pyStrip(i.text);
  if (pyLen(text) === 0) return REVERTS.textEmpty;
  if (pyLen(text) > MAX_TEXT_LENGTH) return REVERTS.textTooLong;
  if (pyContainsToken(label, RESERVED_TOKENS) || pyContainsToken(text, RESERVED_TOKENS)) return REVERTS.reserved;
  if (w.wallet === i.me.toLowerCase()) return REVERTS.otherIsAuthor;
  if (i.exists) return REVERTS.duplicate;
  return null;
}

const isOther = (s: Statement, me: string) => me.toLowerCase() === s.other_wallet.toLowerCase();

/** challenge order: other side -> kind -> CHALLENGED -> ACCEPTED -> note. */
export function challengeBlock(s: Statement, me: string, note: string): string | null {
  if (!isOther(s, me)) return REVERTS.notOtherChallenge;
  if (s.kind !== "ASSERTION") return REVERTS.challengeUndertaking;
  if (s.state === "CHALLENGED") return REVERTS.alreadyChallenged;
  if (s.state === "ACCEPTED") return REVERTS.windowClosed;
  return noteBlock(note);
}

/** report_failure order: other side -> kind -> room -> note. */
export function reportBlock(s: Statement, me: string, note: string): string | null {
  if (!isOther(s, me)) return REVERTS.notOtherReport;
  if (s.kind !== "UNDERTAKING") return REVERTS.reportAssertion;
  if (s.failure_count >= MAX_FAILURE_REPORTS) return REVERTS.noRoom;
  return noteBlock(note);
}

/** accept_statement order: other side -> kind -> CHALLENGED -> ACCEPTED. */
export function acceptBlock(s: Statement, me: string): string | null {
  if (!isOther(s, me)) return REVERTS.notOtherAccept;
  if (s.kind !== "ASSERTION") return REVERTS.acceptUndertaking;
  if (s.state === "CHALLENGED") return REVERTS.alreadyChallenged;
  if (s.state === "ACCEPTED") return REVERTS.alreadyAccepted;
  return null;
}

/** answer order: author -> (ASSERTION: index 0 -> CHALLENGED -> not answered | UNDERTAKING: range -> not answered) -> note. */
export function answerBlock(s: Statement, reports: FailureReport[], me: string, index: number, note: string): string | null {
  if (me.toLowerCase() !== s.author.toLowerCase()) return REVERTS.notAuthor;
  if (s.kind === "ASSERTION") {
    if (index !== 0) return REVERTS.useIndexZero;
    if (s.state !== "CHALLENGED") return REVERTS.noChallenge;
    if (s.answer_note !== "") return REVERTS.challengeAnswered;
    return noteBlock(note);
  }
  if (!Number.isInteger(index) || index < 1 || index > s.failure_count) return REVERTS.noSuchReport;
  const row = reports.find((r) => r.index === index);
  if (row && row.answer !== "") return REVERTS.reportAnswered;
  return noteBlock(note);
}

/** The index the Answer button targets: 0 on an assertion, else the first unanswered report (or 1). */
export function defaultAnswerIndex(s: Statement, reports: FailureReport[]): number {
  if (s.kind === "ASSERTION") return 0;
  return reports.find((r) => r.answer === "")?.index ?? 1;
}
