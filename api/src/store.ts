import type { Address, Hex } from "viem";

export interface VaultRecord {
  vaultAddress: Address;
  ownerAddress: Address;
  sessionKeyAddress: Address;
  createdAt: string;
  deployTxHash: Hex;
  policy: {
    validAfter: number;
    validUntil: number;
    nativeSpendCap: string;
    maxTxCount: string;
    initialTarget?: Address;
    initialSelector?: Hex;
  };
}

/// In-memory registry of vaults this API instance has created. This is a convenience index, not a
/// source of truth — PolicyValidator's on-chain storage is authoritative for every field that
/// matters (budget, expiry, revocation), and is re-read live on every status request. Losing this
/// map on restart loses the ability to *list* vaults by owner, not the vaults themselves or their
/// enforcement; a production deployment would back this with Postgres/SQLite, keyed off
/// `ActionValidated`/deployment logs rather than trusting in-process memory.
const vaults = new Map<Address, VaultRecord>();

export function saveVault(record: VaultRecord) {
  vaults.set(record.vaultAddress.toLowerCase() as Address, record);
}

export function getVault(address: Address): VaultRecord | undefined {
  return vaults.get(address.toLowerCase() as Address);
}

export function listVaults(): VaultRecord[] {
  return Array.from(vaults.values());
}
