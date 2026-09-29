import { formatEther, parseEther } from "viem";

export function truncateAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

export function weiToEthDisplay(wei: string | bigint, maxDecimals = 6): string {
  const eth = formatEther(typeof wei === "string" ? BigInt(wei) : wei);
  const [whole, frac = ""] = eth.split(".");
  const trimmed = frac.slice(0, maxDecimals).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function ethToWei(eth: string): string {
  return parseEther(eth || "0").toString();
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "expired";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function formatTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function pctOf(part: string | bigint, whole: string | bigint): number {
  const p = typeof part === "string" ? BigInt(part) : part;
  const w = typeof whole === "string" ? BigInt(whole) : whole;
  if (w === 0n) return 0;
  return Math.min(100, Number((p * 10000n) / w) / 100);
}
