/* PadelHQ score API (Cloudflare Worker).

   What it is: a go-between. The PadelHQ page asks this API for scores; the API asks the tournament's
   scoring platform, tidies the answer into one common shape and remembers it for a few seconds.

   Why it exists:
   - Some platforms (PBPI) do not let another website's page read their data directly from the browser.
   - One shared short memory ("cache") means 1 or 500 people watching cost the platform the same few requests.

   Routes:
     GET /v1/live?provider=pbpi&id=46      live, just-finished and next matches
     GET /v1/providers                     which providers this API can read
     GET /v1/health                        simple "am I up" check

   It only ever calls the fixed provider addresses in ../providers.js with a checked id, so it cannot be
   used to fetch arbitrary web pages. */
import { getLive, validate, PROVIDERS } from "../providers.js";

const FRESH_SECONDS = 12;      // serve a remembered answer for this long before asking the provider again
const STALE_SECONDS = 900;     // if the provider is down, keep showing the last good answer for this long
const DEFAULT_ORIGINS = "https://vittoalexander.github.io,http://localhost:8788,http://127.0.0.1:8788";

const memory = new Map();      // fallback memory when the Cloudflare cache is not available (local runs)
const inFlight = new Map();    // so simultaneous visitors share one provider request

function corsHeaders(request, env) {
  const allowed = String((env && env.ALLOWED_ORIGINS) || DEFAULT_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get("origin") || "";
  const h = { vary: "Origin" };
  if (allowed.includes("*")) h["access-control-allow-origin"] = "*";
  else if (origin && allowed.includes(origin)) h["access-control-allow-origin"] = origin;
  h["access-control-allow-methods"] = "GET, OPTIONS";
  h["access-control-max-age"] = "86400";
  return h;
}
function json(body, status, extra) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }, extra || {})
  });
}

async function readCache(key) {
  if (typeof caches !== "undefined" && caches.default) {
    const hit = await caches.default.match(key);
    return hit ? hit.json() : null;
  }
  return memory.get(key) || null;
}
async function writeCache(key, value, ctx) {
  if (typeof caches !== "undefined" && caches.default) {
    const res = new Response(JSON.stringify(value), { headers: { "content-type": "application/json", "cache-control": "public, max-age=" + STALE_SECONDS } });
    const put = caches.default.put(key, res);
    if (ctx && ctx.waitUntil) ctx.waitUntil(put); else await put;
  } else {
    memory.set(key, value);
    if (memory.size > 200) memory.delete(memory.keys().next().value);
  }
}

async function live(provider, id, ctx) {
  const key = "https://padelhq.cache/v1/live/" + provider + "/" + id;
  const cached = await readCache(key);
  const age = cached ? (Date.now() - Date.parse(cached.fetchedAt)) / 1000 : Infinity;
  if (cached && age < (provider === "demo" ? 4 : FRESH_SECONDS)) return Object.assign({}, cached, { cached: true });

  if (!inFlight.has(key)) {
    inFlight.set(key, (async () => {
      try {
        const fresh = await getLive(provider, id);
        await writeCache(key, fresh, ctx);
        return fresh;
      } finally { inFlight.delete(key); }
    })());
  }
  try {
    return await inFlight.get(key);
  } catch (err) {
    // Provider is down or changed its format: fall back to the last good answer, clearly marked.
    if (cached && age < STALE_SECONDS) return Object.assign({}, cached, { stale: true, cached: true, error: String(err.message || err) });
    throw err;
  }
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return json({ error: "Only GET is supported" }, 405, cors);

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/" || path === "/v1/health") {
      return json({ ok: true, service: "padelhq-scores", time: new Date().toISOString() }, 200, cors);
    }
    if (path === "/v1/providers") {
      const list = Object.keys(PROVIDERS).map((k) => ({ key: k, name: PROVIDERS[k].name, live: !!PROVIDERS[k].live, idHelp: PROVIDERS[k].idHelp || "" }));
      return json({ providers: list }, 200, Object.assign({ "cache-control": "public, max-age=3600" }, cors));
    }
    if (path === "/v1/live") {
      const provider = (url.searchParams.get("provider") || "").toLowerCase();
      const id = url.searchParams.get("id") || "";
      const bad = validate(provider, id);
      if (bad) return json({ error: bad }, 400, cors);
      try {
        const data = await live(provider, id, ctx);
        return json(data, 200, Object.assign({ "cache-control": "public, max-age=5" }, cors));
      } catch (err) {
        return json({ error: "Could not read scores from " + PROVIDERS[provider].name, detail: String(err.message || err), provider }, 502, Object.assign({ "cache-control": "no-store" }, cors));
      }
    }
    return json({ error: "Not found" }, 404, cors);
  }
};
