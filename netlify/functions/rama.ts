// Netlify Function — proxies Rama Shop public-API requests to bypass CORS.
//
// Request:   <site>/api/rama/<rest-of-path>
// Forwarded: https://ramashop.my.id/<rest-of-path>
//
// The web client builds /api/public/... URLs via buildGatewayUrl() in
// storage.ts, so a typical client request looks like
//
//     POST <site>/api/rama/api/public/deposit/create
//
// which lands at
//
//     POST https://ramashop.my.id/api/public/deposit/create
//
// X-API-Key is forwarded as-is from the client; the function never stores
// or sees the key beyond a single in-flight request.

// Local minimal types so we don't need to depend on @netlify/functions in
// package.json (avoids touching the workspace lockfile). Only the shape
// we actually use is declared here.
type Context = Record<string, unknown>;
type Config = { path: string | string[] };

const RAMA_ORIGIN = "https://ramashop.my.id";
const FORWARD_HEADERS = new Set([
  "x-api-key",
  "authorization",
  "accept",
  "content-type",
  "user-agent",
]);
const STRIP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
]);

export default async (req: Request, _ctx: Context): Promise<Response> => {
  // CORS preflight — accept any origin since the function fronts a public API.
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "X-API-Key, Authorization, Content-Type, Accept",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const url = new URL(req.url);
  // Strip the /api/rama mount segment to get the upstream path + query.
  const upstreamPath = url.pathname.replace(/^\/api\/rama/, "") || "/";
  const target = `${RAMA_ORIGIN}${upstreamPath}${url.search}`;

  const headers: Record<string, string> = {};
  req.headers.forEach((value, name) => {
    if (FORWARD_HEADERS.has(name.toLowerCase())) headers[name] = value;
  });

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    // Pass body through verbatim — works for JSON or anything else.
    init.body = await req.text();
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);

  try {
    const upstream = await fetch(target, { ...init, signal: ctrl.signal });
    const body = await upstream.text();

    const out = new Headers();
    upstream.headers.forEach((value, name) => {
      if (!STRIP_RESPONSE_HEADERS.has(name.toLowerCase())) out.set(name, value);
    });
    out.set("Access-Control-Allow-Origin", "*");
    out.set("Access-Control-Expose-Headers", "*");

    return new Response(body, { status: upstream.status, headers: out });
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    return new Response(
      JSON.stringify({
        success: false,
        message: aborted
          ? "Upstream Rama API timeout (15s)"
          : `Upstream Rama API unreachable: ${err?.message || "unknown error"}`,
      }),
      {
        status: aborted ? 504 : 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } finally {
    clearTimeout(timer);
  }
};

export const config: Config = {
  // All requests starting with /api/rama/ hit this function.
  path: "/api/rama/*",
};
