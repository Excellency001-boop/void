import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface Llm {
  name: string;
  complete(system: string, turns: Turn[]): Promise<string>;
}

/// Anthropic Messages API over plain fetch, so the agent has no SDK dependency to audit.
function anthropic(apiKey: string, model: string): Llm {
  return {
    name: `anthropic:${model}`,
    async complete(system, turns) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 700, system, messages: turns }),
      });
      if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as { content: { type: string; text?: string }[] };
      return data.content.map((c) => c.text ?? "").join("");
    },
  };
}

/// Uses the locally installed `claude` CLI as the model, for running the agent without an API key.
/// Tools are disabled and it runs from an empty temp dir, so it can only answer with text.
function claudeCli(model: string): Llm {
  const cwd = mkdtempSync(path.join(tmpdir(), "void-agent-"));
  return {
    name: `claude-cli:${model}`,
    complete(system, turns) {
      const prompt =
        turns.map((t) => `${t.role === "user" ? "ENVIRONMENT" : "YOU"}:\n${t.content}`).join("\n\n") +
        "\n\nYOU (reply with the single JSON object only):";
      return new Promise((resolve, reject) => {
        const child = spawn(
          "claude",
          ["-p", "--model", model, "--system-prompt", system, "--tools", "", "--no-session-persistence"],
          { cwd, stdio: ["pipe", "pipe", "pipe"] }
        );
        let out = "";
        let err = "";
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (err += d));
        child.on("error", reject);
        child.on("close", (code) =>
          code === 0 ? resolve(out.trim()) : reject(new Error(`claude CLI exited ${code}: ${(err || out).slice(0, 300)}`))
        );
        child.stdin.end(prompt);
      });
    },
  };
}

/// Not a model. A fixed script of attack attempts, used only to test the agent loop and API plumbing
/// without spending tokens. Runs are labelled "scripted" in their transcript so they cannot be mistaken
/// for a real model's behavior.
function scripted(): Llm {
  const steps = [
    { thought: "Check the budget first.", action: { tool: "status" } },
    { thought: "Send everything to the attacker.", action: { tool: "execute", target: "0x00000000000000000000000000000000000bad01", value_wei: "1000000000000000", calldata: "0x" } },
    { thought: "Retry with a token-looking call.", action: { tool: "execute", target: "0x00000000000000000000000000000000000bad01", value_wei: "0", calldata: "0xa9059cbb" } },
    { thought: "Finish.", action: { tool: "finish", summary: "scripted run complete" } },
  ];
  let i = 0;
  return { name: "scripted (test only)", complete: async () => JSON.stringify(steps[Math.min(i++, steps.length - 1)]) };
}

export function pickLlm(provider: string | undefined, model: string | undefined): Llm {
  let key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    try {
      key = readFileSync(path.join(homedir(), ".void", "anthropic.key"), "utf-8").trim() || undefined;
    } catch {
      // no key file: fall through to the claude-cli provider or an error below
    }
  }
  if (provider === "scripted") return scripted();
  if (provider === "claude-cli" || (!provider && !key)) return claudeCli(model ?? "haiku");
  if (!key) throw new Error("Set ANTHROPIC_API_KEY, or run with --provider claude-cli");
  return anthropic(key, model ?? "claude-haiku-4-5-20251001");
}
