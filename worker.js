/**
 * Meadow Vet Care API Proxy - Cloudflare Worker
 * Proxies requests to DeepSeek LLM from the browser
 * API key stored as Cloudflare environment variable, never in the browser
 *
 * Deploy: npx wrangler deploy
 * Set secrets: npx wrangler secret put LLM_KEY   (DeepSeek API key)
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    try {
      let response;

      if (url.pathname === "/api/llm") {
        const body = await request.json();
        response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.LLM_KEY}`,
          },
          body: JSON.stringify(body),
        });
      } else {
        return new Response("Not found", { status: 404, headers });
      }

      const responseHeaders = new Headers(response.headers);
      Object.entries(headers).forEach(([k, v]) => responseHeaders.set(k, v));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
  },
};
