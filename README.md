AsAtToday does not ask whether a promise can fail, and it does not weigh evidence against a requirement. It asks whether a sentence is a statement about how things stand or a commitment about what will be done — and it turns that answer into how many times the other side may complain, and into which of the two sides holds the switch that closes the door.

<p><img src="logo.png" alt="AsAtToday logo" width="96"></p>

# AsAtToday

A GenLayer dApp on StudioNet (chain 61999) built on the Intelligent Contract `FactOrPromise`
(`contracts/FactOrPromise.py`, py-genlayer v0.2, `# v0.2.16`).

| | |
|---|---|
| Live app | https://as-at-today.vercel.app |
| Project contract | [`0x60c9eE92D411cAdC3C0D8b5d2CBB0dB3C41e9ecd`](https://explorer-studio.genlayer.com/address/0x60c9eE92D411cAdC3C0D8b5d2CBB0dB3C41e9ecd) |
| Intelligent Contract (separate submission) | `0x368Fc97e33cA20D49FC58751fBBb59B610B952f3` |
| Source SHA-256 | `811d85c4cb23712d1e9a24e431fb5030dff85e13a6509db6643c5d076afbdb44` (`SOURCE_SHA256.txt`) |
| Evidence | `RUNTIME_EVIDENCE.md` · `TESTING.md` |

## What it does

An author records a statement for a named other side. GenLayer validators read it **once**:

- **asserted as at today** (`PRESENT_FACT` → `ASSERTION`): the other side gets **one move** — challenge it or
  accept it — and either move closes the record for good;
- **promised for later** (`FUTURE_COMMITMENT` → `UNDERTAKING`): the other side may report failures **up to 30
  times**, and **no one** can close the record.

Only the other side challenges, reports or accepts. The author can only answer — the challenge, or each report —
and an answer never changes the state. Unclear output fails safe to an assertion, which leaves the other side one
path instead of none.

**The contract holds no money.** It does not check whether a statement is true — it reads no register,
certificate or ledger and calls no web source. It classifies the sentence and decides the shape of the remedy.

## What the app shows

- **Every statement shows all four buttons** — Challenge, Report failure, Accept, Answer. A button that does not
  belong to this kind of record, this wallet or this state is disabled with the contract's own revert sentence,
  e.g. *"This is asserted as at today; challenge it instead of reporting a failure"*.
- **The remedy line** under the title, before anyone acts: *One move left: challenge or accept* on an open
  assertion, *Failure reports: N of 30 · no one can close this* on a promise.
- An assertion shows two cells, **Challenge** and **Author's answer**, and a state chip (OPEN / CHALLENGED /
  ACCEPTED). A promise shows its list of failure reports with the author's answers and the line *This record has
  no closing state*.
- **Side by side**: two statements from the same two wallets, one tense apart — one has a single move and then
  closes, the other takes thirty reports and never closes.
- The id of a new statement is computed locally (Keccak-256, Python whitespace rules) and shown before sending;
  the app checks the accepted state first and never sends a duplicate.
- Success is reported only after the leader receipt says SUCCESS and the reloaded accepted state shows the change.
  A live meter blocks calldata over 255 bytes.

## How to try it

You need **two wallets of your own**, both on GenLayer StudioNet: an author and an other side. Every remedy
belongs to the other side's wallet. Do not reuse statements from the evidence — record your own.

1. Open the live app and connect MetaMask as the **author**. On *Record a statement*, enter your other wallet,
   label `the other side`, and `The equipment is fully certified.` Record it; the app opens it as *Asserted as at
   today* with *One move left: challenge or accept*. Record a second statement:
   `The equipment will be kept fully certified.` It opens as *Promised for later* with *Failure reports: 0 of 30*.
2. Switch MetaMask to the **other side**. On the promise, type a note and click *Report failure*: the list gains a
   row and the line reads *1 of 30*. *Challenge* and *Accept* stay disabled with their sentences.
3. Open *Side by side* with both ids: on the assertion, *Report failure* is disabled with *"This is asserted as at
   today; challenge it instead of reporting a failure"*; on the promise, *Challenge* is disabled with *"Nothing is
   asserted as at today; report a failure to perform instead"*.
4. Challenge the assertion: the chip turns CHALLENGED and *Accept* is disabled with *"This statement has already
   been challenged"* — a different sentence from the promise's *"There is nothing to accept as at today; a forward
   promise stays open"*.

## Methods

| Write | Who | Notes |
|---|---|---|
| `record_statement(other_wallet, other_label, text)` | author | the only model call |
| `challenge(statement_id_hex, note)` | other side | ASSERTION only; once; closes it |
| `report_failure(statement_id_hex, note)` | other side | UNDERTAKING only; up to 30; stays RUNNING |
| `accept_statement(statement_id_hex)` | other side, never the author | ASSERTION only; closes it |
| `answer(statement_id_hex, index, note)` | author | 0 = the challenge, 1…n = report n; once each; no state change |

Views: `get_statement` (every field plus `outcome`, `remedy`, `remaining`), `get_failure`, `get_failures`,
`get_rubric`, `get_limits`. Unknown id → `"{}"`. No preview or dry-run view. Full rules: `LOCKED_SPEC.md`.

## Run locally

```
npm ci
npm run dev          # http://localhost:5173, proxied to StudioNet
npm test             # frontend logic tests
npm run build
python3 -m pytest tests/contract -q    # contract tests in GenLayer Direct Mode
```

`VITE_CONTRACT_ADDRESS` overrides the Project address in `src/lib/config.ts`.

## Honest limitation

1. **The contract holds no money, does not verify a statement and enforces nothing off chain.** It does not
   check whether equipment is certified or what a register says — it classifies the sentence and decides the
   shape of the other side's remedy.
2. **Challenges and failure reports are self-declared.** No one proves them. The value is in the enforced shape —
   once or many, closable or not — and in every word staying on chain next to the author's answer.
3. **A wrong `PRESENT_FACT` costs the other side the repeated reports** — a forward promise gets one challenge
   and then closes. This direction is still chosen because the opposite error leaves the other side no path at
   all. The author has no button to cut a record short; only the other side closes one.
4. **A wrong `FUTURE_COMMITMENT` means the record can never be closed** — the author keeps receiving reports up
   to the ceiling even if the sentence was already true or false when written. The cost lands on whoever wrote
   the unclear sentence, deliberately.
5. **The author declares the other side's wallet.** The contract refuses the author's own wallet, but a second
   wallet is cheap and cannot be proven to be a second person — and here that weighs more than usual, because
   both remedies belong to the other side's wallet.
6. **`MAX_FAILURE_REPORTS = 30` is a hard ceiling.** A full ledger stays `RUNNING`; it stops taking reports, it
   does not close. And the "window" here is not a span of time.

The contract accepts 600 characters, but only statements up to about 157 characters fit the 255-byte calldata
limit; longer ones are not proven and the app blocks them.

License: MIT.
