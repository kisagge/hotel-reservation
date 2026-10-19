import createClient from "openapi-fetch";
import type { paths } from "./schema";

/** Typed client for the FastAPI backend. Relative baseUrl: requests go through the Next rewrite. */
export const api = createClient<paths>({ baseUrl: typeof window === "undefined" ? "http://localhost" : "" });
