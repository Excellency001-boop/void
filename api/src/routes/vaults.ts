import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isAddress, isHex, type Address, type Hex } from "viem";
import {
  createVault,
  getVaultStatus,
  getVaultHistory,
  revokeVaultWithSignature,
  listVaults,
  computeRevokeMessage,
  depositToVault,
} from "../vaults.js";

const addressSchema = z.string().refine(isAddress, "must be a 0x-prefixed 20-byte address");
const hexSchema = z.string().refine(isHex, "must be a 0x-prefixed hex string");

const createVaultSchema = z.object({
  ownerAddress: addressSchema,
  sessionDurationSeconds: z.number().int().positive().max(30 * 24 * 60 * 60),
  nativeSpendCapWei: z.string().regex(/^\d+$/, "must be a base-10 wei amount"),
  maxTxCount: z.number().int().positive(),
  initialTarget: addressSchema.optional(),
  initialSelector: hexSchema.optional(),
});

const revokeSchema = z.object({
  ownerSignature: hexSchema,
});

const depositSchema = z.object({
  amountWei: z.string().regex(/^\d+$/, "must be a base-10 wei amount"),
});

export function registerVaultRoutes(app: FastifyInstance) {
  app.post("/vaults", async (request, reply) => {
    const parsed = createVaultSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    }
    const body = parsed.data;

    if (Boolean(body.initialTarget) !== Boolean(body.initialSelector)) {
      return reply
        .code(400)
        .send({ error: "invalid_request", details: "initialTarget and initialSelector must be provided together" });
    }

    const result = await createVault({
      ownerAddress: body.ownerAddress as Address,
      sessionDurationSeconds: body.sessionDurationSeconds,
      nativeSpendCapWei: BigInt(body.nativeSpendCapWei),
      maxTxCount: BigInt(body.maxTxCount),
      initialTarget: body.initialTarget as Address | undefined,
      initialSelector: body.initialSelector as Hex | undefined,
    });

    return reply.code(201).send(result);
  });

  app.get("/vaults", async () => {
    return listVaults();
  });

  app.get<{ Params: { address: string } }>("/vaults/:address", async (request, reply) => {
    if (!isAddress(request.params.address)) {
      return reply.code(400).send({ error: "invalid_address" });
    }
    const status = await getVaultStatus(request.params.address as Address);
    return status;
  });

  app.get<{ Params: { address: string } }>("/vaults/:address/history", async (request, reply) => {
    if (!isAddress(request.params.address)) {
      return reply.code(400).send({ error: "invalid_address" });
    }
    const history = await getVaultHistory(request.params.address as Address);
    return { vaultAddress: request.params.address, actions: history };
  });

  app.get<{ Params: { address: string } }>("/vaults/:address/revoke-message", async (request, reply) => {
    if (!isAddress(request.params.address)) {
      return reply.code(400).send({ error: "invalid_address" });
    }
    const message = computeRevokeMessage(request.params.address as Address);
    return {
      message,
      instructions:
        "Have the vault's owner sign this 32-byte value with personal_sign (their wallet applies " +
        "the EIP-191 prefix) and POST the resulting signature to /vaults/:address/revoke.",
    };
  });

  app.post<{ Params: { address: string } }>("/vaults/:address/deposit", async (request, reply) => {
    if (!isAddress(request.params.address)) {
      return reply.code(400).send({ error: "invalid_address" });
    }
    const parsed = depositSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    }
    const txHash = await depositToVault(request.params.address as Address, BigInt(parsed.data.amountWei));
    return { deposited: true, txHash };
  });

  app.post<{ Params: { address: string } }>("/vaults/:address/revoke", async (request, reply) => {
    if (!isAddress(request.params.address)) {
      return reply.code(400).send({ error: "invalid_address" });
    }
    const parsed = revokeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    }

    try {
      const txHash = await revokeVaultWithSignature(request.params.address as Address, parsed.data.ownerSignature as Hex);
      return { revoked: true, txHash };
    } catch (err) {
      return reply.code(400).send({ error: "revoke_failed", details: String(err) });
    }
  });
}
