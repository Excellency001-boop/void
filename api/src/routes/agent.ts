import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isAddress, isHex, type Address, type Hex } from "viem";
import { simulateAction, executeAction } from "../agentActions.js";

const actionSchema = z.object({
  vaultAddress: z.string().refine(isAddress),
  sessionPrivateKey: z.string().refine(isHex),
  target: z.string().refine(isAddress),
  value: z
    .string()
    .regex(/^\d+$/, "must be a base-10 wei amount")
    .default("0"),
  calldata: z.string().refine(isHex).default("0x"),
});

export function registerAgentRoutes(app: FastifyInstance) {
  app.post("/agent/simulate", async (request, reply) => {
    const parsed = actionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    }
    const body = parsed.data;

    const result = await simulateAction({
      vaultAddress: body.vaultAddress as Address,
      sessionPrivateKey: body.sessionPrivateKey as Hex,
      target: body.target as Address,
      value: BigInt(body.value),
      calldata: body.calldata as Hex,
    });

    return result;
  });

  app.post("/agent/execute", async (request, reply) => {
    const parsed = actionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    }
    const body = parsed.data;

    const result = await executeAction({
      vaultAddress: body.vaultAddress as Address,
      sessionPrivateKey: body.sessionPrivateKey as Hex,
      target: body.target as Address,
      value: BigInt(body.value),
      calldata: body.calldata as Hex,
    });

    // 200 either way: "the agent tried an illegal action and it was rejected" is a successful,
    // well-formed API response, not a server error. The `success` field carries the verdict.
    return reply.code(200).send(result);
  });
}
