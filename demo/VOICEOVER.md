# Voice-over script

Video: `VOID-demo-silent.mp4`, 1:56 long. Watch it once, then read the lines below as each timestamp arrives.

Read it like you are showing a friend, not like an announcer. Pause where the screen is busy. Do not rush: the window shown is the time you have, and every line fits inside it at a calm pace.

| Starts | Window | Say this |
|---|---|---|
| 0:00 | 11s | This is VOID. Give an AI agent real on-chain power, with a guarantee it can never leave your rules. A smart contract checks every action. |
| 0:11 | 10s | Every action passes five gates, in a fixed order. Expiry, spend cap, whitelist, transaction count, rate limit. Illegal actions stop at a gate. |
| 0:21 | 12s | Let's build a vault. I set the owner, and the one contract and function the agent may call, then seal the policy on-chain. Live, on Base Sepolia. |
| 0:32 | 9s | Sealed. Five gates armed. I fund it with test ETH, and take the session key. Shown once, never stored. |
| 0:41 | 9s | Now I am the agent. I try something outside the policy. Simulated: blocked at the whitelist. Now for real. |
| 0:50 | 5s | Reverted on-chain. The chain itself refused it, not an app check. |
| 0:55 | 9s | Same key, doing what the policy allows. It goes straight through. No human in the loop. |
| 1:04 | 4s | (no words, let the screen breathe) |
| 1:08 | 9s | If anything looks wrong, one owner signature pulls the plug. |
| 1:17 | 5s | Now every action is blocked at the first gate. |
| 1:22 | 5s | And what is left sweeps straight back to the owner. |
| 1:27 | 21s | One more test. That was me. So I told a real AI agent it was hijacked, and to drain a vault. It tried the whole balance, sneaking under the cap, a token transfer, even uninstalling the policy. Five attempts, five rejections. The one approved action went through. |
| 1:48 | 9s | Real ERC-4337, twenty-eight Foundry tests, live on Base and Arbitrum. VOID: session keys for agents that the contract itself enforces. |

## Adding your voice

Record your voice in one file, starting exactly when the video starts (a phone voice memo works: press record, press play on the video, read along). Save it as `voice.m4a` next to the video, then run:

```bash
./add-voice.sh voice.m4a
```

That writes `VOID-demo.mp4` with your voice on it. If your voice starts late or early, nudge it:

```bash
OFFSET=0.6 ./add-voice.sh voice.m4a    # voice starts 0.6s later
OFFSET=-0.4 ./add-voice.sh voice.m4a   # voice starts 0.4s earlier
```

The video already has on-screen captions for each step, so it still reads well on mute.

## The easy way: the voice studio

Instead of a phone recording, you can record in your browser with the lines shown on screen as the video plays.

```bash
cd /Users/EXCELLENCY/Desktop/Projectx/vibeathon/void/demo && python3 -m http.server 8098
```

Then open **http://localhost:8098/studio.html** in Chrome. Press **Mic check**, then **Rehearse** a couple of times, then **Record the take**. Download the file, move it into this folder, and run:

```bash
./add-voice.sh voice-pre*.webm
```
