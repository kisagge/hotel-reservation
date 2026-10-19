import createClient from "openapi-fetch";
import type { paths } from "./schema";

/**
 * Typed client for the FastAPI backend. In the browser requests stay same-origin and go through the Next
 * rewrite; fetch is resolved per call so tests can stub globalThis.fetch.
 */
export const api = createClient<paths>({
  baseUrl: typeof window === "undefined" ? "http://localhost" : window.location.origin,
  fetch: (input) => globalThis.fetch(input),
});
