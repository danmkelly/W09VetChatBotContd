# Meadow Vet Care Chatbot - Deployment Guide

## Architecture

```
Browser (index.html on GitHub Pages)
    |
    |-- GET  https://docs.google.com/spreadsheets/...  (direct, no auth needed)
    |
    |-- POST https://meadow-vet-proxy.<subdomain>.workers.dev/api/llm
            |
            Cloudflare Worker (worker.js)
                |
                |-- POST https://api.deepseek.com/v1/chat/completions
                |   (Authorization: Bearer $LLM_KEY from env)
```

The Worker hides the DeepSeek API key. The browser never sees it.
Google Sheets CSV is fetched directly from the browser (no key required).

---

## Prerequisites

- A Cloudflare account (free tier is fine)
- A DeepSeek API key from https://platform.deepseek.com -> API Keys
- Node.js installed locally (for `npx wrangler`)
- A GitHub account (for GitHub Pages)

---

## Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
```

Or use `npx wrangler` without installing globally.

---

## Step 2: Authenticate with Cloudflare

```bash
npx wrangler login
```

This opens a browser window to authorise Wrangler against your Cloudflare account.

---

## Step 3: Deploy the Worker

```bash
npx wrangler deploy
```

This uploads `worker.js` to Cloudflare's edge network. You'll get a URL like:

```
https://meadow-vet-proxy.<your-subdomain>.workers.dev
```

---

## Step 4: Set the DeepSeek API Secret

```bash
npx wrangler secret put LLM_KEY
```

Paste your DeepSeek API key when prompted. The key is stored encrypted in Cloudflare and injected into the Worker at runtime as `env.LLM_KEY`. It is never in your source code or in the browser.

---

## Step 5: Verify the Deployment

### Health Check

```bash
curl https://meadow-vet-proxy.<your-subdomain>.workers.dev/api/health
```

Expected response:
```json
{"status":"ok","llm_configured":true,"timestamp":"2025-07-07T..."}
```

### LLM Proxy Test

```bash
curl -X POST https://meadow-vet-proxy.<your-subdomain>.workers.dev/api/llm \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"Say hello in one sentence."}],"max_tokens":50}'
```

You should get a JSON response with `choices[0].message.content`.

### CORS Preflight Test

```bash
curl -X OPTIONS https://meadow-vet-proxy.<your-subdomain>.workers.dev/api/llm -I
```

Expected headers in response:
```
access-control-allow-origin: *
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-headers: Content-Type, Authorization
access-control-max-age: 86400
```

---

## Step 6: Configure index.html

Edit `config.js` (copy from `config.example.js`):

```js
var API_PROXY = "https://meadow-vet-proxy.<your-subdomain>.workers.dev";
var LLM_KEY = "";   // leave empty - key lives in Worker, not here
var LLM_URL = "https://api.deepseek.com/v1/chat/completions";
var LLM_MODEL = "deepseek-chat";
```

When `API_PROXY` is set, the browser sends LLM requests to your Worker instead of directly to DeepSeek. The Worker attaches the key from its environment.

---

## Step 7: Enable GitHub Pages

1. Go to your GitHub repository -> Settings -> Pages
2. Source: "Deploy from a branch"
3. Branch: `main` (or `gh-pages`), root folder `/`
4. Click Save

GitHub will provide a URL like `https://<username>.github.io/<repo>/`.

### Required GitHub Pages files (all present in repo):

| File | Purpose |
|------|---------|
| `_headers` | Sets `Cross-Origin-Opener-Policy: same-origin` for all pages |
| `_config.yml` | Tells Jekyll to include `.nojekyll` |
| `.nojekyll` | Disables Jekyll processing (static HTML only) |
| `robots.txt` | Allows all crawlers |

---

## Step 8: End-to-End Test

1. Open your GitHub Pages URL in a browser
2. Open DevTools -> Network tab
3. Type a message in the chatbot
4. Verify:
   - A POST request goes to your Worker (not directly to api.deepseek.com)
   - The response returns a chatbot reply
   - No API key appears in any request header or response body
   - The service cards populate from the Google Sheets CSV

---

## Local Development

### Frontend only (no Worker, no LLM)

Serve the files with any static server:

```bash
npx serve .
```

Or with Python:

```bash
python -m http.server 8080
```

The chatbot will load service data from Google Sheets and respond to keyword queries. LLM responses require the Worker or a local config.js with a key (never commit).

### Worker locally

```bash
npx wrangler dev
```

This runs the Worker at `http://localhost:8787`. Point `API_PROXY` in config.js to `http://localhost:8787`.

Set a local secret for testing:

```bash
npx wrangler secret put LLM_KEY
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| 503 from /api/llm | LLM_KEY not set | `npx wrangler secret put LLM_KEY` |
| CORS error in browser | Worker not deployed or wrong URL | Check API_PROXY in config.js matches Worker URL |
| "LLM Not Live" badge | config.js missing or LLM_KEY empty | Copy config.example.js to config.js and set API_PROXY |
| Service cards not loading | Google Sheets blocked by COEP | `_headers` was recently fixed to remove `require-corp` |
| 402 / "insufficient balance" | DeepSeek credits depleted | Top up at platform.deepseek.com |
| "No slots left" on all services | Normal - just demo data from the sheet | Book button still works to submit a request |

---

## Rate Limiting

The Worker does not enforce rate limiting by default. For production:

1. **Cloudflare WAF (recommended)**: Dashboard -> Security -> WAF -> Rate Limiting Rules. Create a rule for the Worker route. No code changes needed.

2. **Worker-level**: Uncomment the `[unsafe.bindings]` block in `wrangler.toml` and add rate-limit logic in `worker.js`.

The free tier provides 100,000 requests/day, sufficient for a veterinary clinic chatbot at any realistic traffic level.
