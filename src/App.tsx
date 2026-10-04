import { useCallback, useEffect, useState } from "react";
import { CONTRACT_ADDRESS, EXPLORER_BASE } from "./lib/config";
import { calldataBytes, CALLDATA_LIMIT } from "./lib/calldata";
import { errorMessage } from "./lib/errors";
import {
  connectedWallet,
  ensureStudioNet,
  getFailures,
  getStatement,
  requestWallet,
  sendWrite,
  waitForVerdict,
} from "./lib/genlayer";
import { short, statementId } from "./lib/ids";
import { pyLen, pyStrip } from "./lib/pytext";
import {
  acceptBlock,
  answerBlock,
  challengeBlock,
  defaultAnswerIndex,
  MAX_LABEL_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_TEXT_LENGTH,
  NO_CLOSING_STATE,
  recordBlock,
  remedyLine,
  reportBlock,
} from "./lib/rules";
import type { FailureReport, Statement, TxStatus } from "./lib/types";
import { acceptVerified, answerVerified, challengeVerified, recordVerified, reportVerified } from "./lib/verify";

type Loaded = { s: Statement; reports: FailureReport[] };
type Tab = "record" | "statement" | "compare";
type Action = "challenge" | "report" | "accept" | "answer";

const RECENT_KEY = "asattoday.recent";

function readRecent(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    /* storage unavailable: the recent list is a convenience only */
  }
}

function cleanId(value: string): string {
  return pyStrip(value).toLowerCase().replace(/^0x/, "");
}

const validId = (v: string) => /^[0-9a-f]{64}$/.test(cleanId(v));

async function load(id: string): Promise<Loaded | null> {
  const s = await getStatement(id);
  if (!s) return null;
  return { s, reports: s.kind === "UNDERTAKING" ? await getFailures(id) : [] };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function Meter({ bytes }: { bytes: number }) {
  return (
    <span className={bytes > CALLDATA_LIMIT ? "meter over" : "meter"} title="GenLayer calldata; the RPC rejects more than 255 bytes">
      {bytes}/{CALLDATA_LIMIT} B
    </span>
  );
}

const KIND_TITLE: Record<string, string> = {
  ASSERTION: "Asserted as at today",
  UNDERTAKING: "Promised for later",
};

type CardProps = {
  data: Loaded;
  me: string;
  busy: boolean;
  onAction: (action: Action, before: Loaded, index: number, note: string) => Promise<void>;
};

function StatementCard({ data, me, busy, onAction }: CardProps) {
  const { s, reports } = data;
  const [note, setNote] = useState("");
  const [answerIndex, setAnswerIndex] = useState(() => defaultAnswerIndex(s, reports));

  useEffect(() => {
    setAnswerIndex(defaultAnswerIndex(s, reports));
  }, [s, reports]);

  const wallet = me || "0x" + "0".repeat(40);
  const reasons: Record<Action, string | null> = {
    challenge: challengeBlock(s, wallet, note),
    report: reportBlock(s, wallet, note),
    accept: acceptBlock(s, wallet),
    answer: answerBlock(s, reports, wallet, answerIndex, note),
  };
  const role = !me ? "not connected" : me === s.author ? "you are the author" : me === s.other_wallet ? "you are the other side" : "you are neither side";
  const kindClass = s.kind === "ASSERTION" ? "assertion" : "undertaking";
  const noteBytes = calldataBytes("answer", [s.statement_id, 30, pyStrip(note)]);

  async function act(action: Action) {
    await onAction(action, data, answerIndex, note);
    setNote("");
  }

  const buttons: { action: Action; label: string; cls: string }[] = [
    { action: "challenge", label: "Challenge", cls: "btn-challenge" },
    { action: "report", label: "Report failure", cls: "btn-report" },
    { action: "accept", label: "Accept", cls: "btn-accept" },
    { action: "answer", label: s.kind === "ASSERTION" ? "Answer" : `Answer report #${answerIndex}`, cls: "btn-answer" },
  ];

  return (
    <article className={`card card-${kindClass}`}>
      <header className="card-head">
        <span className={`kind kind-${kindClass}`}>{KIND_TITLE[s.kind] ?? s.kind}</span>
        <span className={`chip-state state-${s.state.toLowerCase()}`}>{s.state}</span>
      </header>
      <p className={`remedy remedy-${kindClass}`}>{remedyLine(s)}</p>
      <blockquote>{s.text}</blockquote>
      <p className="meta">
        <code>{s.outcome}</code> · <code>{s.kind}</code> · contract remedy: “{s.remedy}” · remaining {s.remaining}
      </p>
      <p className="meta">
        id <code>{s.statement_id}</code>
        <br />author <code>{short(s.author)}</code> · other side <code>{short(s.other_wallet)}</code> ({s.other_label}) · {role}
      </p>

      {s.kind === "ASSERTION" ? (
        <div className="cells">
          <div className={s.challenge_note ? "cell filled" : "cell empty"}>
            <h4>Challenge</h4>
            <p>{s.challenge_note ? `“${s.challenge_note}”` : "— empty —"}</p>
          </div>
          <div className={s.answer_note ? "cell filled" : "cell empty"}>
            <h4>Author's answer</h4>
            <p>{s.answer_note ? `“${s.answer_note}”` : "— empty —"}</p>
          </div>
        </div>
      ) : (
        <div className="reports">
          <h4>Failure reports</h4>
          {reports.length === 0 ? (
            <p className="empty-line">— none yet —</p>
          ) : (
            <ol>
              {reports.map((r) => (
                <li key={r.index}>
                  <span className="r-n">#{r.index}</span>
                  <span className="r-note">“{r.note}”</span>
                  <span className="r-answer">{r.answer ? `Author: “${r.answer}”` : "no answer yet"}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="no-close">{NO_CLOSING_STATE}</p>
        </div>
      )}

      <div className="act">
        <div className="act-inputs">
          <input value={note} maxLength={MAX_NOTE_LENGTH * 2} placeholder="Note (challenge, report or answer)" onChange={(e) => setNote(e.target.value)} />
          {s.kind === "UNDERTAKING" && (
            <label className="idx">Answer report
              <select value={answerIndex} onChange={(e) => setAnswerIndex(Number(e.target.value))}>
                {(reports.length ? reports.map((r) => r.index) : [1]).map((n) => <option key={n} value={n}>#{n}</option>)}
              </select>
            </label>
          )}
          <small>{pyLen(pyStrip(note))}/{MAX_NOTE_LENGTH} · <Meter bytes={noteBytes} /></small>
        </div>
        <div className="act-grid">
          {buttons.map((b) => (
            <div key={b.action} className="act-cell">
              <button className={b.cls} disabled={busy || reasons[b.action] !== null || noteBytes > CALLDATA_LIMIT} onClick={() => act(b.action)}>{b.label}</button>
              {reasons[b.action] && <span className="why">{reasons[b.action]}</span>}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function App() {
  const [me, setMe] = useState("");
  const [tab, setTab] = useState<Tab>("record");
  const [tx, setTx] = useState<TxStatus>({ phase: "idle", message: "" });
  const [pendingHash, setPendingHash] = useState("");
  const [recent, setRecent] = useState<string[]>(readRecent);

  // record form
  const [other, setOther] = useState("");
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [exists, setExists] = useState(false);

  // one statement
  const [idInput, setIdInput] = useState("");
  const [current, setCurrent] = useState<Loaded | null>(null);

  // side by side
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [pair, setPair] = useState<[Loaded | null, Loaded | null]>([null, null]);

  const busy = ["checking", "signing", "submitted"].includes(tx.phase) || pendingHash !== "";

  useEffect(() => {
    connectedWallet().then(setMe).catch(() => undefined);
    window.ethereum?.on?.("accountsChanged", (a: string[]) => setMe((a?.[0] ?? "").toLowerCase()));
  }, []);

  const remember = useCallback((id: string) => {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)];
      saveRecent(next);
      return next;
    });
  }, []);

  const localId = me && pyStrip(text) ? statementId(me, text) : "";

  useEffect(() => {
    let cancelled = false;
    setExists(false);
    if (!localId || !CONTRACT_ADDRESS) return;
    const t = setTimeout(() => {
      getStatement(localId).then((s) => !cancelled && setExists(!!s)).catch(() => undefined);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [localId]);

  const recordReason = me ? recordBlock({ me, otherWallet: other, label, text, exists }) : "Connect a wallet first";
  const recordBytes = calldataBytes("record_statement", [pyStrip(other) || "0x" + "0".repeat(40), pyStrip(label), pyStrip(text)]);

  async function connect() {
    try {
      const w = await requestWallet();
      await ensureStudioNet();
      setMe(w);
    } catch (e) {
      setTx({ phase: "error", message: errorMessage(e) });
    }
  }

  /** Reload every card that shows this id; return the fresh copy. */
  async function refresh(id: string): Promise<Loaded | null> {
    const next = await load(id);
    setCurrent((c) => (c && c.s.statement_id === id ? next : c));
    setPair(([a, b]) => [a && a.s.statement_id === id ? next : a, b && b.s.statement_id === id ? next : b]);
    return next;
  }

  async function loadById(raw: string) {
    const id = cleanId(raw);
    if (!validId(id)) {
      setTx({ phase: "error", message: "Enter a 64-character statement id." });
      return;
    }
    setTx({ phase: "idle", message: "" });
    setIdInput(id);
    const next = await load(id);
    setCurrent(next);
    if (!next) setTx({ phase: "error", message: "No statement with this id on this deployment." });
    else remember(id);
  }

  async function loadPair() {
    const a = cleanId(leftId);
    const b = cleanId(rightId);
    setPair([validId(a) ? await load(a) : null, validId(b) ? await load(b) : null]);
  }

  /** Receipt first, then the postcondition on reloaded accepted state. */
  async function runWrite(what: string, send: () => Promise<string>, verified: () => Promise<boolean>) {
    let hash = "";
    try {
      setTx({ phase: "signing", message: `${what}: confirm in your wallet…` });
      hash = await send();
      setPendingHash(hash);
      setTx({ phase: "submitted", message: `${what}: submitted, waiting for the leader receipt…`, hash });
      await finish(what, hash, verified);
    } catch (e) {
      setTx({ phase: "error", message: errorMessage(e), hash: hash || undefined });
      setPendingHash("");
    }
  }

  async function finish(what: string, hash: string, verified: () => Promise<boolean>) {
    const verdict = await waitForVerdict(hash);
    if (verdict.kind === "pending") {
      setTx({ phase: "delayed", message: "Submitted — confirmation delayed. Do not resend; check again in a moment.", hash });
      return;
    }
    if (verdict.kind === "error") {
      setPendingHash("");
      setTx({ phase: "error", message: `${what} reverted: ${verdict.reason}`, hash });
      return;
    }
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (await verified()) {
        setPendingHash("");
        setTx({ phase: "success", message: `${what}: executed, and the accepted state shows the change.`, hash });
        return;
      }
      await sleep(3000);
    }
    setPendingHash("");
    setTx({ phase: "error", message: `${what}: the receipt reports success but the accepted state does not show the expected change yet. Reload before acting again.`, hash });
  }

  async function checkAgain() {
    if (!pendingHash) return;
    setTx({ phase: "submitted", message: "Checking the receipt again…", hash: pendingHash });
    await finish("Pending transaction", pendingHash, async () => true);
  }

  async function onRecord() {
    if (!me || !localId) return;
    setTx({ phase: "checking", message: "Checking the accepted state before sending…" });
    const already = !!(await getStatement(localId));
    const reason = recordBlock({ me, otherWallet: other, label, text, exists: already });
    if (reason) {
      setExists(already);
      setTx({ phase: "error", message: reason });
      return;
    }
    if (recordBytes > CALLDATA_LIMIT) {
      setTx({ phase: "error", message: `Calldata is ${recordBytes} bytes; the RPC rejects more than ${CALLDATA_LIMIT}. Shorten the text.` });
      return;
    }
    const sub = { me, otherWallet: pyStrip(other).toLowerCase(), label, text, statementId: localId };
    await runWrite(
      "Record statement",
      () => sendWrite(me, "record_statement", [sub.otherWallet, pyStrip(label), pyStrip(text)]),
      async () => recordVerified(await getStatement(sub.statementId), sub),
    );
    remember(sub.statementId);
    setIdInput(sub.statementId);
    setText("");
    setTab("statement");
    setCurrent(await load(sub.statementId));
  }

  async function onAction(action: Action, before: Loaded, index: number, note: string) {
    const id = before.s.statement_id;
    const n = pyStrip(note);
    if (action === "challenge") {
      await runWrite("Challenge", () => sendWrite(me, "challenge", [id, n]), async () => challengeVerified((await refresh(id))?.s ?? null, n));
    } else if (action === "report") {
      await runWrite("Report failure", () => sendWrite(me, "report_failure", [id, n]), async () => {
        const next = await refresh(id);
        return !!next && reportVerified(before.s, next.s, next.reports, n);
      });
    } else if (action === "accept") {
      await runWrite("Accept", () => sendWrite(me, "accept_statement", [id]), async () => acceptVerified((await refresh(id))?.s ?? null));
    } else {
      await runWrite(index === 0 ? "Answer the challenge" : `Answer report #${index}`, () => sendWrite(me, "answer", [id, index, n]), async () => {
        const next = await refresh(id);
        return !!next && answerVerified(before.s, next.s, next.reports, index, n);
      });
    }
    await refresh(id);
  }

  return (
    <div className="shell">
      <header className="bar">
        <div className="brand">
          <img src="/logo-192.png" alt="" width={40} height={40} />
          <div>
            <h1>AsAtToday</h1>
            <p>A fact as at today, or a promise for later? The answer decides how many times the other side may complain — and who can close the door.</p>
          </div>
        </div>
        <div className="who">
          {me ? <span className="chip">{short(me)}</span> : <button className="primary" onClick={connect}>Connect MetaMask</button>}
          <span className="chip dim">StudioNet 61999</span>
        </div>
      </header>

      {!CONTRACT_ADDRESS && <div className="warn">No contract address configured.</div>}

      <nav className="tabs">
        {(["record", "statement", "compare"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "tab on" : "tab"} onClick={() => setTab(t)}>
            {t === "record" ? "Record a statement" : t === "statement" ? "Statement" : "Side by side"}
          </button>
        ))}
      </nav>

      {tab === "record" && (
        <section className="panel">
          <h2>Record a statement</h2>
          <p className="muted">
            You are the author. The validators read your sentence once: does it assert how things stand now, or bind you
            to do something later? An assertion gives the other side one move — challenge or accept — and then it closes.
            A promise gives them up to 30 failure reports, and nobody can close it. Nothing is verified and no money is held.
          </p>
          <div className="grid2">
            <label>Other side's wallet<input value={other} onChange={(e) => setOther(e.target.value)} placeholder="0x…" spellCheck={false} /></label>
            <label>Other side's label<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="how the sentence names them" />
              <small>{pyLen(pyStrip(label))}/{MAX_LABEL_LENGTH}</small></label>
          </div>
          <label>Statement<textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
            <small>{pyLen(pyStrip(text))}/{MAX_TEXT_LENGTH} · <Meter bytes={recordBytes} /></small></label>
          {localId && <p className="meta">Statement id if recorded: <code>{localId}</code></p>}
          <div className="actions">
            <button className="primary" disabled={busy || recordReason !== null || recordBytes > CALLDATA_LIMIT} onClick={onRecord}>Record statement</button>
            {recordReason && <span className="why">{recordReason}</span>}
            {!recordReason && recordBytes > CALLDATA_LIMIT && <span className="why">Calldata over {CALLDATA_LIMIT} bytes; shorten the text.</span>}
          </div>
          <p className="muted small">The statement and label may not contain the tokens PRESENT_FACT or FUTURE_COMMITMENT; they are the answer tokens.</p>
        </section>
      )}

      {tab === "statement" && (
        <section className="panel">
          <h2>Statement</h2>
          <div className="row">
            <input value={idInput} onChange={(e) => setIdInput(e.target.value)} placeholder="statement id (64 hex)" spellCheck={false} />
            <button onClick={() => loadById(idInput)}>Load</button>
          </div>
          {recent.length > 0 && (
            <div className="recent">
              {recent.map((r) => <button key={r} className="link" onClick={() => loadById(r)}>{short(r, 8, 6)}</button>)}
            </div>
          )}
          {current && <StatementCard data={current} me={me} busy={busy} onAction={onAction} />}
        </section>
      )}

      {tab === "compare" && (
        <section className="panel">
          <h2>Side by side</h2>
          <p className="muted">Two statements from the same two wallets: one asserted as at today, one promised for later.</p>
          <div className="grid2">
            <input value={leftId} onChange={(e) => setLeftId(e.target.value)} placeholder="first statement id" spellCheck={false} />
            <input value={rightId} onChange={(e) => setRightId(e.target.value)} placeholder="second statement id" spellCheck={false} />
          </div>
          <div className="actions"><button onClick={loadPair}>Compare</button></div>
          <div className="pair">
            {pair.map((p, i) => (
              <div key={i}>
                {p ? <StatementCard data={p} me={me} busy={busy} onAction={onAction} /> : <p className="muted pane-empty">No statement loaded.</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {tx.phase !== "idle" && (
        <section className={`status status-${tx.phase}`}>
          <strong>{tx.phase === "delayed" ? "Submitted — confirmation delayed" : tx.phase}</strong>
          <span>{tx.message}</span>
          {tx.hash && <a href={`${EXPLORER_BASE}/tx/${tx.hash}`} target="_blank" rel="noreferrer"><code>{tx.hash}</code></a>}
          {tx.phase === "delayed" && <button onClick={checkAgain}>Check again</button>}
        </section>
      )}

      <footer className="foot">
        Contract {CONTRACT_ADDRESS ? <a href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer"><code>{CONTRACT_ADDRESS}</code></a> : "not configured"} ·
        GenLayer StudioNet · holds no money and does not check whether a statement is true.
      </footer>
    </div>
  );
}
