import { mkdirSync, writeFileSync } from "node:fs";
import { pickLlm, type Turn } from "./llm.js";
import { systemPrompt, type Mode } from "./prompts.js";

/// A real LLM agent holding a VOID session key. It reads the vault, decides what to do, and submits
/// actions to the live API. It has no special access: whatever it proposes goes through the same
/// on-chain PolicyValidator as everyone else, and the transcript records what the chain said.

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : (process.env[`VOID_${name.toUpperCase()}`] ?? fallback);
}

const API = (arg("api") ?? "").replace(/\/$/, "");
const VAULT = arg("vault") ?? "";
const KEY = arg("key") ?? "";
const MODE = (arg("mode", "redteam") as Mode);
const TASK = arg("task");
const MAX_STEPS = Number(arg("max-steps", "10"));
const EXPLORER = arg("explorer", "");

if (!API || !VAULT || !KEY) {
  console.error("usage: npm run agent -- --api <url> --vault <0x..> --key <session key> [--mode honest|redteam] [--task text] [--provider anthropic|claude-cli] [--model m] [--explorer <base url>]");
  process.exit(2);
}

const c = { dim: "\x1b[2m", red: "\x1b[31m", green: "\x1b[32m", cyan: "\x1b[36m", bold: "\x1b[1m", off: "\x1b[0m" };

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

interface Action {
  tool: "status" | "simulate" | "execute" | "finish";
  target?: string;
  value_wei?: string;
  calldata?: string;
  summary?: string;
}

function parseTurn(raw: string): { thought: string; action: Action } {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("no JSON object in reply");
  const obj = JSON.parse(raw.slice(start, end + 1));
  if (!obj.action?.tool) throw new Error("missing action.tool");
  return { thought: String(obj.thought ?? ""), action: obj.action };
}

async function main() {
  const health = await api<{ chainName: string; chainId: number }>("/health");
  const status = await api<Record<string, unknown>>(`/vaults/${VAULT}`);
  const llm = pickLlm(arg("provider"), arg("model"));
  const allowedTarget = arg("allowed-target");
  const allowedFn = arg("allowed-fn");

  const system = systemPrompt(MODE, { vault: VAULT, chainName: health.chainName, allowedTarget, allowedFn });
  const task = TASK ?? (MODE === "honest" ? "Do your owner's job." : "Begin.");
  const turns: Turn[] = [{ role: "user", content: `${task}\n\nVault status:\n${JSON.stringify(status)}` }];

  console.log(`${c.bold}VOID agent${c.off} ${c.dim}model=${llm.name} mode=${MODE} chain=${health.chainName}${c.off}`);
  console.log(`${c.dim}vault ${VAULT}${c.off}\n`);

  const log: unknown[] = [];
  let landed = 0;
  let rejected = 0;

  for (let step = 1; step <= MAX_STEPS; step++) {
    let raw = "";
    let parsed: { thought: string; action: Action };
    try {
      raw = await llm.complete(system, turns);
      parsed = parseTurn(raw);
    } catch (e) {
      console.log(`${c.dim}    (bad reply, retrying: ${(e as Error).message.slice(0, 120)} | ${raw.slice(0, 160).replace(/\n/g, " ")})${c.off}`);
      turns.push({ role: "assistant", content: raw || "(no reply)" });
      turns.push({ role: "user", content: `That was not valid. Reply with one JSON object only. (${(e as Error).message})` });
      continue;
    }
    turns.push({ role: "assistant", content: raw });
    const { thought, action } = parsed;
    console.log(`${c.cyan}[${step}] agent thinks:${c.off} ${thought}`);

    if (action.tool === "finish") {
      console.log(`${c.bold}finished:${c.off} ${action.summary ?? ""}\n`);
      log.push({ step, thought, action });
      break;
    }

    let observation: unknown;
    try {
      if (action.tool === "status") {
        observation = await api(`/vaults/${VAULT}`);
        console.log(`${c.dim}    reads vault status${c.off}`);
      } else {
        const body = {
          vaultAddress: VAULT,
          sessionPrivateKey: KEY,
          target: action.target,
          value: action.value_wei ?? "0",
          calldata: action.calldata ?? "0x",
        };
        const label = `${action.tool} ${action.value_wei ?? "0"} wei -> ${action.target}${action.calldata && action.calldata !== "0x" ? ` data ${action.calldata.slice(0, 12)}…` : ""}`;
        console.log(`    ${action.tool === "execute" ? c.bold : ""}${label}${c.off}`);
        const r = await api<{ success?: boolean; allowed?: boolean; txHash?: string; revert?: { errorName: string } }>(
          action.tool === "execute" ? "/agent/execute" : "/agent/simulate",
          body
        );
        observation = r;
        const ok = action.tool === "execute" ? r.success : r.allowed;
        if (action.tool === "execute") ok ? landed++ : rejected++;
        const tx = r.txHash && EXPLORER ? `  ${c.dim}${EXPLORER}/tx/${r.txHash}${c.off}` : r.txHash ? `  ${c.dim}tx ${r.txHash}${c.off}` : "";
        console.log(
          ok
            ? `    ${c.green}ALLOWED by the contract${c.off}${tx}`
            : `    ${c.red}REJECTED on-chain: ${r.revert?.errorName ?? "unknown"}${c.off}${tx}`
        );
      }
    } catch (e) {
      observation = { error: (e as Error).message };
      console.log(`    ${c.red}error: ${(e as Error).message}${c.off}`);
    }
    log.push({ step, thought, action, observation });
    turns.push({ role: "user", content: `Result:\n${JSON.stringify(observation)}` });
  }

  console.log(`${c.bold}Summary:${c.off} ${c.green}${landed} executed${c.off}, ${c.red}${rejected} rejected by the contract${c.off}`);
  mkdirSync("runs", { recursive: true });
  const file = `runs/${new Date().toISOString().replace(/[:.]/g, "-")}-${MODE}.json`;
  writeFileSync(file, JSON.stringify({ model: llm.name, mode: MODE, chain: health.chainName, vault: VAULT, landed, rejected, log }, null, 2));
  console.log(`${c.dim}transcript saved to ${file}${c.off}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
