/**
 * Meadow Vet Care API Proxy - Cloudflare Worker
 * Proxies requests to DeepSeek LLM from the browser.
 * API key stored as Cloudflare environment variable, never in the browser.
 *
 * Endpoints:
 *   GET  /api/health   - Health check (public, cached 60s)
 *   POST /api/llm      - Proxy to DeepSeek chat completions
 *
 * Deploy:  npx wrangler deploy
 * Secrets: npx wrangler secret put LLM_KEY   (DeepSeek API key)
 *
 * Rate Limiting:
 *   Not enforced at the Worker level by default. For production, add one of:
 *   - Cloudflare WAF > Rate Limiting Rules (dashboard, no code change needed)
 *   - Cloudflare Workers Rate Limiting API (wrangler.toml `[unsafe.bindings]`)
 *   - A token-bucket pattern via Durable Objects for per-IP or per-session control
 *   Free tier: 100,000 req/day. A veterinary clinic chatbot will not exceed this.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const USER_AGENT = "MeadowVetProxy/1.0 (Cloudflare Worker)";

function json(data, status, extraHeaders) {
  const h = new Headers({ "Content-Type": "application/json" });
  Object.entries(CORS_HEADERS).forEach(([k, v]) => h.set(k, v));
  if (extraHeaders) Object.entries(extraHeaders).forEach(([k, v]) => h.set(k, v));
  return new Response(JSON.stringify(data), { status, headers: h });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      // --- /api/health -------------------------------------------------
      if (url.pathname === "/api/health") {
        return json({
          status: "ok",
          llm_configured: !!env.LLM_KEY,
          timestamp: new Date().toISOString(),
        }, 200, { "Cache-Control": "public, max-age=60" });
      }

      // --- /api/llm ----------------------------------------------------
      if (url.pathname === "/api/llm") {
        if (!env.LLM_KEY) {
          return json({ error: "LLM_KEY not configured on server" }, 503);
        }

        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const upstream = await fetch(
          "https://api.deepseek.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${env.LLM_KEY}`,
              "User-Agent": USER_AGENT,
            },
            body: JSON.stringify(body),
          }
        );

        const responseHeaders = new Headers(upstream.headers);
        Object.entries(CORS_HEADERS).forEach(([k, v]) => responseHeaders.set(k, v));

        return new Response(upstream.body, {
          status: upstream.status,
          headers: responseHeaders,
        });
      }

      // --- /api/holidays ------------------------------------------------
      if (url.pathname === "/api/holidays") {
        const year = url.searchParams.get("year") || new Date().getUTCFullYear().toString();
        const holidayUrl = `https://date.nager.at/api/v4/Holidays/IE/${year}`;

        const cache = caches.default;
        let cached = await cache.match(holidayUrl);
        if (cached) return cached;

        const upstream = await fetch(holidayUrl, {
          headers: { "User-Agent": USER_AGENT }
        });

        if (upstream.ok) {
          const resp = new Response(upstream.body, {
            status: upstream.status,
            headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" }
          });
          Object.entries(CORS_HEADERS).forEach(([k, v]) => resp.headers.set(k, v));
          ctx.waitUntil(cache.put(holidayUrl, resp.clone()));
          return resp;
        }

        return json({ error: "Failed to fetch holidays" }, 502);
      }

      // --- catch-all ---------------------------------------------------
      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: e.message || "Internal server error" }, 500);
    }
  },
};
