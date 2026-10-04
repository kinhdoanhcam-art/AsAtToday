import { keccak256, stringToBytes } from "viem";
import { pyLen, pyNormalize, pyStrip } from "./pytext.ts";

// Keccak-256 (Ethereum), not NIST SHA3-256. Same payload as the contract.
export function statementId(authorWallet: string, text: string): string {
  const normalized = pyNormalize(pyStrip(text));
  const payload = "FACT_OR_PROMISE:STATEMENT:V1|" + authorWallet.toLowerCase() + "|" + String(pyLen(normalized)) + "|" + normalized;
  return keccak256(stringToBytes(payload)).slice(2);
}

export function short(value: string, head = 6, tail = 4): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
