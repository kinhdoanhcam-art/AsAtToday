# TEST_PLAN

## Semantic cases (label `the other side`)

| Case | Text | Expected |
|---|---|---|
| P1 | The equipment is fully certified. | PRESENT_FACT |
| P2 | There is no litigation pending against us. | PRESENT_FACT |
| P3 | Our accounts have been audited every year since 2019. | PRESENT_FACT |
| P4 | Anyone who checks the register today will see that we hold the licences. | PRESENT_FACT |
| P5 | The figures given to you are drawn from the current ledger. | PRESENT_FACT |
| U1 | The equipment will be kept fully certified. | FUTURE_COMMITMENT |
| U2 | We undertake to notify you of any litigation that arises. | FUTURE_COMMITMENT |
| U3 | Our accounts are to be audited every year from now on. | FUTURE_COMMITMENT |
| U4 | We will obtain any further licences the work requires. | FUTURE_COMMITMENT |
| U5 | The figures are to be refreshed from the ledger each quarter. | FUTURE_COMMITMENT |

Adversarial pairs — same surface, opposite label:

| Pair | Shared surface | Why opposite |
|---|---|---|
| **P4 / U4** | P4 contains "will", the very token a tense filter would catch | P4 is about the register **today**; U4 is about licences still to obtain |
| **P1 / U1** | the same sentence, one tense apart | P1 asserts; U1 commits to keep |
| **P3 / U3** | the audit history | P3 says it happened; U3 says it will happen from now on |
| P5 / U5 | the same figures and the same ledger | P5 says where the figures come from now; U5 says they will be refreshed |
| P2 / U2 | litigation | P2 states there is none; U2 commits to notify |

Classification:

- **Kill tests** (the rubric suggests no mechanism): P4/U4, P1/U1, P3/U3, P5/U5.
- **Definition check**: P2/U2 — "there is no …" and "we undertake to …" read straight off the rubric's definitions.

`python3 FACTORPROMISE_KILLSET_CHECK.py contracts/FactOrPromise.py` → `NO LEAK` (no word or word pair separates the
two classes) and `PASS` (the rubric shares no content word with any case). The gate does not stem; the rubric was
also read by eye: no *will*, *undertake*, *keep*, *obtain* or *refresh*, and it names none of the case topics
(equipment, litigation, audits, licences, figures), never mentions tense, and never says that a sentence with a
forward-looking verb can still be about the present.

## Deterministic cases (automated, `tests/contract/test_factorpromise.py`)

| Case | Test |
|---|---|
| the other side cannot be the author | `test_revert_other_side_is_author` |
| duplicate text, including whitespace variants | `test_revert_duplicate_statement`, `test_whitespace_variants_share_one_id` |
| a stranger calls challenge / report / accept / answer | `test_revert_challenge_not_other_side`, `test_revert_report_not_other_side`, `test_revert_accept_not_other_side`, `test_revert_answer_not_author` |
| the author calls challenge / report / accept | the same three tests (author and stranger) |
| the other side calls answer | `test_revert_answer_not_author` |
| challenge twice | `test_revert_already_challenged` |
| challenge after ACCEPTED | `test_revert_window_closed` |
| accept twice | `test_revert_already_accepted` |
| answer an assertion with no challenge / with index ≠ 0 / twice | `test_revert_no_challenge_to_answer`, `test_revert_answer_wrong_index_on_assertion`, `test_revert_challenge_already_answered` |
| answer an undertaking with index 0 or > failure_count | `test_revert_no_such_report` |
| answer the same report twice | `test_revert_report_already_answered` |
| report when the ledger is full; it stays RUNNING | `test_revert_no_room_for_reports`, `test_full_ledger_stays_running` |
| `remaining` in all four situations | `test_remaining_in_four_situations` |
| `remedy` strings | `test_remedy_strings` |
| reserved token in text or label | `test_revert_reserved_token` |
| wallet case and id case normalized | `test_wallet_case_normalized` |
| the two pairs of teeth | `test_pair_one_methods_swap_places`, `test_pair_two_one_move_versus_never_closes` |
| an answer never changes state | `test_answer_never_changes_state_and_never_reopens` |
| counters are per statement | `test_counters_are_scoped_per_statement` |
| the on-chain table replayed in order | `test_runtime_table_in_order` |
| every revert string has exactly one dedicated test | `test_every_revert_string_has_exactly_one_dedicated_test` |

## Frontend cases (automated, `tests/js/`)

- every disabled-button sentence equals a contract revert string, in the contract's check order (`rules.test.ts`);
- the remedy line uses `failure_count`, and the two Accept sentences stay different;
- postconditions on reloaded state for every write (`verify.test.ts`);
- `pyStrip` / `pyLen` / whitespace parity against real Python, including U+001C–U+001F and U+0085 (`pytext.test.ts`);
- local ids equal the contract's ids (`ids.test.ts`, vectors from `tests/contract/test_id_vectors.py`);
- receipt rule and revert extraction (`receipt.test.ts`); calldata sizes (`calldata.test.ts`);
- repository rules: no Snap connect, no CDN keccak, proxy declared twice, no hard-coded wallet, no seed data (`static.test.ts`).
