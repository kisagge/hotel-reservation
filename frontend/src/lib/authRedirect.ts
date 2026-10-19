/** Only same-site absolute paths may be used as a post-login destination (blocks //host and scheme URLs). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export function loginHref(returnTo: string): string {
  return `/login?next=${encodeURIComponent(returnTo)}`;
}
