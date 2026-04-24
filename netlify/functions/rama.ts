// Netlify Function (v1 handler syntax) — proxies Rama Shop public-API
// requests so the browser can call the QRIS gateway without CORS issues.
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "X-API-Key, Authorization, Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

interface NetlifyEvent {
  httpMethod: string;
  path: string;
  rawUrl?: string;
  rawQuery?: string;
  queryStringParameters?: Record<string, string> | null;
  headers: Record<string, string>;
  body: string | null;
  isBase64Encoded?: boolean;
}

interface NetlifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  // CORS preflight.
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  // Compute upstream path. Netlify rewrites `/api/rama/<rest>` to
  // `/.netlify/functions/rama/<rest>`, so event.path will look like
  // `/.netlify/functions/rama/api/public/balance`. Strip the function
  // mount prefix to get the upstream path.
  let upstreamPath = event.path || "/";
  upstreamPath = upstreamPath.replace(/^\/\.netlify\/functions\/rama/, "");
  upstreamPath = upstreamPath.replace(/^\/api\/rama/, "");
  if (!upstreamPath || upstreamPath === "") upstreamPath = "/";

  const qs = event.rawQuery
    ? `?${event.rawQuery}`
    : event.queryStringParameters && Object.keys(event.queryStringParameters).length > 0
      ? `?${new URLSearchParams(event.queryStringParameters as Record<string, string>).toString()}`
      : "";

  const target = `${RAMA_ORIGIN}${upstreamPath}${qs}`;

  // Forward only safe headers; downcase keys for matching.
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(event.headers || {})) {
    if (FORWARD_HEADERS.has(name.toLowerCase()) && typeof value === "string") {
      headers[name] = value;
    }
  }

  const init: RequestInit = { method: event.httpMethod, headers };
  if (event.httpMethod !== "GET" && event.httpMethod !== "HEAD" && event.body != null) {
    init.body = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);

  try {
    const upstream = await fetch(target, { ...init, signal: ctrl.signal });
    const body = await upstream.text();

    const outHeaders: Record<string, string> = { ...CORS_HEADERS };
    upstream.headers.forEach((value, name) => {
      if (!STRIP_RESPONSE_HEADERS.has(name.toLowerCase())) outHeaders[name] = value;
    });

    return { statusCode: upstream.status, headers: outHeaders, body };
  } catch (err) {
    const e = err as { name?: string; message?: string };
    const aborted = e?.name === "AbortError";
    return {
      statusCode: aborted ? 504 : 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        message: aborted
          ? "Upstream Rama API timeout (15s)"
          : `Upstream Rama API unreachable: ${e?.message || "unknown error"}`,
      }),
    };
  } finally {
    clearTimeout(timer);
  }
};
