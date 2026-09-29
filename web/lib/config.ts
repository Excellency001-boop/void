export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);
export const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_EXPLORER_BASE ?? "https://sepolia.basescan.org";

export function explorerAddressUrl(address: string) {
  return `${EXPLORER_BASE}/address/${address}`;
}

export function explorerTxUrl(hash: string) {
  return `${EXPLORER_BASE}/tx/${hash}`;
}
