"use client";

import { useAccount, useSendTransaction } from "wagmi";
import type { ApiClient } from "./api";
import type { NetworkConfig } from "./networks";
import type { SupportedChainId } from "./wagmi";

/// One way to put ETH into a vault, whichever chain. Testnets use the relayer's demo faucet so a
/// judge can try the product without a wallet. Mainnets never do: the user sends real ETH from their
/// own wallet, signed in their own wallet app, so nothing here can move money on its own.
export function useFundVault() {
  const { isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();

  return async function fundVault(
    network: NetworkConfig,
    api: ApiClient,
    vaultAddress: string,
    wei: string
  ): Promise<{ txHash: string }> {
    if (network.testnet) return api.depositToVault(vaultAddress, wei);
    if (!isConnected) throw new Error("Connect your wallet to send ETH to the vault.");
    const txHash = await sendTransactionAsync({
      to: vaultAddress as `0x${string}`,
      value: BigInt(wei),
      chainId: network.chainId as SupportedChainId,
    });
    return { txHash };
  };
}
