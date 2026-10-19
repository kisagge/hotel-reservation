const ORIGIN = "http://haru.invalid";

/**
 * Post-login destination guard. Parses instead of prefix-matching: browsers drop tabs/newlines and treat "\"
 * like "/", so "/\t/evil.com" would become "//evil.com". Only a same-origin path + query + hash is returned.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || /[\u0000-\u001F\u007F\\]/.test(next)) return "/";
  try {
    const url = new URL(next, ORIGIN);
    if (url.origin !== ORIGIN) return "/";
    // Dot segments can normalize "/.//evil.com" into "//evil.com"; check what we actually hand back.
    const out = url.pathname + url.search + url.hash;
    return out.startsWith("//") ? "/" : out;
  } catch {
    return "/";
  }
}

export function loginHref(returnTo: string): string {
  return `/login?next=${encodeURIComponent(returnTo)}`;
}
