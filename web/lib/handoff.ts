/// One-time, same-tab handoff of the session key from the success screen to the vault console.
/// The key used to ride in a URL query string, which puts a secret in browser history, in the
/// address bar for screenshots, and in the request URL Next.js sends when it prefetches the link.
/// sessionStorage never leaves the tab, and the entry is deleted the moment it is read.
const KEY = "void:handoff";
const MAX_AGE_MS = 10 * 60 * 1000;

export interface Handoff {
  vault: string;
  sessionKey: string;
  target?: string;
}

export function setHandoff(h: Handoff) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...h, at: Date.now() }));
  } catch {}
}

export function takeHandoff(vault: string): Handoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const h = JSON.parse(raw) as Handoff & { at: number };
    if (h.vault?.toLowerCase() !== vault.toLowerCase()) return null;
    if (Date.now() - h.at > MAX_AGE_MS) return null;
    return { vault: h.vault, sessionKey: h.sessionKey, target: h.target };
  } catch {
    return null;
  }
}
