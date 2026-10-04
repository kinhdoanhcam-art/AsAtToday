# TESTING

```
COMPILE PASS ≠ RUNTIME PASS
SUBMITTED ≠ ACCEPTED ≠ FINALIZED ≠ EXECUTION SUCCESS ≠ POSTCONDITION PASS
```

## Run automatically (offline, also in CI)

| Gate | Command | Result |
|---|---|---|
| kill-set + rubric overlap | `python3 FACTORPROMISE_KILLSET_CHECK.py contracts/FactOrPromise.py` | NO LEAK + PASS, rc 0 |
| genvm-linter (AST, offline) | `python3 -m genvm_linter.cli lint contracts/FactOrPromise.py` | passed (3 checks), rc 0 |
| genvm-linter schema / typecheck | `python3 -m genvm_linter.cli schema` / `typecheck` | 10 methods (5 write, 5 view); no type errors (run once, not in CI) |
| contract tests, Direct Mode | `python3 -m pytest tests/contract -q` | 54 passed |
| frontend logic tests | `npm test` | 44 passed |
| build | `npm run build` (`tsc -b && vite build`) | rc 0 |
| source hash | `npm run verify:source` | PASS |
| calldata table | `node tools/calldata-bytes.mjs` | every hard-block row ≤ 255 bytes |

`lint` is used, not `check`: `check` calls the network and exits 1 in CI.

Ten deliberate faults were injected into the contract one at a time (a missing kind check on each of the three
other-side methods, no closed-door check, the author allowed to accept, an answer that reopens, the ceiling raised,
the fail-safe flipped, `remaining` fixed at 1, no whitespace normalization); each was caught by a contract test.

### Calldata size (offline, encoded exactly as genlayer-js 1.1.8 `writeContract`)

| Row | Bytes |
|---|---|
| record_statement P1 / P2 / P3 / P4 / P5 | 131 / 140 / 151 / 170 / 157 |
| record_statement U1 / U2 / U3 / U4 / U5 | 141 / 155 / 152 / 152 / 159 |
| challenge (id + 60-char note) | 157 |
| report_failure (id + 60-char note) | 162 |
| accept_statement (id) | 103 |
| answer (id + index 30 + 60-char note) | 156 |
| record_statement at the caps (label 80 + text 600) — measure only | 767, over the limit |

Longest ASCII statement that fits with label `the other side`: **157 characters**. The app shows a live meter and
blocks sending above 255 bytes.

### Calldata on the real RPC

`node tools/probe-calldata.mjs <address>` sends each row as a `gen_call` write simulation (no wallet, no
transaction, no model call): `record_statement` is sent from the other-side wallet and stops at *The other side
cannot be the author*; the id methods use an unknown id and stop at *Unknown statement id*. StudioNet's `gen_call`
answers these with a generic "execution failed" rather than the sentence, so a row counts as decoded when the node
reports execution (or returns the sentence) and fails only on a network error or no answer. CI runs it for the
addresses in `deployments.json` (job `probe`).

On StudioNet the `gen_call` path also executed the 767-byte measure-only row, so the probe does **not** reproduce
the 255-byte cliff, which belongs to the transaction path (`eth_sendRawTransaction`). That limit is enforced by the
offline table above and by the app's meter.

## Run by hand on StudioNet

Only what needs a real wallet, a real signature or a human eye. Results and hashes: `RUNTIME_EVIDENCE.md`.

- Intelligent Contract: deploy, then 12 rows / 14 transactions with two wallets. The three must-verify checks
  (P4/U4 labels, P1/U1 labels, the two methods swapping places) are rows of that table. All passed.
- Project: the same frozen source deployed again at its own address, then 4 transactions through the app and
  3 screenshots. All passed.

A call the app already knows will revert is **not** sent — the button is disabled with the contract's sentence —
so its proof in the Project run is a screenshot, not a hash.

## Consensus behaviour

A leader/validator disagreement that does not reach quorum fails `record_statement`: no statement is stored with
a label the validators did not agree on (fail-closed by design).

## What this run does NOT prove

- The Direct Mode tests use **mocked** model answers. They prove the deterministic code paths, not what the model
  returns. Only RUNTIME_EVIDENCE proves labels.
- Four of the ten semantic cases were labelled on-chain, one run each; label stability across repeated runs or
  validator sets is not measured.
- The 30-report ceiling, double answers and wrong-index answers are tested offline only.
- Statements longer than about 157 characters (the contract allows 600) are not proven on StudioNet.
- Prompt-injection resistance rests on the fence and the reserved-token check; no adversarial model run was done.
- The app screens were also rendered against a local mock of the RPC; the real wallet flow is covered by the
  Project transactions.
