export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
  }
}

// ── types (mirrors api/src/*.ts) ────────────────────────────────────────────

export interface VaultRecord {
  vaultAddress: string;
  ownerAddress: string;
  sessionKeyAddress: string;
  createdAt: string;
  deployTxHash: string;
  deployBlockNumber: string;
  policy: {
    validAfter: number;
    validUntil: number;
    nativeSpendCap: string;
    maxTxCount: string;
    initialTarget?: string;
    initialSelector?: string;
  };
}

export interface VaultStatus {
  vaultAddress: string;
  owner: string;
  sessionKeyAddress: string;
  validAfter: number;
  validUntil: number;
  nativeSpendCap: string;
  nativeSpent: string;
  remainingNativeBudget: string;
  maxTxCount: string;
  txCount: string;
  revoked: boolean;
  expired: boolean;
}

export interface HistoryEntry {
  target: string;
  selector: string;
  value: string;
  token: string;
  tokenAmount: string;
  blockNumber: string;
  transactionHash: string;
}

export interface RevertInfo {
  errorName: string;
  args: unknown[];
  viaEntryPoint?: boolean;
}

export interface RiskFactor {
  code: string;
  points: number;
  description: string;
}

export interface SimulateResult {
  allowed: boolean;
  revert?: RevertInfo;
  riskScore: number;
  riskFactors: RiskFactor[];
  userOpHash: string;
}

export interface ExecuteResult {
  success: boolean;
  txHash?: string;
  userOpHash: string;
  revert?: RevertInfo;
}

export interface CreateVaultParams {
  ownerAddress: string;
  sessionDurationSeconds: number;
  nativeSpendCapWei: string;
  maxTxCount: number;
  initialTarget?: string;
  initialSelector?: string;
}

export interface CreateVaultResult {
  vaultAddress: string;
  sessionKeyAddress: string;
  sessionPrivateKey: string;
  deployTxHash: string;
}

export interface ActionInput {
  vaultAddress: string;
  sessionPrivateKey: string;
  target: string;
  value: string;
  calldata: string;
}

export type ApiClient = ReturnType<typeof createApiClient>;

// ── client factory ───────────────────────────────────────────────────────
// A factory rather than a singleton bound to one fixed base URL: the dashboard talks to a
// different API instance per network (see lib/networks.ts) — each chain has its own deployed API,
// not one multi-tenant service — so every caller needs the client for whichever network is
// currently active, not a module-load-time constant.

export function createApiClient(baseUrl: string) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    const body = await res.json().catch(() => undefined);
    if (!res.ok) {
      throw new ApiError(body?.error ?? body?.message ?? `Request failed (${res.status})`, res.status, body);
    }
    return body as T;
  }

  return {
    health: () => request<{ status: string; chainId: number; chainName: string; relayer: string }>("/health"),

    createVault: (params: CreateVaultParams) =>
      request<CreateVaultResult>("/vaults", { method: "POST", body: JSON.stringify(params) }),

    listVaults: () => request<VaultRecord[]>("/vaults"),

    getVaultStatus: (address: string) => request<VaultStatus>(`/vaults/${address}`),

    getVaultHistory: (address: string) =>
      request<{ vaultAddress: string; actions: HistoryEntry[] }>(`/vaults/${address}/history`),

    getRevokeMessage: (address: string) =>
      request<{ message: string; instructions: string }>(`/vaults/${address}/revoke-message`),

    revokeVault: (address: string, ownerSignature: string) =>
      request<{ revoked: true; txHash: string }>(`/vaults/${address}/revoke`, {
        method: "POST",
        body: JSON.stringify({ ownerSignature }),
      }),

    depositToVault: (address: string, amountWei: string) =>
      request<{ deposited: true; txHash: string }>(`/vaults/${address}/deposit`, {
        method: "POST",
        body: JSON.stringify({ amountWei }),
      }),

    simulateAction: (input: ActionInput) =>
      request<SimulateResult>("/agent/simulate", { method: "POST", body: JSON.stringify(input) }),

    executeAction: (input: ActionInput) =>
      request<ExecuteResult>("/agent/execute", { method: "POST", body: JSON.stringify(input) }),
  };
}
