# LOCKED_SPEC — FactOrPromise (contract) / AsAtToday (Project)

Frozen source: `contracts/FactOrPromise.py`, SHA-256 in `SOURCE_SHA256.txt`. Header: `# v0.2.16` and the
py-genlayer v0.2 Depends line. Network: StudioNet 61999.

## The question

> Does this sentence assert how things stand at the moment it is written, or commit the author to do something
> afterwards?

In contract language this is the line between a representation and a covenant. "The equipment is fully
certified" can be checked today. "The equipment will be kept fully certified" has nothing to check today — it can
only be broken later, and more than once.

## Relation

- **author** — records the statement and names the other side (wallet + label);
- **other side** — the wallet that holds every remedy;
- the validators read the sentence **once**, in `record_statement`.

## Enums and state

| Outcome (model) | `kind` (immutable) | States |
|---|---|---|
| `PRESENT_FACT` | `ASSERTION` | `OPEN` → `CHALLENGED`, **or** `OPEN` → `ACCEPTED` (two exits, mutually exclusive) |
| `FUTURE_COMMITMENT` | `UNDERTAKING` | `RUNNING`, for ever — there is no closing state |

Limits: text 600, label 80, note 60 (a calldata ceiling: id 64 + note 60), failure reports 30, page 50.
**There is no time constant.** The "window" on an assertion is one move, closed by the other side.

## The novelty: how many times, and who closes the door

| | `PRESENT_FACT` | `FUTURE_COMMITMENT` |
|---|---|---|
| The other side's remedy | `challenge` — exactly once, permanent | `report_failure` — many times, up to 30 |
| Who can close the record | **the other side**, with `accept_statement` (giving up the challenge) | **no one** — `accept_statement` reverts |
| After it closes | `challenge` reverts | — |
| `report_failure` | reverts | the only path |
| `challenge` | the only path | reverts |
| End | `CHALLENGED` or `ACCEPTED` | never |

Both records have the same four remedy-side methods. What the verdict changes is the **cardinality** of a right
and the **owner** of the switch that ends it.

**The author holds no switch on either branch.** An early draft gave the author a `close_window` usable at any
time; it was dropped, because an author could record a sentence and close it before the other side had read it.
Every door here is closed by the other side.

The data types say "one" and "many": `challenge_note` is a single field on the record; `failure_note` is a
`TreeMap` keyed by `id:index`. They are deliberately not merged into one ledger.

## Five write methods

Five, not four: the two branches need two different remedies plus a lock that exists on one branch only, and
the author needs a voice on both.

1. `record_statement(other_wallet, other_label, text)` — wallet → label → text → reserved token →
   other ≠ sender → id → duplicate → **then** one model call. `PRESENT_FACT` → ASSERTION/OPEN,
   `FUTURE_COMMITMENT` → UNDERTAKING/RUNNING.
2. `challenge(id, note)` — other side → kind must be ASSERTION → state must be OPEN (CHALLENGED → *already been
   challenged*, ACCEPTED → *The window is closed*) → note → write `challenge_note`, state CHALLENGED.
3. `report_failure(id, note)` — other side → kind must be UNDERTAKING → room left → note → `failure_count += 1`,
   write `failure_note[id:n]`; state stays RUNNING.
4. `accept_statement(id)` — other side (never the author) → kind must be ASSERTION → state must be OPEN
   (CHALLENGED → *already been challenged*, ACCEPTED → *already been accepted*) → ACCEPTED.
5. `answer(id, index, note)` — author only. ASSERTION: index 0, state CHALLENGED, not yet answered. UNDERTAKING:
   1 ≤ index ≤ failure_count, that report not yet answered. **Never changes state.**

Only `record_statement` calls the model; the other four are pure state machine.

Notes must be 1–60 characters ("Note is empty" / "Note is too long"). Non-empty is required because the
one-time answer lock reads an empty `answer_note` as "not answered yet".

## The four teeth are two pairs

```
PAIR 1   challenge       on UNDERTAKING -> "Nothing is asserted as at today; report a failure to perform instead"
         report_failure  on ASSERTION   -> "This is asserted as at today; challenge it instead of reporting a failure"

PAIR 2   accept_statement on UNDERTAKING -> "There is nothing to accept as at today; a forward promise stays open"
         challenge after ACCEPTED        -> "The window is closed"
```

Pair 1 is the two directions of one lock. Pair 2 is cardinality: one branch has one move and a door that
closes; the other has no door to close. Every sentence says what the right move is.

## Views

`get_statement(id)` returns every field plus `outcome`, `remedy`
(`"one move: challenge or accept; either one closes this"` / `"failure reports, up to 30, and no one can close
this"`) and `remaining` (1 for an open assertion, 0 once challenged or accepted, `30 − failure_count` for an
undertaking). `get_failure(id, index)`, `get_failures(id, offset, limit)`, `get_rubric()`, `get_limits()`.
Unknown id → `"{}"` (list → `"[]"`), never a revert. No view takes long text. No preview / classify / dry-run.

## Id

`keccak256("FACT_OR_PROMISE:STATEMENT:V1|" + author_lower + "|" + len(norm) + "|" + norm)` with
`norm = " ".join(text.split())`. The stripped original is stored; only the normalized form is hashed, so internal
whitespace variants cannot re-roll a reading.

## Fail-safe: `PRESENT_FACT`

The right question is which wrong guess hurts the side that did not write the text.

- Wrongly `FUTURE_COMMITMENT`: the other side can never challenge a statement about today — and nothing will
  happen later to report, because the sentence was already true or false when written. They get a path to
  nowhere and lose the real one. **A victim, and no remedy at all.**
- Wrongly `PRESENT_FACT`: the other side gets **one** challenge on a forward promise. It is usable — it stays on
  chain and the author must answer. They lose the repeated reports, not everything. The author who wrote the
  unclear sentence answers a complaint of the wrong type.

One path beats none. The fail-safe gives the author nothing extra: on an assertion the author can only answer;
closing belongs to the other side.

## Two objections answered

**"Which branch does the author want, and why not polish the wording until it lands there?"** The branches cost
different things. `PRESENT_FACT` ends fast — one move, then closed — but leaves a checkable claim about today on
chain for good. `FUTURE_COMMITMENT` claims nothing today but can never be closed. An author who wants a quick end
must be willing to assert; one who will not assert lands in a record that never ends. Either way the author pays
that branch's price.

**"Where is the real risk?"** A wrong `PRESENT_FACT`: a forward promise gets one challenge and closes. Nets:
(a) the opposite error leaves no path at all; (b) only the other side can close a record; (c) the app shows
"One move left: challenge or accept" large and before the first move.

## Nearest neighbours

| Neighbour | It asks | Difference |
|---|---|---|
| promise failure-state contracts | whether a promise has any failure state | here both branches have one; they differ in how many times and how long it can be raised |
| outcome-vs-effort contracts | whether the author owes a result or a method | both of those are about the future; this asks the earlier question — is the text about the future at all |
| evidence-matching contracts | whether evidence satisfies a requirement | no evidence is submitted here; only a sentence and its tense |
