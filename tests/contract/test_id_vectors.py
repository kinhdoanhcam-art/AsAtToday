"""
Golden id vectors shared with the frontend (tests/js/ids.test.ts reads the same
file). Ids are computed by the contract code itself on the real SDK Keccak256.

Regenerate:  WRITE_VECTORS=1 python3 -m pytest tests/contract/test_id_vectors.py
"""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VECTORS = ROOT / "tests" / "js" / "id-vectors.json"
CONTRACT = str(ROOT / "contracts" / "FactOrPromise.py")

AUTHOR = "0x923a09d0d6e5c242e36c3c1d2071835917cc0bdf"
TEXTS = [
    "The equipment is fully certified.",
    "The equipment will be kept fully certified.",
    "Anyone who checks the register today will see that we hold the licences.",
    "We will obtain any further licences the work requires.",
    "  The figures given\tto you\nare drawn from the current ledger.  ",
    "\u001cThere is no litigation pending against us.\u001f",
    "Our\u0085accounts\u001dare to be\u001eaudited every year from now on.",
    "﻿The register is current.",
    "Équipement certifié — each　item on its own. \U0001F4C4",
]


def build(contract):
    rows = []
    for t in TEXTS:
        norm = contract._normalize_text(t.strip())
        rows.append({"text": t, "normalized": norm, "py_len": len(norm),
                     "statement_id": contract._statement_id_for(AUTHOR, norm)})
    return {"author": AUTHOR, "statements": rows}


def test_vectors_match_contract(direct_deploy):
    data = build(direct_deploy(CONTRACT))
    if os.environ.get("WRITE_VECTORS") == "1":
        VECTORS.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    assert json.loads(VECTORS.read_text(encoding="utf-8")) == data
