import { NextResponse, type NextRequest } from "next/server";
import { loginHref } from "@/lib/authRedirect";

const SESSION_COOKIE = "haru_session";

/** Cheap gate: no session cookie → login. Real authorization stays with the API (401/403). */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(new URL(loginHref(pathname + search), request.url));
}

export const config = {
  matcher: ["/checkout", "/me/:path*", "/admin/:path*"],
};
