# VOID — demo script

Target length: 2.5–3 minutes. Recorded on the live dashboard against real Base Sepolia — every
transaction in this script is real, not simulated for the camera. Fallback proof (already-verified
transactions from earlier testing) is listed at the bottom in case anything needs a backup shot.

Chain: **Base Sepolia**. PolicyValidator: `0x0383157dd47002e2d5ebe621cd84dfd3a418f422`. Dashboard:
**https://void-sessionvault.vercel.app** (Railway-hosted API behind it — nothing local needed
to record this).

---

## 0. Cold open (10–15s)

**Say:** "This is VOID. It lets you give an AI agent real money and real on-chain power, with a
mathematical guarantee it can never steal, overspend, or act outside rules you define — not
because you trust the agent, but because the smart contract won't let it."

No screen yet, or a static title card. Keep it short — the product proves itself in the next two
minutes.

---

## 1. Create the policy (30–40s)

**Screen:** Dashboard home (`/`) → click **+ New Session Vault**.

**Say while filling the form:** "I define the policy once, in plain terms. A spend cap. A max
number of transactions. A time window. And — the important part — exactly which contract and
function the agent is allowed to call."

**Do:**
- Owner address: use connected wallet or paste one
- Session duration: **1 day**
- Native spend cap: **0.002** ETH
- Max transactions: **5**
- Initial permission: paste the demo target contract address + a function signature (e.g.
  `mint(address,uint256)` against the deployed MockERC20 test target — swap in whatever real
  target you're demoing against)

Click **Deploy Session Vault**.

**Say while it confirms:** "That's not saved to a database somewhere — it just went on-chain. A
real ERC-4337 smart account got deployed, and this policy is now compiled directly into its
validator."

**Screen:** success panel — point at the vault address, the session key, and **the private key
reveal**, read the warning out loud: "This is shown once. I copy it now and hand it to my agent.
If I lose it, the agent's session is dead — but my funds were never at risk, because the session
key never had root access to begin with."

---

## 2. The illegal action gets rejected (30–40s) — the beat that matters most

**Screen:** Go to the vault page → scroll to **Agent Console**.

**Say:** "Now I'm the agent. I have the session key. Let's try something outside the policy — a
contract I was never authorized to touch."

**Do:**
- Paste the session private key
- Target: some **other** address (not the whitelisted one) — e.g. a random Base Sepolia address
- Calldata: anything, e.g. `0x12345678`
- Click **Simulate** first: "This replays the actual on-chain validation logic — read-only, no
  gas — so I know before I even try."

**Screen:** result shows `blocked — TargetSelectorNotAllowed`.

**Say:** "Rejected. Now let's actually try it for real, not just simulate it."

**Do:** Click **Execute for real**.

**Screen:** result shows `reverted on-chain — TargetSelectorNotAllowed`, with a real tx hash.
Click the tx link → **Basescan** opens showing a genuinely mined, failed transaction.

**Say:** "That's a real transaction, on a real block explorer, that really reverted. This isn't a
client-side check I could route around — the EntryPoint itself refused to execute it, because my
validator contract said no. That's the whole thesis of VOID in one transaction."

---

## 3. The legal action succeeds (20–30s)

**Do:** Change target/calldata back to the whitelisted contract + function. Click **Simulate**
(shows `allowed`), then **Execute for real**.

**Screen:** result shows `executed on-chain`, tx link. Scroll up — **Action history** now shows the
new entry, **Transactions** counter ticks to 1/5.

**Say:** "Same agent, same key — this time it's inside the policy, and it goes straight through.
No approval popup, no human in the loop. That's what makes this usable for an actual autonomous
agent, not just a demo."

---

## 4. Force revoke — the kill switch (15–20s)

**Do:** Click **Force Revoke** → confirm → sign with the owner's wallet (or the demo private-key
path).

**Screen:** badge flips to `REVOKED`. Run **Simulate** again on the previously-legal action.

**Screen:** now shows `blocked — SessionRevoked`.

**Say:** "One signature, no gas required from me — and the agent is completely locked out,
immediately. The funds were never in its control to begin with, so there's nothing to claw back."

---

## 5. Close (25–30s)

**Say:** "Under the hood, this is a real ZeroDev Kernel v3 smart account, a real ERC-4337
EntryPoint, and a validator module we wrote ourselves that enforces the policy in strict priority
order — expiry, spend caps, whitelist, transaction count, rate limits — every single time, before
the chain lets anything execute. We're live on Base Sepolia today; Base and Arbitrum mainnet are
next.

The problem we're solving is the one nobody's actually solved: give an agent real economic agency,
without giving it the ability to rug you. VOID is that boundary, enforced by code, not trust."

End on the dashboard, vault list, or repo.

---

## Fallback proof (if a live take doesn't cooperate)

Already-verified on Base Sepolia from earlier testing — use these tx links as backup B-roll or a
"we've already proven this" cutaway:

| What | Tx |
|---|---|
| Legal action executed | `0xa49dca097daa01dabe7dd6fcea206a4277ab176f16c9402d707a9eb15b0f2de7` |
| Illegal action — real on-chain revert | `0x9d1a7b2eb23e72e910bb4a2c30b50dd42c2838436395b9c69bbc9d93be06993d` |
| Gasless owner revoke | `0x4970f530e05c1ba4c30ffeeedd6f58a2142847729d93dfde8e6f2ddffd6dfd7a` |

All viewable at `https://sepolia.basescan.org/tx/<hash>`.

## Recording checklist

- [ ] Both live: dashboard at https://void-sessionvault.vercel.app, API at
      https://void-api-production-fc5e.up.railway.app/health (check it returns `"status":"ok"`)
- [ ] Railway relayer still funded with Base Sepolia test ETH (`railway logs --service void-api`
      to check for AA21/prefund errors if something looks off)
- [ ] A funded owner wallet ready to connect (for the revoke-signing beat)
- [ ] A whitelisted target contract + function decided in advance and deployed
- [ ] Do one full silent dry-run first — Base Sepolia confirmation times vary; know how long to
      pause after each "Execute for real" before the result appears
