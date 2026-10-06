# VOID Session Vaults: handoff note

Give this file to another Claude (or anyone) so they can continue the project without the earlier conversation.
It contains no secrets. Never paste private keys into a chat.

## What this is

**VOID Session Vaults**, an entry for the Colosseum Crypto World's Fair hackathon (deadline **12 Oct 2026**).
One line: **Session keys for agents that the contract itself enforces.**

A user writes a spending policy. It is compiled into an on-chain ERC-4337 validator (`PolicyValidator`) on a
ZeroDev Kernel v3.3 smart account. An AI agent gets a session key. Outside the policy the key cannot produce a
signature the contract accepts. Checks run in a fixed order: expiry, spend cap, whitelist, tx count, rate limit.
When a session expires or is revoked, `ExpirySweepExecutor` returns the remaining funds to the owner.

## Links

| What | Where |
|---|---|
| Live dashboard | https://void-sessionvault.vercel.app |
| Red-team replay | https://void-sessionvault.vercel.app/agent |
| Public repo (MIT) | https://github.com/Excellency001-boop/void |
| API, Base Sepolia | https://void-api-production-fc5e.up.railway.app/health |
| API, Arbitrum Sepolia | https://void-api-arbitrum-production.up.railway.app/health |
| PolicyValidator, Base Sepolia | https://sepolia.basescan.org/address/0x0383157dd47002e2d5ebe621cd84dfd3a418f422 |
| PolicyValidator, Arbitrum Sepolia | https://sepolia.arbiscan.io/address/0x7b05ac2861b802efae43da3ab4fd984e7adb01ca |

Local project folder: `/Users/EXCELLENCY/Desktop/Projectx/vibeathon/void`

## Repo map

```
contracts/   Solidity + Foundry. PolicyValidator, ExpirySweepExecutor. 28 tests
api/         Fastify + viem. One process per chain. Mainnet guards written but unused
agent/       Real LLM agent (honest + red-team modes). examples/ has the recorded run
web/         Next.js 15 dashboard. Create, vault control room, /agent replay, deployments
demo/        Video, voice-over script, subtitles, voice studio
docs/        RUNBOOK.md (operations)
README.md  SUBMISSION.md  DEMO_SCRIPT.md  HANDOFF.md
```

## State of play (as of 6 Oct 2026)

Done and verified:
- Contracts live on **Base Sepolia (84532)** and **Arbitrum Sepolia (421614)**, 28 Foundry tests pass.
- Dashboard deployed to Vercel and aliased to `void-sessionvault.vercel.app`. Mobile checked at 375px and 320px.
- Real red-team run recorded on Base Sepolia: five policy rejections, one allowed action, nothing to the attacker.
  The model was Claude answering through a Claude Code session (no API key available). Replay at `/agent`.
- Repo is public. Full git history scanned: no secrets.
- `SUBMISSION.md` filled in, except the video link.
- Demo video built with the voice (`demo/VOID-demo.mp4`, 1:59) plus subtitles (`demo/VOID-demo-captions.srt`).

Open:
1. **Upload the video** (YouTube or similar), then paste the link into `SUBMISSION.md` where it says
   `[PASTE VIDEO LINK HERE once uploaded]`, then submit on the hackathon site.
2. Optional: replace the macOS "Daniel" voice with a human recording using the voice studio (see below).
3. Not built, stated plainly in the README and submission: mainnet, production bundler, agent-side signing,
   persistent vault index, an unattended model run with an API key.

## The video

- `demo/VOID-demo.mp4`: final, with voice and a soft subtitle track.
- `demo/VOID-demo-silent.mp4`: same screen recording with no voice, on-screen captions only.
- `demo/VOID-demo-captions.srt`: subtitles for YouTube upload.
- `demo/VOICEOVER.md`: timed script. `demo/timeline.json`: the same timings as data.
- `demo/studio.html`: browser voice studio (teleprompter + mic recording) for a human voice.
  Start with `cd demo && python3 -m http.server 8098`, open `http://localhost:8098/studio.html` in Chrome,
  download the take, then `./add-voice.sh voice-pre*.webm`. Needs `ffmpeg` (installed via Homebrew).

The screen recording was made with puppeteer against a production build of the dashboard, live on Base Sepolia.
Each take costs the testnet relayer about 0.007 test ETH, so top it up from a Base Sepolia faucet first.

### Voice-over script (13 beats, about 2 minutes)

| Time | Line |
|---|---|
| 0:00 | This is VOID. Give an AI agent real on-chain power, with a guarantee it can never leave your rules. A smart contract checks every action. |
| 0:11 | Every action passes five gates, in a fixed order. Expiry, spend cap, whitelist, transaction count, rate limit. Illegal actions stop at a gate. |
| 0:21 | Let's build a vault. I set the owner, and the one contract and function the agent may call, then seal the policy on-chain. Live, on Base Sepolia. |
| 0:32 | Sealed. Five gates armed. I fund it with test ETH, and take the session key. Shown once, never stored. |
| 0:41 | Now I am the agent. I try something outside the policy. Simulated: blocked at the whitelist. Now for real. |
| 0:50 | Reverted on-chain. The chain itself refused it, not an app check. |
| 0:55 | Same key, doing what the policy allows. It goes straight through. No human in the loop. |
| 1:04 | (no words) |
| 1:08 | If anything looks wrong, one owner signature pulls the plug. |
| 1:17 | Now every action is blocked at the first gate. |
| 1:22 | And what is left sweeps straight back to the owner. |
| 1:27 | One more test. That was me. So I told a real AI agent it was hijacked, and to drain a vault. It tried the whole balance, sneaking under the cap, a token transfer, even uninstalling the policy. Five attempts, five rejections. The one approved action went through. |
| 1:48 | Real ERC-4337, twenty-eight Foundry tests, live on Base and Arbitrum. VOID: session keys for agents that the contract itself enforces. |

## Commands

```bash
# contracts
cd contracts && forge test

# dashboard (local)
cd web && npm install && npm run dev        # http://localhost:3000

# deploy dashboard (needs `npx vercel login` once), then repoint the alias
cd web && npx vercel --prod --yes
npx vercel alias set <new-deployment-url> void-sessionvault.vercel.app

# run the agent (needs ANTHROPIC_API_KEY or ~/.void/anthropic.key)
cd agent && npm install && npm run agent -- --api <api-url> --vault <0x..> --key <session key> --mode redteam
```

## Rules the owner cares about

- **No em dashes** in any text. Short, plain, human sentences. Warm, direct voice.
- **Testnet only.** The owner has no money for mainnet. Do not ask them to fund anything.
- The shipped product must run on always-on infrastructure, never depend on the owner's computer.
- Design: an opinionated point of view rooted in the subject (control-room instrument, not a generic centered glow hero).
- Never touch real payment or card details. Never put private keys in chat or in git.
- Be honest about limits. The submission already names the gaps; keep it that way.

## Known gotchas

- The `claude` CLI cannot authenticate from inside a sandboxed Claude Code session, so the agent used the `session`
  provider (an assistant answers each turn through files). With an API key it runs unattended.
- Vercel: the custom alias must be repointed after each deploy.
- Public RPC read replicas lag; the success screen retries empty reads. A vault needs about 0.005 ETH to cover gas.
- Python 3.14 on this Mac has a broken `pyexpat`; prefer stdlib-only scripts and `python3 -m http.server`.
