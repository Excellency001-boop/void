import { CHAIN_ID } from "@/lib/config";

const CHAIN_NAMES: Record<number, string> = {
  84532: "Base Sepolia",
  8453: "Base",
  421614: "Arbitrum Sepolia",
  31337: "Local Anvil",
};

export function ChainBadge() {
  const name = CHAIN_NAMES[CHAIN_ID] ?? `Chain ${CHAIN_ID}`;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-void-border bg-void-raised px-2.5 py-1 text-[11px] font-medium text-void-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-void-accent" />
      {name}
    </span>
  );
}
