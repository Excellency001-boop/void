import type { FastifyReply, FastifyRequest } from "fastify";

/// Tiny in-memory limiter. The relayer pays gas for creates and for every submitted UserOp, even the
/// ones the contract rejects, so on mainnet an open endpoint is a way to burn someone's ETH. This is
/// deliberately simple and per-process; it is a brake, not a security boundary. The real protection
/// for funds is the on-chain policy.
interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const b = buckets.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= limit) {
    buckets.set(key, b);
    return false;
  }
  b.hits.push(now);
  buckets.set(key, b);
  return true;
}

// Routes that spend relayer gas, and how hard to limit them per IP.
const RULES: { method: string; match: RegExp; name: string; limit: number; windowMs: number }[] = [
  { method: "POST", match: /^\/vaults$/, name: "create", limit: 3, windowMs: 60 * 60_000 },
  { method: "POST", match: /^\/agent\/execute$/, name: "execute", limit: 30, windowMs: 60_000 },
  { method: "POST", match: /^\/vaults\/0x[0-9a-fA-F]{40}\/sweep$/, name: "sweep", limit: 6, windowMs: 60_000 },
  { method: "POST", match: /^\/vaults\/0x[0-9a-fA-F]{40}\/revoke$/, name: "revoke", limit: 6, windowMs: 60_000 },
];

export async function rateLimitHook(request: FastifyRequest, reply: FastifyReply) {
  const path = request.url.split("?")[0] ?? "";
  const rule = RULES.find((r) => r.method === request.method && r.match.test(path));
  if (!rule) return;
  if (!allow(`${rule.name}:${request.ip}`, rule.limit, rule.windowMs)) {
    return reply.code(429).send({ error: "rate_limited", details: `Too many ${rule.name} requests. Try again later.` });
  }
}
