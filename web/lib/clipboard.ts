/// Copy that reports whether it actually worked. navigator.clipboard is missing or blocked in
/// insecure contexts, some embedded browsers, and when the tab lost focus; falling back to a hidden
/// textarea covers most of those. Callers must treat `false` as "the user still has to copy this by
/// hand", which matters when the text is a one-time session key.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
