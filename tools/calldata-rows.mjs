// Shared rows for tools/calldata-bytes.mjs, tools/probe-calldata.mjs and tests.
export const OTHER = "0x" + "1".repeat(40);
export const LABEL = "the other side";
export const ID = "f".repeat(64);
export const NOTE60 = "n".repeat(60);

export const CASES = {
  P1: "The equipment is fully certified.",
  P2: "There is no litigation pending against us.",
  P3: "Our accounts have been audited every year since 2019.",
  P4: "Anyone who checks the register today will see that we hold the licences.",
  P5: "The figures given to you are drawn from the current ledger.",
  U1: "The equipment will be kept fully certified.",
  U2: "We undertake to notify you of any litigation that arises.",
  U3: "Our accounts are to be audited every year from now on.",
  U4: "We will obtain any further licences the work requires.",
  U5: "The figures are to be refreshed from the ledger each quarter.",
};

/** HARD BLOCK: any of these over 255 bytes stops the release. */
export function hardBlockRows() {
  const rows = Object.entries(CASES).map(([name, text]) => ({
    name: `record_statement ${name}`, method: "record_statement", args: [OTHER, LABEL, text],
  }));
  rows.push({ name: "challenge (id + 60-char note)", method: "challenge", args: [ID, NOTE60] });
  rows.push({ name: "report_failure (id + 60-char note)", method: "report_failure", args: [ID, NOTE60] });
  rows.push({ name: "accept_statement (id)", method: "accept_statement", args: [ID] });
  rows.push({ name: "answer (id + index 30 + 60-char note)", method: "answer", args: [ID, 30, NOTE60] });
  return rows;
}

/** MEASURE ONLY: the contract caps are wider than the proven path. */
export function measureOnlyRows() {
  return [
    { name: "record_statement at max label 80 + max text 600", method: "record_statement", args: [OTHER, "l".repeat(80), "t".repeat(600)] },
  ];
}
