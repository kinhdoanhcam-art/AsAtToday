export type Statement = {
  statement_id: string;
  author: string;
  other_wallet: string;
  other_label: string;
  text: string;
  outcome: "PRESENT_FACT" | "FUTURE_COMMITMENT" | string;
  kind: "ASSERTION" | "UNDERTAKING" | string;
  state: "OPEN" | "CHALLENGED" | "ACCEPTED" | "RUNNING" | string;
  challenge_note: string;
  answer_note: string;
  failure_count: number;
  remedy: string;
  remaining: number;
};

export type FailureReport = {
  index: number;
  note: string;
  answer: string;
};

export type TxPhase = "idle" | "checking" | "signing" | "submitted" | "delayed" | "success" | "error";

export type TxStatus = {
  phase: TxPhase;
  message: string;
  hash?: string;
};
