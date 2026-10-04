# SECURITY

## Prompt fence

- The model sees only the rubric, the other side's label and the statement text, each inside its own tag
  (`<UNTRUSTED_OTHER_SIDE_LABEL>`, `<UNTRUSTED_STATEMENT_TEXT>`). It never sees wallets, the author's address,
  state, or what the contract does with the answer.
- Text or label containing a tag or an answer token (`PRESENT_FACT`, `FUTURE_COMMITMENT`), compared after
  upper-casing, is rejected before the model call.
- A fixed-point strip removes tokens until the string no longer changes, so nested fragments cannot rebuild one.
- Validators re-run the classification and must agree on the exact label. That checks agreement, not injection
  resistance; the fence does that. Disagreement reverts the whole transaction.

## Fail-safe

Unclear or unparseable output becomes `PRESENT_FACT`: the other side keeps one move instead of none. See
`LOCKED_SPEC.md`.

## Frontend

- MetaMask only signs; reads, receipts and the write client go through one same-origin proxy (`/genlayer-rpc`).
- No Snap request, no CDN code, no hard-coded wallet. React escapes all contract text.
- Success is reported only after the leader receipt says SUCCESS **and** the reloaded accepted state shows the change.

## Remaining limits

- Challenges, reports and answers are self-declared; nobody proves them.
- The author names the other side's wallet; two wallets are not proof of two people.
- No adversarial model run was done.
