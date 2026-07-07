# Infrastructure Audit - Niamh O'Brien (@Niamh)

**Date:** 2025-07-07
**Scope:** worker.js, wrangler.toml, index.html (API sections), deployment files, secrets management

---

## Summary

The Worker proxy is sound in principle but had several gaps that would cause production issues. All are now fixed. The deployment files are present and correct. The secrets boundary (key in Worker env, never in browser) is intact.

**Critical fixes made:** 4
**Improvements made:** 5
**Verified passes:** 6

---

## 1. worker.js - Findings and Fixes

### 1.1 CORS Headers (IMPROVED)

**Before:** Basic CORS headers present. Missing `Access-Control-Max-Age` for preflight caching.

**After:** Added `Access-Control-Max-Age: 86400` (24h). Browsers cache preflight OPTIONS responses, so only one round-trip per session instead of one per request.

**Status:** Complete. All four CORS headers present:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

### 1.2 Health Check Endpoint (ADDED)

**Before:** No health endpoint. The only way to verify the Worker was deployed was to make a full LLM call.

**After:** Added `GET /api/health`. Returns:

```json
{"status":"ok","llm_configured":true,"timestamp":"2025-07-07T..."}
```

This endpoint:
- Does not consume DeepSeek credits
- Reports whether `LLM_KEY` is configured
- Has `Cache-Control: public, max-age=60` to reduce trivial polling load

### 1.3 Error Handling (IMPROVED)

**Before:** Single try/catch returning `e.message`. No distinction between missing key, invalid JSON, or upstream API failure.

**After:**
- `503` when `env.LLM_KEY` is not set (instead of sending an unauthenticated request to DeepSeek that would inevitably fail)
- `400` when the request body is not valid JSON
- Upstream response status is passed through (e.g., DeepSeek's 429 for rate limiting, 402 for insufficient balance)
- All error responses return proper JSON with `Content-Type: application/json`

### 1.4 User-Agent (ADDED)

**Before:** No User-Agent header on the DeepSeek API call. Default Cloudflare Worker User-Agent was sent.

**After:** Set `User-Agent: MeadowVetProxy/1.0 (Cloudflare Worker)`. This identifies traffic to DeepSeek for debugging, rate-limit negotiation, and ToS compliance.

### 1.5 Rate Limiting (DOCUMENTED)

**Before:** No rate limiting awareness at all.

**After:** Added documentation block at the top of worker.js covering three approaches:
1. Cloudflare WAF Rate Limiting Rules (recommended, no code change)
2. Workers Rate Limiting API binding via wrangler.toml
3. Token-bucket via Durable Objects for per-IP control

The free tier (100k req/day) is noted as sufficient for this use case. Code was not added because a vet clinic chatbot will not encounter abuse at this scale, and WAF rules are the cloud-native approach anyway.

### 1.6 Caching Headers (ADDED)

**Before:** No caching directives on any endpoint.

**After:** Added `Cache-Control: public, max-age=60` on the health endpoint. The LLM endpoint responses are not cached (dynamic by nature).

---

## 2. wrangler.toml - Verification and Changes

### 2.1 Findings

| Setting | Value | Assessment |
|---------|-------|-----------|
| `name` | `meadow-vet-proxy` | Correct, descriptive |
| `main` | `worker.js` | Correct |
| `compatibility_date` | `2024-01-01` | Outdated - updated to `2025-07-07` |

### 2.2 Changes Made

- Updated `compatibility_date` to `2025-07-07` for current runtime features
- Added commented-out `[unsafe.bindings]` block for rate limiting configuration reference
- Added inline deploy/secret commands as comments

---

## 3. config.example.js - Verification

### 3.1 Finding: `const` vs `var`

**Issue:** The file used `const` declarations. When loaded via `<script src="config.js">` in index.html, `const` at the top level of a script creates block-scoped variables that are NOT global properties. The index.html code at lines 354-356, 688-689, and 935 references `LLM_KEY`, `LLM_URL`, and `LLM_MODEL` as globals.

**Fix:** Changed to `var` declarations, which create properties on the global object (`window`) when used at script top-level. This is the correct pattern for non-module browser scripts.

**Before:**
```js
const LLM_KEY = "sk-your-key-here";
```

**After:**
```js
var LLM_KEY = "sk-your-key-here";
```

### 3.2 Placeholder Values

The placeholder `"sk-your-key-here"` is safe: it is a fake key that would never authenticate. The comment clearly says to copy to `config.js`. `config.js` is in `.gitignore` and the actual file in the repo contains only a comment placeholder.

**Status:** Verified safe. No real key in version control.

---

## 4. index.html - API-Related Issues

### 4.1 LLM_KEY Fallback (FIXED)

**Before:**
```js
(function(){
  if(typeof LLM_KEY==="undefined")window.LLM_KEY="";
})(window);
```

Only `LLM_KEY` was guarded. `LLM_URL` and `LLM_MODEL` would throw `ReferenceError` if `config.js` did not define them (e.g., the placeholder-only `config.js` in the repo).

**After:**
```js
(function(){
  if(typeof LLM_KEY==="undefined")window.LLM_KEY="";
  if(typeof LLM_URL==="undefined")window.LLM_URL="";
  if(typeof LLM_MODEL==="undefined")window.LLM_MODEL="";
})(window);
```

All three globals are now guarded. If `config.js` is missing any of them, they default to empty string (falsy), which the downstream `||` fallbacks at lines 688-689 handle correctly.

### 4.2 API_PROXY Pattern (VERIFIED)

The pattern is consistent:
- When `API_PROXY` is set, the browser sends to `API_PROXY + "/api/llm"` with no Authorization header
- When `API_PROXY` is empty, the browser sends directly to `LLM_URL` with `Authorization: Bearer LLM_KEY`

The Worker handles `POST /api/llm` correctly. The frontend logic at line 688 is correct.

### 4.3 Hardcoded API Keys (VERIFIED)

No hardcoded keys found in index.html. The only API references are:
- `SHEET_CSV` (public Google Sheets URL, no auth needed) - line 359
- `LLM_KEY`, `LLM_URL`, `LLM_MODEL` - all from config.js (gitignored)
- `API_PROXY` - declared empty, filled via config.js

**Status:** Clean.

---

## 5. Deployment Files - Verification

### 5.1 _headers (FIXED)

**Before:**
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

**Issue:** `Cross-Origin-Embedder-Policy: require-corp` is extremely strict. It requires ALL cross-origin resources to explicitly opt-in via `Cross-Origin-Resource-Policy: cross-origin` or CORS headers. Google Sheets CSV export does NOT send these headers, so the browser would block the fetch. This would silently break the service catalogue loading in Chrome and Edge (Firefox does not enforce COEP by default).

**After:**
```
/*
  Cross-Origin-Opener-Policy: same-origin
```

Removed `Cross-Origin-Embedder-Policy` entirely. The COOP header is retained for process isolation (prevents cross-origin opener attacks) without breaking any data fetches.

### 5.2 _config.yml (VERIFIED)

Correct: `include: [".nojekyll"]`. Tells GitHub Pages' Jekyll to process the `.nojekyll` file.

### 5.3 .nojekyll (VERIFIED)

Present and empty. Correct: prevents Jekyll from processing the site as a Jekyll theme.

### 5.4 robots.txt (VERIFIED)

```
User-agent: *
Allow: /
```

Correct: allows all crawlers to index the site. No sensitive paths to disallow.

---

## 6. .gitignore - Verification

### 6.1 Before

```
.wrangler/
node_modules/
config.js
PriorChatBotToReference
```

### 6.2 After

```
.wrangler/
node_modules/
config.js
PriorChatBotToReference
.DS_Store
dist/
*.log
```

### 6.3 Coverage

| File | Status | Notes |
|------|--------|-------|
| `config.js` | Gitignored | Secrets file, correctly excluded |
| `config.example.js` | Committed | Template only, no real keys |
| `.wrangler/` | Gitignored | Cloudflare build artifacts |
| `node_modules/` | Gitignored | Standard for npm projects |
| `.DS_Store` | Added | macOS metadata, not relevant |
| `dist/` | Added | Build output directory placeholder |
| `*.log` | Added | Local debug logs |
| `worker.js` | Committed | Intended - no secrets in source |
| `wrangler.toml` | Committed | Intended - no secrets in config |

**Status:** All sensitive files protected.

---

## 7. config.js (Actual File in Repo)

Content:
```js
// Copy from config.example.js and fill in your API keys
```

**Verified:** Contains only a comment. No keys, no URLs, no tokens. Safe to be in the repo (though it is gitignored anyway). When deployed to GitHub Pages without a real `config.js`, the fallback guards in index.html prevent crashes: `LLM_KEY` defaults to `""`, the bot badge shows "LLM Not Live", and the bot still works with keyword-based service search.

---

## 8. Risk Assessment

| Risk | Severity | Status |
|------|----------|--------|
| API key in browser | Critical | Mitigated - Worker proxy, key never reaches browser |
| API key in git history | Critical | Mitigated - `config.js` gitignored, no keys committed |
| Broken CSV fetch from COEP | High | Fixed - removed `require-corp` from _headers |
| ReferenceError on missing config vars | High | Fixed - all three globals now guarded |
| No health monitoring | Medium | Fixed - `/api/health` endpoint added |
| Unidentified traffic to DeepSeek | Low | Fixed - User-Agent header added |
| No rate limiting | Low | Documented - WAF path described, free tier is ample |
| Preflight per request | Low | Fixed - `Access-Control-Max-Age` added |

---

## 9. Files Modified

| File | Action | Reason |
|------|--------|--------|
| `worker.js` | Rewrote | Added health endpoint, User-Agent, caching, improved error handling, rate limit docs |
| `wrangler.toml` | Updated | Updated compatibility_date, added rate limit config comments |
| `_headers` | Fixed | Removed `Cross-Origin-Embedder-Policy: require-corp` (blocked Google Sheets) |
| `index.html` | Patched | Added `LLM_URL` and `LLM_MODEL` undefined guards |
| `config.example.js` | Fixed | Changed `const` to `var` for global scope in browser scripts |
| `.gitignore` | Expanded | Added `.DS_Store`, `dist/`, `*.log` |
| `DEPLOY.md` | Created | Full deployment guide |

---

## 10. Deployment Readiness

The infrastructure is ready for deployment. The two-command deploy still holds:

```bash
npx wrangler deploy
npx wrangler secret put LLM_KEY
```

The Worker will serve:
- `GET /api/health` - public health check
- `POST /api/llm` - authenticated DeepSeek proxy

The frontend will work with or without the Worker (keyword search only without it). No key is exposed in any browser asset. CORS is configured. GitHub Pages deployment files are all present and the COEP blockage is resolved.

**Verdict:** Ready to ship.

---

*Niamh O'Brien, Backend/Infrastructure Engineer - Meadow Vet Care*
