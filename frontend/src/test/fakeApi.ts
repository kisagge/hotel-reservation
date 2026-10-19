import { vi } from "vitest";

type Handler = (req: Request) => Response | Promise<Response>;
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Route `METHOD /path` → handler; records every call. */
export function fakeApi(routes: Record<string, Handler>) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: Request | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(new URL(input, "http://localhost"), init);
    const key = `${req.method} ${new URL(req.url).pathname}`;
    calls.push(key);
    const handler = routes[key];
    if (!handler) return json({ detail: "NOT_MOCKED" }, 500);
    return handler(req);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, count: (key: string) => calls.filter((c) => c === key).length };
}
