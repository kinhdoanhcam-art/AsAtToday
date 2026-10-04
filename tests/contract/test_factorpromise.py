"""
Deterministic tests for contracts/FactOrPromise.py, run in GenLayer Direct Mode
(genlayer-test: the real py-genlayer SDK with storage, TreeMap, Keccak256 and
gl.vm.UserError; the model is mocked).

The mocked labels are ASSUMED labels that drive the deterministic code paths.
They say nothing about what the real model returns; RUNTIME_EVIDENCE.md does.

Run:  python3 -m pytest tests/contract -q
"""

import ast
import json
import re
from pathlib import Path

import pytest
from gltest.direct.loader import create_address

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = str(ROOT / "contracts" / "FactOrPromise.py")
LABEL = "the other side"

P1 = "The equipment is fully certified."
P2 = "There is no litigation pending against us."
P3 = "Our accounts have been audited every year since 2019."
P4 = "Anyone who checks the register today will see that we hold the licences."
P5 = "The figures given to you are drawn from the current ledger."
U1 = "The equipment will be kept fully certified."
U2 = "We undertake to notify you of any litigation that arises."
U3 = "Our accounts are to be audited every year from now on."
U4 = "We will obtain any further licences the work requires."
U5 = "The figures are to be refreshed from the ledger each quarter."

ASSUMED_FUTURE = (U1, U2, U3, U4, U5)

M_CHALLENGE_UNDERTAKING = "Nothing is asserted as at today; report a failure to perform instead"
M_REPORT_ASSERTION = "This is asserted as at today; challenge it instead of reporting a failure"
M_ACCEPT_UNDERTAKING = "There is nothing to accept as at today; a forward promise stays open"
M_WINDOW_CLOSED = "The window is closed"
M_ALREADY_CHALLENGED = "This statement has already been challenged"


def hx(addr):
    return addr.as_hex if hasattr(addr, "as_hex") else str(addr)


def lo(addr):
    return hx(addr).lower()


def J(raw):
    return json.loads(raw)


@pytest.fixture
def env(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    author = create_address("author")
    other = create_address("other")
    stranger = create_address("stranger")
    for text in ASSUMED_FUTURE:
        direct_vm.mock_llm(re.escape(text), '{"outcome":"FUTURE_COMMITMENT"}')
    direct_vm.mock_llm(r"(?s).*", '{"outcome":"PRESENT_FACT"}')
    direct_vm.sender = author
    return direct_vm, contract, author, other, stranger


def as_(vm, who):
    vm.sender = who


def sid_for(contract, author, text):
    return contract._statement_id_for(lo(author), " ".join(text.split()))


def record(vm, contract, author, other, text, label=LABEL):
    as_(vm, author)
    contract.record_statement(hx(other), label, text)
    return sid_for(contract, author, text)


def st(contract, sid):
    return J(contract.get_statement(sid))


# ---------------------------------------------------------------------
# The concept: one reading fixes how many times, and who can close the door
# ---------------------------------------------------------------------

def test_record_assertion_and_undertaking(env):
    vm, contract, author, other, _ = env
    a = st(contract, record(vm, contract, author, other, P1))
    u = st(contract, record(vm, contract, author, other, U1))
    assert (a["outcome"], a["kind"], a["state"]) == ("PRESENT_FACT", "ASSERTION", "OPEN")
    assert (u["outcome"], u["kind"], u["state"]) == ("FUTURE_COMMITMENT", "UNDERTAKING", "RUNNING")
    assert a["author"] == lo(author) and a["other_wallet"] == lo(other) and a["other_label"] == LABEL
    assert (a["challenge_note"], a["answer_note"], a["failure_count"]) == ("", "", 0)


def test_pair_one_methods_swap_places(env):
    # The same other side, two sentences one tense apart: what reverts on one
    # record runs on the other, and the reverse (runtime rows #2/#3/#7/#8).
    vm, contract, author, other, _ = env
    a = record(vm, contract, author, other, P1)
    u = record(vm, contract, author, other, U1)
    as_(vm, other)
    with vm.expect_revert(M_REPORT_ASSERTION):
        contract.report_failure(a, "Not certified")
    contract.challenge(a, "Certificate lapsed in May")
    with vm.expect_revert(M_CHALLENGE_UNDERTAKING):
        contract.challenge(u, "Not certified")
    contract.report_failure(u, "Certificate lapsed")
    assert st(contract, a)["state"] == "CHALLENGED"
    assert (st(contract, u)["state"], st(contract, u)["failure_count"]) == ("RUNNING", 1)


def test_pair_two_one_move_versus_never_closes(env):
    vm, contract, author, other, _ = env
    a = record(vm, contract, author, other, P4)
    u = record(vm, contract, author, other, U4)
    as_(vm, other)
    contract.accept_statement(a)
    with vm.expect_revert(M_WINDOW_CLOSED):
        contract.challenge(a, "Too late")
    with vm.expect_revert(M_ACCEPT_UNDERTAKING):
        contract.accept_statement(u)
    for k in range(1, 6):
        contract.report_failure(u, f"Missed {k}")
    s = st(contract, u)
    assert (s["state"], s["failure_count"], s["remaining"]) == ("RUNNING", 5, 25)


def test_runtime_table_in_order(env):
    # Rows #1-#12 of the IC runtime table, with the mocked labels.
    vm, contract, author, other, _ = env
    p1 = record(vm, contract, author, other, P1)                      # 1
    as_(vm, other)
    with vm.expect_revert(M_REPORT_ASSERTION):                        # 2
        contract.report_failure(p1, "Not certified")
    contract.challenge(p1, "Certificate lapsed in May")               # 3
    with vm.expect_revert(M_ALREADY_CHALLENGED):                      # 4
        contract.accept_statement(p1)
    as_(vm, author)
    contract.answer(p1, 0, "Renewed on 2 June")                       # 5
    s = st(contract, p1)
    assert (s["state"], s["challenge_note"], s["answer_note"]) == ("CHALLENGED", "Certificate lapsed in May", "Renewed on 2 June")
    u1 = record(vm, contract, author, other, U1)                      # 6
    as_(vm, other)
    with vm.expect_revert(M_CHALLENGE_UNDERTAKING):                   # 7
        contract.challenge(u1, "Not certified")
    contract.report_failure(u1, "Certificate lapsed")                 # 8
    contract.report_failure(u1, "Still lapsed")                       # 9
    with vm.expect_revert(M_ACCEPT_UNDERTAKING):                      # 10
        contract.accept_statement(u1)
    assert (st(contract, u1)["state"], st(contract, u1)["failure_count"]) == ("RUNNING", 2)
    p4 = record(vm, contract, author, other, P4)                      # 11
    as_(vm, other)
    contract.accept_statement(p4)
    with vm.expect_revert(M_WINDOW_CLOSED):
        contract.challenge(p4, "Licence missing")
    assert st(contract, p4)["state"] == "ACCEPTED"
    u4 = record(vm, contract, author, other, U4)                      # 12
    assert st(contract, u4)["kind"] == "UNDERTAKING"


def test_answer_never_changes_state_and_never_reopens(env):
    vm, contract, author, other, _ = env
    a = record(vm, contract, author, other, P1)
    as_(vm, other)
    contract.challenge(a, "Lapsed")
    as_(vm, author)
    contract.answer(a, 0, "Renewed")
    as_(vm, other)
    with vm.expect_revert(M_ALREADY_CHALLENGED):
        contract.challenge(a, "Again")
    with vm.expect_revert(M_ALREADY_CHALLENGED):
        contract.accept_statement(a)
    u = record(vm, contract, author, other, U1)
    as_(vm, other)
    contract.report_failure(u, "Lapsed")
    as_(vm, author)
    contract.answer(u, 1, "Renewed")
    s = st(contract, u)
    assert (s["state"], s["failure_count"], s["remaining"]) == ("RUNNING", 1, 29)
    assert J(contract.get_failure(u, 1)) == {"index": 1, "note": "Lapsed", "answer": "Renewed"}


def test_full_ledger_stays_running(env):
    vm, contract, author, other, _ = env
    u = record(vm, contract, author, other, U2)
    as_(vm, other)
    for k in range(30):
        contract.report_failure(u, f"r{k + 1}")
    s = st(contract, u)
    assert (s["state"], s["failure_count"], s["remaining"]) == ("RUNNING", 30, 0)
    as_(vm, author)
    contract.answer(u, 30, "ok")
    assert J(contract.get_failure(u, 30))["answer"] == "ok"


def test_counters_are_scoped_per_statement(env):
    vm, contract, author, other, _ = env
    u1 = record(vm, contract, author, other, U1)
    u3 = record(vm, contract, author, other, U3)
    as_(vm, other)
    contract.report_failure(u1, "a")
    contract.report_failure(u1, "b")
    contract.report_failure(u3, "c")
    assert st(contract, u1)["failure_count"] == 2 and st(contract, u3)["failure_count"] == 1
    assert J(contract.get_failure(u3, 1))["note"] == "c"
    assert contract.get_failure(u3, 2) == "{}"


# ---------------------------------------------------------------------
# remaining / remedy in every situation
# ---------------------------------------------------------------------

def test_remaining_in_four_situations(env):
    vm, contract, author, other, _ = env
    a_open = record(vm, contract, author, other, P1)
    a_ch = record(vm, contract, author, other, P2)
    a_acc = record(vm, contract, author, other, P3)
    u = record(vm, contract, author, other, U5)
    assert st(contract, a_open)["remaining"] == 1
    assert st(contract, u)["remaining"] == 30
    as_(vm, other)
    contract.challenge(a_ch, "x")
    contract.accept_statement(a_acc)
    for k in range(3):
        contract.report_failure(u, "y")
    assert st(contract, a_open)["remaining"] == 1
    assert st(contract, a_ch)["remaining"] == 0
    assert st(contract, a_acc)["remaining"] == 0
    assert st(contract, u)["remaining"] == 27


def test_remedy_strings(env):
    vm, contract, author, other, _ = env
    a = record(vm, contract, author, other, P5)
    u = record(vm, contract, author, other, U5)
    assert st(contract, a)["remedy"] == "one move: challenge or accept; either one closes this"
    assert st(contract, u)["remedy"] == "failure reports, up to 30, and no one can close this"
    as_(vm, other)
    contract.accept_statement(a)
    assert st(contract, a)["remedy"] == "one move: challenge or accept; either one closes this"


# ---------------------------------------------------------------------
# Ids, normalization, fail-safe, validator, fence
# ---------------------------------------------------------------------

def test_whitespace_variants_share_one_id(env):
    vm, contract, author, other, _ = env
    record(vm, contract, author, other, P1)
    for variant in ("The  equipment is\tfully\ncertified.", "  The equipment\u001cis fully certified.  ",
                    "The\u0085equipment is fully certified."):
        assert sid_for(contract, author, variant) == sid_for(contract, author, P1)
        with vm.expect_revert("This statement already exists"):
            contract.record_statement(hx(other), LABEL, variant)


def test_stored_text_is_stripped_original(env):
    vm, contract, author, other, _ = env
    sid = record(vm, contract, author, other, "  The equipment  is fully certified.  ")
    assert st(contract, sid)["text"] == "The equipment  is fully certified."


def test_same_text_other_author_is_a_new_statement(env):
    vm, contract, author, other, stranger = env
    a = record(vm, contract, author, other, P1)
    b = record(vm, contract, stranger, other, P1)
    assert a != b and st(contract, b)["author"] == lo(stranger)


def test_local_id_formula_matches_contract(env):
    from eth_hash.auto import keccak
    vm, contract, author, *_ = env
    norm = " ".join(P4.split())
    payload = "FACT_OR_PROMISE:STATEMENT:V1|" + lo(author) + "|" + str(len(norm)) + "|" + norm
    assert keccak(payload.encode("utf-8")).hex() == contract._statement_id_for(lo(author), norm)


def test_wallet_case_normalized(env):
    vm, contract, author, other, _ = env
    as_(vm, author)
    contract.record_statement("  " + hx(other).upper().replace("0X", "0x") + " ", LABEL, P1)
    sid = sid_for(contract, author, P1)
    assert st(contract, sid)["other_wallet"] == lo(other)
    as_(vm, other)
    contract.challenge("0x" + sid.upper(), "Lapsed")
    assert st(contract, sid)["state"] == "CHALLENGED"


def test_fail_safe_on_unparseable_output(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    author, other = create_address("author"), create_address("other")
    direct_vm.mock_llm(r"(?s).*", "not json at all")
    direct_vm.sender = author
    contract.record_statement(hx(other), LABEL, U1)
    s = J(contract.get_statement(sid_for(contract, author, U1)))
    assert (s["outcome"], s["kind"], s["state"]) == ("PRESENT_FACT", "ASSERTION", "OPEN")


def test_fail_safe_on_unknown_label(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    author, other = create_address("author"), create_address("other")
    direct_vm.mock_llm(r"(?s).*", '{"outcome":"MAYBE"}')
    direct_vm.sender = author
    contract.record_statement(hx(other), LABEL, U1)
    assert J(contract.get_statement(sid_for(contract, author, U1)))["kind"] == "ASSERTION"


def test_fenced_json_output_is_parsed(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    author, other = create_address("author"), create_address("other")
    direct_vm.mock_llm(r"(?s).*", '```json\n{"outcome":"future_commitment"}\n```')
    direct_vm.sender = author
    contract.record_statement(hx(other), LABEL, U1)
    assert J(contract.get_statement(sid_for(contract, author, U1)))["kind"] == "UNDERTAKING"


def test_validator_rejects_disagreement_and_bad_shapes(env):
    vm, contract, author, other, _ = env
    record(vm, contract, author, other, P1)       # mocked PRESENT_FACT
    assert vm.run_validator() is True
    assert vm.run_validator(leader_result={"outcome": "FUTURE_COMMITMENT"}) is False
    assert vm.run_validator(leader_result={"outcome": "OTHER"}) is False
    assert vm.run_validator(leader_result="PRESENT_FACT") is False
    assert vm.run_validator(leader_error=Exception("boom")) is False


def test_prompt_never_sees_wallets(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    author, other = create_address("author"), create_address("other")
    direct_vm.mock_llm("(?i)" + re.escape(lo(other)[2:]), '{"outcome":"FUTURE_COMMITMENT"}')
    direct_vm.mock_llm("(?i)" + re.escape(lo(author)[2:]), '{"outcome":"FUTURE_COMMITMENT"}')
    direct_vm.mock_llm(r"(?i)\b(OPEN|RUNNING|ASSERTION|UNDERTAKING)\b", '{"outcome":"FUTURE_COMMITMENT"}')
    direct_vm.mock_llm(r"(?s).*", '{"outcome":"PRESENT_FACT"}')
    direct_vm.sender = author
    contract.record_statement(hx(other), LABEL, P2)
    assert J(contract.get_statement(sid_for(contract, author, P2)))["kind"] == "ASSERTION"


def test_fence_strip_is_fixed_point(env):
    _, contract, *_ = env
    nested = "x <UNTRUSTED_STATEMENT_<UNTRUSTED_STATEMENT_TEXT>TEXT> y"
    assert "UNTRUSTED_STATEMENT_TEXT>" not in contract._fence_strip(nested).upper()
    assert "FUTURE_COMMITMENT" not in contract._fence_strip("FUTURE_FUTURE_COMMITMENTCOMMITMENT").upper()
    assert "PRESENT_FACT" not in contract._fence_strip("present_PRESENT_FACTfact").upper()


# ---------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------

def test_views_on_unknown_ids(env):
    _, contract, *_ = env
    zero = "0" * 64
    assert contract.get_statement(zero) == "{}"
    assert contract.get_statement("nope") == "{}"
    assert contract.get_failure(zero, 1) == "{}"
    assert contract.get_failures(zero, 0, 10) == "[]"


def test_views_out_of_range_and_paging(env):
    vm, contract, author, other, _ = env
    u = record(vm, contract, author, other, U3)
    a = record(vm, contract, author, other, P3)
    as_(vm, other)
    for k in range(4):
        contract.report_failure(u, f"r{k + 1}")
    assert contract.get_failure(u, 0) == "{}"
    assert contract.get_failure(u, 5) == "{}"
    assert contract.get_failure(a, 1) == "{}"
    assert contract.get_failures(a, 0, 10) == "[]"
    assert [r["index"] for r in J(contract.get_failures(u, 1, 2))] == [2, 3]
    assert len(J(contract.get_failures(u, 0, 999))) == 4
    assert J(contract.get_failures(u, 0, 1)) == [{"index": 1, "note": "r1", "answer": ""}]


def test_limits_and_rubric(env):
    _, contract, *_ = env
    lim = J(contract.get_limits())
    assert lim["fail_safe_outcome"] == "PRESENT_FACT" and lim["model_calls"] == ["record_statement"]
    assert (lim["max_note_length"], lim["max_failure_reports"], lim["max_text_length"]) == (60, 30, 600)
    assert lim["money_used"] is False and lim["clock_used"] is False
    assert contract.get_rubric().startswith("You are a GenLayer validator performing one narrow semantic classification")


def test_no_forbidden_constructs_in_source():
    src = Path(CONTRACT).read_text(encoding="utf-8")
    for name in re.findall(r"def\s+(\w+)", src):
        assert not re.match(r"(preview_|classify_|dry_run_|set_kind|reopen|close_|withdraw)", name), name
    for api in ("emit_transfer", "gl.evm", "web.render", "time.time", "datetime", "payable", "WINDOW_SECONDS"):
        assert api not in src, api
    assert src.count("exec_prompt") == 1
    assert src.splitlines()[0] == "# v0.2.16"
    # kind is written only when the record is created
    assert len(re.findall(r"\.kind\s*=(?!=)", src)) == 0
    # one challenge field, many failure notes
    assert "challenge_note: str" in src and "failure_note: TreeMap[str, str]" in src
    rubric = src.split('RUBRIC = """')[1].split('"""')[0]
    for word in ("will", "undertake", "keep", "obtain", "refresh"):
        assert not re.search(r"\b" + word + r"\b", rubric, re.I), word


def test_check_order(env):
    vm, contract, author, other, stranger = env
    a = record(vm, contract, author, other, P1)
    u = record(vm, contract, author, other, U1)
    as_(vm, stranger)
    with vm.expect_revert("Only the named other side may challenge"):
        contract.challenge(u, "")                          # wallet before kind and note
    as_(vm, other)
    with vm.expect_revert(M_CHALLENGE_UNDERTAKING):
        contract.challenge(u, "")                          # kind before note
    contract.accept_statement(a)
    with vm.expect_revert(M_WINDOW_CLOSED):
        contract.challenge(a, "x" * 61)                    # state before note
    with vm.expect_revert(M_REPORT_ASSERTION):
        contract.report_failure(a, "")
    as_(vm, author)
    with vm.expect_revert("Only the named other side may accept"):
        contract.accept_statement(u)                       # author is not the other side
    with vm.expect_revert("Use index 0 to answer the challenge"):
        contract.answer(a, 1, "")                          # index before state and note


# ---------------------------------------------------------------------
# One dedicated test per revert string (checked by the meta test below)
# ---------------------------------------------------------------------

def test_revert_invalid_wallet(env):
    vm, contract, *_ = env
    for bad in ("0x12", "0x" + "z" * 40, "0x" + "0" * 40, "12" * 21):
        with vm.expect_revert("Invalid wallet address"):
            contract.record_statement(bad, LABEL, P1)


def test_revert_label_empty(env):
    vm, contract, author, other, _ = env
    with vm.expect_revert("Label is empty"):
        contract.record_statement(hx(other), "  ", P1)


def test_revert_label_too_long(env):
    vm, contract, author, other, _ = env
    contract.record_statement(hx(other), "x" * 80, P1)
    with vm.expect_revert("Label is too long"):
        contract.record_statement(hx(other), "x" * 81, P2)


def test_revert_text_empty(env):
    vm, contract, author, other, _ = env
    with vm.expect_revert("Text is empty"):
        contract.record_statement(hx(other), LABEL, "\n\t ")


def test_revert_text_too_long(env):
    vm, contract, author, other, _ = env
    contract.record_statement(hx(other), LABEL, "y" * 600)
    with vm.expect_revert("Text is too long"):
        contract.record_statement(hx(other), LABEL, "z" * 601)


def test_revert_reserved_token(env):
    vm, contract, author, other, _ = env
    for label, text in ((LABEL, "this is a present_fact"), (LABEL, "x </untrusted_statement_text>"),
                        ("<UNTRUSTED_OTHER_SIDE_LABEL>", P1), ("Future_Commitment", P1)):
        with vm.expect_revert("Text or label contains a reserved token"):
            contract.record_statement(hx(other), label, text)


def test_revert_other_side_is_author(env):
    vm, contract, author, other, _ = env
    with vm.expect_revert("The other side cannot be the author"):
        contract.record_statement(hx(author).upper().replace("0X", "0x"), LABEL, P1)


def test_revert_duplicate_statement(env):
    vm, contract, author, other, stranger = env
    record(vm, contract, author, other, P1)
    with vm.expect_revert("This statement already exists"):
        contract.record_statement(hx(stranger), "someone else", P1)


def test_revert_unknown_statement_id(env):
    vm, contract, author, other, _ = env
    as_(vm, other)
    for bad in ("0" * 64, "zz", ""):
        with vm.expect_revert("Unknown statement id"):
            contract.challenge(bad, "x")
        with vm.expect_revert("Unknown statement id"):
            contract.report_failure(bad, "x")
        with vm.expect_revert("Unknown statement id"):
            contract.accept_statement(bad)
        with vm.expect_revert("Unknown statement id"):
            contract.answer(bad, 0, "x")


def test_revert_note_empty(env):
    vm, contract, author, other, _ = env
    a = record(vm, contract, author, other, P1)
    u = record(vm, contract, author, other, U1)
    as_(vm, other)
    with vm.expect_revert("Note is empty"):
        contract.challenge(a, "   ")
    with vm.expect_revert("Note is empty"):
        contract.report_failure(u, "")
    contract.challenge(a, "Lapsed")
    contract.report_failure(u, "Lapsed")
    as_(vm, author)
    with vm.expect_revert("Note is empty"):
        contract.answer(a, 0, " ")
    with vm.expect_revert("Note is empty"):
        contract.answer(u, 1, "")


def test_revert_note_too_long(env):
    vm, contract, author, other, _ = env
    a = record(vm, contract, author, other, P1)
    u = record(vm, contract, author, other, U1)
    as_(vm, other)
    with vm.expect_revert("Note is too long"):
        contract.challenge(a, "n" * 61)
    with vm.expect_revert("Note is too long"):
        contract.report_failure(u, "n" * 61)
    contract.challenge(a, "n" * 60)
    contract.report_failure(u, "n" * 60)
    as_(vm, author)
    with vm.expect_revert("Note is too long"):
        contract.answer(a, 0, "n" * 61)
    with vm.expect_revert("Note is too long"):
        contract.answer(u, 1, "n" * 61)


def test_revert_challenge_not_other_side(env):
    vm, contract, author, other, stranger = env
    a = record(vm, contract, author, other, P1)
    for who in (author, stranger):
        as_(vm, who)
        with vm.expect_revert("Only the named other side may challenge"):
            contract.challenge(a, "x")


def test_revert_challenge_on_undertaking(env):
    vm, contract, author, other, _ = env
    u = record(vm, contract, author, other, U1)
    as_(vm, other)
    with vm.expect_revert(M_CHALLENGE_UNDERTAKING):
        contract.challenge(u, "Not certified")
    contract.report_failure(u, "x")
    with vm.expect_revert(M_CHALLENGE_UNDERTAKING):
        contract.challenge(u, "Not certified")


def test_revert_already_challenged(env):
    vm, contract, author, other, _ = env
    a = record(vm, contract, author, other, P1)
    as_(vm, other)
    contract.challenge(a, "Lapsed")
    with vm.expect_revert(M_ALREADY_CHALLENGED):
        contract.challenge(a, "Again")
    with vm.expect_revert(M_ALREADY_CHALLENGED):
        contract.accept_statement(a)
    assert st(contract, a)["challenge_note"] == "Lapsed"


def test_revert_window_closed(env):
    vm, contract, author, other, _ = env
    a = record(vm, contract, author, other, P4)
    as_(vm, other)
    contract.accept_statement(a)
    with vm.expect_revert(M_WINDOW_CLOSED):
        contract.challenge(a, "Licence missing")
    assert (st(contract, a)["state"], st(contract, a)["challenge_note"]) == ("ACCEPTED", "")


def test_revert_report_not_other_side(env):
    vm, contract, author, other, stranger = env
    u = record(vm, contract, author, other, U1)
    for who in (author, stranger):
        as_(vm, who)
        with vm.expect_revert("Only the named other side may report a failure"):
            contract.report_failure(u, "x")


def test_revert_report_on_assertion(env):
    vm, contract, author, other, _ = env
    a = record(vm, contract, author, other, P1)
    as_(vm, other)
    with vm.expect_revert(M_REPORT_ASSERTION):
        contract.report_failure(a, "Not certified")
    contract.accept_statement(a)
    with vm.expect_revert(M_REPORT_ASSERTION):
        contract.report_failure(a, "Not certified")


def test_revert_no_room_for_reports(env):
    vm, contract, author, other, _ = env
    u = record(vm, contract, author, other, U1)
    as_(vm, other)
    for k in range(30):
        contract.report_failure(u, "r")
    with vm.expect_revert("No room for further reports"):
        contract.report_failure(u, "one more")
    assert st(contract, u)["state"] == "RUNNING"


def test_revert_accept_not_other_side(env):
    vm, contract, author, other, stranger = env
    a = record(vm, contract, author, other, P1)
    for who in (author, stranger):
        as_(vm, who)
        with vm.expect_revert("Only the named other side may accept"):
            contract.accept_statement(a)
    assert st(contract, a)["state"] == "OPEN"


def test_revert_accept_on_undertaking(env):
    vm, contract, author, other, _ = env
    u = record(vm, contract, author, other, U1)
    as_(vm, other)
    with vm.expect_revert(M_ACCEPT_UNDERTAKING):
        contract.accept_statement(u)
    assert st(contract, u)["state"] == "RUNNING"


def test_revert_already_accepted(env):
    vm, contract, author, other, _ = env
    a = record(vm, contract, author, other, P1)
    as_(vm, other)
    contract.accept_statement(a)
    with vm.expect_revert("This statement has already been accepted"):
        contract.accept_statement(a)


def test_revert_answer_not_author(env):
    vm, contract, author, other, stranger = env
    a = record(vm, contract, author, other, P1)
    as_(vm, other)
    contract.challenge(a, "Lapsed")
    for who in (other, stranger):
        as_(vm, who)
        with vm.expect_revert("Only the author may answer"):
            contract.answer(a, 0, "x")


def test_revert_answer_wrong_index_on_assertion(env):
    vm, contract, author, other, _ = env
    a = record(vm, contract, author, other, P1)
    as_(vm, other)
    contract.challenge(a, "Lapsed")
    as_(vm, author)
    for idx in (1, -1, 2):
        with vm.expect_revert("Use index 0 to answer the challenge"):
            contract.answer(a, idx, "x")


def test_revert_no_challenge_to_answer(env):
    vm, contract, author, other, _ = env
    a = record(vm, contract, author, other, P1)
    b = record(vm, contract, author, other, P2)
    as_(vm, other)
    contract.accept_statement(b)
    as_(vm, author)
    with vm.expect_revert("There is no challenge to answer"):
        contract.answer(a, 0, "x")
    with vm.expect_revert("There is no challenge to answer"):
        contract.answer(b, 0, "x")


def test_revert_challenge_already_answered(env):
    vm, contract, author, other, _ = env
    a = record(vm, contract, author, other, P1)
    as_(vm, other)
    contract.challenge(a, "Lapsed")
    as_(vm, author)
    contract.answer(a, 0, "Renewed")
    with vm.expect_revert("This challenge has already been answered"):
        contract.answer(a, 0, "Changed my mind")
    assert st(contract, a)["answer_note"] == "Renewed"


def test_revert_no_such_report(env):
    vm, contract, author, other, _ = env
    u = record(vm, contract, author, other, U1)
    as_(vm, author)
    with vm.expect_revert("No such report"):
        contract.answer(u, 1, "x")
    as_(vm, other)
    contract.report_failure(u, "Lapsed")
    as_(vm, author)
    for idx in (0, 2, -1):
        with vm.expect_revert("No such report"):
            contract.answer(u, idx, "x")


def test_revert_report_already_answered(env):
    vm, contract, author, other, _ = env
    u = record(vm, contract, author, other, U1)
    as_(vm, other)
    contract.report_failure(u, "a")
    contract.report_failure(u, "b")
    as_(vm, author)
    contract.answer(u, 2, "fixed b")
    with vm.expect_revert("This report has already been answered"):
        contract.answer(u, 2, "again")
    contract.answer(u, 1, "fixed a")
    assert [r["answer"] for r in J(contract.get_failures(u, 0, 50))] == ["fixed a", "fixed b"]


# ---------------------------------------------------------------------
# Meta: every revert string in the source has exactly one dedicated test
# ---------------------------------------------------------------------

def source_revert_strings():
    src = Path(CONTRACT).read_text(encoding="utf-8")
    return set(re.findall(r'UserError\(\s*"([^"]+)"\s*\)', src))


def resolve(node):
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name):
        return globals().get(node.id)
    return None


def primary_revert_string_by_test():
    """The first expect_revert string inside a test_revert_* function is the string it owns."""
    tree = ast.parse(Path(__file__).read_text(encoding="utf-8"))
    owned = {}
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name.startswith("test_revert_"):
            calls = [c for c in ast.walk(node)
                     if isinstance(c, ast.Call) and getattr(c.func, "attr", "") == "expect_revert" and c.args]
            calls.sort(key=lambda c: (c.lineno, c.col_offset))
            owned[node.name] = resolve(calls[0].args[0]) if calls else None
    return owned


def test_every_revert_string_has_exactly_one_dedicated_test():
    strings = source_revert_strings()
    assert len(strings) == 27, sorted(strings)
    owned = primary_revert_string_by_test()
    assert None not in owned.values(), owned
    per_string = {}
    for test, s in owned.items():
        per_string.setdefault(s, []).append(test)
    assert sorted(set(per_string) - strings) == []
    assert sorted(strings - set(per_string)) == [], "revert strings without a dedicated test"
    for s, tests in per_string.items():
        assert len(tests) == 1, (s, tests)
