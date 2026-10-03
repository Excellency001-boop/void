"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { ApiError } from "@/lib/api";
import { useNetwork } from "@/lib/network-context";
import { DangerButton, SecondaryButton, TxLink, Label } from "@/components/ui";

export function RevokePanel({ vaultAddress, onRevoked }: { vaultAddress: string; onRevoked: () => void }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { api } = useNetwork();

  const [confirming, setConfirming] = useState(false);
  const [useManualKey, setUseManualKey] = useState(false);
  const [ownerKey, setOwnerKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function handleRevoke() {
    setBusy(true);
    setError(null);
    try {
      const { message } = await api.getRevokeMessage(vaultAddress);
      let signature: string;
      if (useManualKey) {
        const account = privateKeyToAccount(ownerKey as Hex);
        signature = await account.signMessage({ message: { raw: message as Hex } });
      } else {
        signature = await signMessageAsync({ message: { raw: message as Hex } });
      }
      const res = await api.revokeVault(vaultAddress, signature);
      setTxHash(res.txHash);
      onRevoked();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Revoke failed. Wrong owner key or signature?");
    } finally {
      setBusy(false);
    }
  }

  if (txHash) {
    return (
      <div className="rounded-sm border border-void-danger/30 bg-void-dangerDim/10 p-4 text-sm">
        <p className="font-medium text-void-danger">Session revoked.</p>
        <p className="mt-1 text-xs text-void-muted">
          <TxLink hash={txHash} />
        </p>
      </div>
    );
  }

  if (!confirming) {
    return (
      <DangerButton onClick={() => setConfirming(true)}>Force Revoke</DangerButton>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-void-danger/30 bg-void-dangerDim/5 p-4">
      <p className="text-sm text-void-text">
        This immediately and permanently blocks every future action from this session's key. Funds
        already in the vault are untouched. They stay under the owner's root key. This cannot be
        undone.
      </p>

      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => setUseManualKey(false)}
          className={!useManualKey ? "text-void-accent" : "text-void-dim hover:text-void-muted"}
        >
          Sign with connected wallet
        </button>
        <span className="text-void-dim">·</span>
        <button
          type="button"
          onClick={() => setUseManualKey(true)}
          className={useManualKey ? "text-void-accent" : "text-void-dim hover:text-void-muted"}
        >
          Sign with owner private key (demo)
        </button>
      </div>

      {useManualKey ? (
        <div>
          <Label>Owner private key</Label>
          <input
            value={ownerKey}
            onChange={(e) => setOwnerKey(e.target.value)}
            placeholder="0x…"
            className="mt-1 w-full rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-xs text-void-text placeholder:text-void-dim focus:border-void-accent/70 focus:outline-none focus:ring-2 focus:ring-void-accent/20"
          />
        </div>
      ) : !isConnected ? (
        <p className="text-xs text-void-warn">Connect the owner&apos;s wallet first.</p>
      ) : (
        <p className="text-xs text-void-dim">
          Connected as <span className="font-mono">{address}</span>. It must match the vault&apos;s
          owner address to produce a valid signature.
        </p>
      )}

      {error && <p className="text-xs text-void-danger">{error}</p>}

      <div className="flex gap-2">
        <DangerButton
          onClick={handleRevoke}
          disabled={busy || (useManualKey ? ownerKey.length < 10 : !isConnected)}
        >
          {busy ? "Revoking…" : "Confirm revoke"}
        </DangerButton>
        <SecondaryButton type="button" onClick={() => setConfirming(false)}>
          Cancel
        </SecondaryButton>
      </div>
    </div>
  );
}
