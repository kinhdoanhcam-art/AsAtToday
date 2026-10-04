# RUNTIME_EVIDENCE

Network: GenLayer StudioNet, chain 61999. Source SHA-256: `811d85c4cb23712d1e9a24e431fb5030dff85e13a6509db6643c5d076afbdb44`.
Every row: wallet, method, exact input, expected, tx hash, execution result, post-state from a view.
"EP" is the equivalence-principle output (the label the validators agreed on). A screenshot or a FINALIZED status alone is not evidence of execution.

## Project — AsAtToday (through the app)

Project contract: [`0x60c9eE92D411cAdC3C0D8b5d2CBB0dB3C41e9ecd`](https://explorer-studio.genlayer.com/address/0x60c9eE92D411cAdC3C0D8b5d2CBB0dB3C41e9ecd) —
the same frozen source deployed again at its own address (not the Intelligent Contract address).
Author wallet `0x3065E31B1D993d7C0D59E6786844cBa56780B2d3` · other-side wallet `0x5a52d040581A76e2C032542855D31480f2ea7097`.

| # | Wallet | Action in the app | Expected | Tx hash | Status |
|---|---|---|---|---|---|
| 1 | author | Record P1 (`The equipment is fully certified.`) | `PRESENT_FACT`, ASSERTION, OPEN | — | NOT RUN |
| 6 | author | Record U1 (`The equipment will be kept fully certified.`) | `FUTURE_COMMITMENT`, UNDERTAKING, RUNNING | — | NOT RUN |
| 8 | other | Report failure on U1 | failure_count 1, RUNNING | — | NOT RUN |
| 3 | other | Challenge P1 | CHALLENGED | — | NOT RUN |

Calls the app already knows will revert are not sent: the button is disabled with the contract's sentence, and
the proof is a screenshot, not a hash.

## Intelligent Contract — the pair that carries the concept: #2 vs #7


The same contract, the same other-side wallet, two sentences one tense apart — and the two methods swap places.

| | on P1 (ASSERTION) | on U1 (UNDERTAKING) |
|---|---|---|
| `report_failure` | **#2 reverts** `0xb56e717cd8ad9e7334e39b5b2d41c049baf813be912b1547279ecd6c0899d443` | **#8 succeeds** `0xd39d1d751fa71cbabf07b3fe2b151ecf335f63b7ded6acd7365d361259f3882b` |
| `challenge` | **#3 succeeds** `0xc6f38068e1095fdcd5d1caad9a7e3497121d83053ec4eb5d6156991252b6e76d` | **#7 reverts** `0x84e9eae71a55cc41b5afa74d738d3bf1c95fbcae5a108141009198e626d6f19c` |

The semantic reading alone decides which door the other side may use.

## Intelligent Contract — 12 rows, 14 transactions

Contract address: [`0x368Fc97e33cA20D49FC58751fBBb59B610B952f3`](https://explorer-studio.genlayer.com/address/0x368Fc97e33cA20D49FC58751fBBb59B610B952f3) · deploy tx `0x7902ca019b5c4feedce5786f0d3ba6a34361cb489582b42418536227d683f2b5` (SUCCESS)
Author wallet `0x3065E31B1D993d7C0D59E6786844cBa56780B2d3` · other-side wallet `0xdaE8968571C6E84f44F86d06F1071bbc8F807500` ·
every statement recorded with label `the other side`.

| # | Wallet | Method and input | Expected | Tx hash | Result | Status |
|---|---|---|---|---|---|---|
| 1 | author | `record_statement(other, "the other side", P1)` | `PRESENT_FACT`, ASSERTION, OPEN | `0x485b040bb6dc0b9cd8416bdf7f870dd2e413b338ce192828a7f58317680a7c9d` | ACCEPTED · SUCCESS · EP `PRESENT_FACT` | PASS |
| 2 | other | `report_failure(<P1 id>, "Not certified")` | revert *This is asserted as at today; challenge it instead of reporting a failure* | `0xb56e717cd8ad9e7334e39b5b2d41c049baf813be912b1547279ecd6c0899d443` | ERROR · `[rollback]` that sentence (validators agree) | PASS (expected revert) |
| 3 | other | `challenge(<P1 id>, "Certificate lapsed in May")` | success, CHALLENGED | `0xc6f38068e1095fdcd5d1caad9a7e3497121d83053ec4eb5d6156991252b6e76d` | ACCEPTED · SUCCESS (5/5 agree) | PASS |
| 4 | other | `accept_statement(<P1 id>)` | revert *This statement has already been challenged* | `0x1e4fefbf012c18d5fb6641f54f15061646d340f4895b9116760e57c696a49d7c` | ERROR · `[rollback]` that sentence (validators agree) | PASS (expected revert) |
| 5 | author | `answer(<P1 id>, 0, "Renewed on 2 June")` | success, state stays CHALLENGED | `0x3c57fd5cc7d2e6e81384e4cfac63ee2c60a2f1958f7e54e2fe24bcd40426ef63` | ACCEPTED · SUCCESS | PASS (read R1) |
| 6 | author | `record_statement(other, "the other side", U1)` | `FUTURE_COMMITMENT`, UNDERTAKING, RUNNING | `0x148034fd6a69fc0fb912a6b21f2fe9c0860ce4d28a30b7a3db73da0e9b4ad28b` | ACCEPTED · SUCCESS · EP `FUTURE_COMMITMENT` | PASS |
| 7 | other | `challenge(<U1 id>, "Not certified")` | revert *Nothing is asserted as at today; report a failure to perform instead* | `0x84e9eae71a55cc41b5afa74d738d3bf1c95fbcae5a108141009198e626d6f19c` | ERROR · `[rollback]` that sentence (validators agree) | PASS (expected revert) |
| 8 | other | `report_failure(<U1 id>, "Certificate lapsed")` | success, failure_count 1, RUNNING | `0xd39d1d751fa71cbabf07b3fe2b151ecf335f63b7ded6acd7365d361259f3882b` | ACCEPTED · SUCCESS (5/5 agree) | PASS |
| 9 | other | `report_failure(<U1 id>, "Still lapsed")` | success, failure_count 2, still RUNNING | `0x50fa57d8bf7fe2ad4841131e8cd3c13740a8fd8c515045c253617a50a7168c89` | ACCEPTED · SUCCESS | PASS (read R2) |
| 10 | other | `accept_statement(<U1 id>)` | revert *There is nothing to accept as at today; a forward promise stays open* | `0x6125951f0ca6f2d7f62648162b43506b15f18663255c399123fa451104994c7c` | ERROR · `[rollback]` that sentence (validators agree) | PASS (expected revert) |
| 11 | author, then other, then other | `record_statement(other, "the other side", P4)` → `accept_statement(<P4 id>)` → `challenge(<P4 id>, "Licence missing")` | `PRESENT_FACT`; ACCEPTED; revert *The window is closed* | record `0xec8c1cc606e4361bd40aa2de117c5da99930979087446af4d33e4792f5d44cb0` · accept `0x1c9468249777bbd1002b16b45beedc7d90ebde030dd17b7d20662742bdd635cd` · challenge `0xab787ed1da93c5490c83863c7c6a1cdebd9fca66008f160b22c120f6885ee959` | SUCCESS · EP `PRESENT_FACT`; SUCCESS; ERROR · `[rollback] The window is closed` (validators agree) | PASS (read R3) |
| 12 | author | `record_statement(other, "the other side", U4)` | `FUTURE_COMMITMENT` | `0x6cd46377eddd99d92626552c9a5b34c752b17b1c61bc405fd81be7a9b2993f77` | ACCEPTED · SUCCESS · EP `FUTURE_COMMITMENT` | PASS (read R4) |

P1 = `The equipment is fully certified.`
U1 = `The equipment will be kept fully certified.`
P4 = `Anyone who checks the register today will see that we hold the licences.`
U4 = `We will obtain any further licences the work requires.`

Run date 2026-10-04, GenLayer Studio, Normal (Full Consensus). 14 transactions, all as expected.

## Read-back (views, no transaction)

| # | View | Statement | Returned |
|---|---|---|---|
| R1 | `get_statement` | P1, after #5 | `PRESENT_FACT`, ASSERTION, **CHALLENGED**, challenge_note "Certificate lapsed in May", answer_note "Renewed on 2 June", remaining 0 |
| R2 | `get_statement` | U1, after #10 | `FUTURE_COMMITMENT`, UNDERTAKING, **RUNNING**, failure_count **2**, remaining 28, remedy "failure reports, up to 30, and no one can close this" |
| R3 | `get_statement` | P4, after #11 | `PRESENT_FACT`, ASSERTION, **ACCEPTED**, challenge_note empty, remaining 0 |
| R4 | `get_statement` | U4, after #12 | `FUTURE_COMMITMENT`, UNDERTAKING, RUNNING, failure_count 0, remaining 30 |

Statement ids (author `0x3065…b2d3`):
P1 `927f97b14079f2c0943e014405afda0110893c3d5edf86b847291d8b7ac39afe` ·
U1 `16fce5e94beffad6880dfede631502b025540e08bbc8d682c1fe0f1244bb80be` ·
P4 `283ef03a7ff49e8e00a5f3e43d152d7a50d36fd9fb237d4d11a40985fcd12d25` ·
U4 `404562c10a7382187d1c2387d320a6e5d4055779cdca724d0f272f6aa4172c43`

## Other transactions on this contract (not part of the table)

- `0xcde233c5e216f7496343340d215e608cfaa9cca3c40d365ee89a5c0f3b64cec6` — a `record_statement` sent with the first
  word of P1 missing (EP `PRESENT_FACT`); it is a different statement with a different id.
- `0xacd39348ce3ee7cbadabcf9de109d1bddf63de1cd5afe3fb565f1de9bc381700`,
  `0x6e1e2e128e2ac4c6b69ef65840365a68a462e447649bb48e8cbcdbab5607bfbf` — `report_failure` and `challenge` sent
  against the P1 id before P1 existed; both reverted *Unknown statement id*.
