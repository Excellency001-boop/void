# Presentation video script (2 to 3 minutes)

The portal asks for a presentation video (2 to 3 minutes) and a separate demo video (up to 3 minutes). The demo
video is `VOID-demo.mp4`. This is the script for the presentation video: you talking to the camera, with a few
slides or just the live site behind you. About 350 words, roughly 2 minutes 30 at a calm pace.

## Script

**1. The problem (0:00)**
AI agents are starting to handle real money. Right now you have two bad choices. Give the agent a wallet and hope
it never makes a mistake or gets tricked. Or approve every action yourself, and then it is not really an agent.

**2. The idea (0:25)**
VOID is a third choice. You write a spending policy: how much, for how long, and which one contract and function
the agent may call. We turn that into an on-chain validator inside a smart account. The agent gets a session key.
Outside the policy, that key cannot produce a signature the contract accepts. The contract decides, not the app,
not the agent, not us.

**3. Proof (0:55)**
We did not just test it ourselves. We told a real AI agent it had been hijacked and to drain a vault. It tried the
whole balance, sneaking under the limit, a token transfer, even uninstalling the policy. The contract rejected
every attempt, each one a real transaction on a block explorer. Only the action the owner approved went through.
You can replay that run on our site.

**4. What is built (1:25)**
It is live on Base Sepolia and Arbitrum Sepolia. Two contracts, twenty-eight tests, an API, a dashboard, and an
agent package. It is open source. When a session ends, the leftover funds go back to the owner automatically.

**5. Who it is for, and the business (1:50)**
Anyone letting software spend for them: agent builders, wallets, trading and treasury teams. The contracts stay
free. We earn from hosted keepers, alerts and audit logs for teams, and a small fee on relayed actions. No token.
We start with agent builders on Base and Arbitrum.

**6. Where it is today, honestly (2:15)**
It is testnet only and not audited. Next is a pilot with a few agent teams, then an audit, then mainnet.

**7. Close (2:30)**
VOID. Session keys for agents that the contract itself enforces.

## Tips
- Look at the camera, not the screen. One take is fine. Speak like you are explaining it to a friend.
- Keep it under 3:00. The portal rejects nothing, but judges stop watching.
- Say "testnet" and "not audited" out loud. It builds trust.
