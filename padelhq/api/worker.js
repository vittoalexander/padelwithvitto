/* PadelHQ score API (Cloudflare Worker).

   What it is: a go-between. The PadelHQ page asks this API for scores; the API asks the tournament's
   scoring platform, tidies the answer into one common shape and remembers it for a few seconds.

   Why it exists:
   - Some platforms (PBPI) do not let another website's page read their data directly from the browser.
   - One shared short memory ("cache") means 1 or 500 people watching cost the platform the same few requests.

   Routes:
     GET /v1/live?provider=pbpi&id=46                       live, just-finished and next matches
     GET /v1/schedule?provider=pbpi&id=46&date=2026-11-19   one day's full order of play (date is optional)
     GET /v1/providers                                      which providers this API can read
     GET /v1/health                                         simple "am I up" check

   It only ever calls the fixed provider addresses in ../providers.js with a checked id, so it cannot be
   used to fetch arbitrary web pages. */
import { getLive, getSchedule, getLeague, validate, validateSchedule, validateLeague, PROVIDERS } from "../providers.js";

const FRESH = { live: 12, schedule: 30, demo: 4, league: 60 };   // seconds a remembered answer is served before asking the provider again
const STALE_SECONDS = 900;                           // if the provider is down, keep showing the last good answer for this long
const DEFAULT_ORIGINS = "https://vittoalexander.github.io,http://localhost:8788,http://127.0.0.1:8788";

const memory = new Map();      // short memory inside this running copy of the Worker
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

const ageOf = (v) => (v && v.fetchedAt ? (Date.now() - Date.parse(v.fetchedAt)) / 1000 : Infinity);

/* Two layers of memory: this Worker's own (fast, but each running copy has its own), and Cloudflare's
   shared cache where it is available. Whichever holds the newer answer wins. */
async function readCache(key) {
  let best = memory.get(key) || null;
  try {
    if (typeof caches !== "undefined" && caches.default) {
      const hit = await caches.default.match(key);
      if (hit) {
        const v = await hit.json();
        if (ageOf(v) < ageOf(best)) best = v;
      }
    }
  } catch (e) { /* the shared cache is a bonus; carry on without it */ }
  return best;
}
async function writeCache(key, value, ctx) {
  memory.set(key, value);
  if (memory.size > 300) memory.delete(memory.keys().next().value);
  try {
    if (typeof caches !== "undefined" && caches.default) {
      const res = new Response(JSON.stringify(value), { headers: { "content-type": "application/json", "cache-control": "public, max-age=" + STALE_SECONDS } });
      const put = caches.default.put(key, res);
      if (ctx && ctx.waitUntil) ctx.waitUntil(put.catch(() => {})); else await put;
    }
  } catch (e) { /* see readCache */ }
}

/* Serve a remembered answer while it is fresh; otherwise ask the provider. If the provider fails,
   fall back to the last good answer, clearly marked as stale. */
async function remembered(key, freshSeconds, ctx, load) {
  const cached = await readCache(key);
  const age = ageOf(cached);
  if (cached && age < freshSeconds) return Object.assign({}, cached, { cached: true });

  if (!inFlight.has(key)) {
    inFlight.set(key, (async () => {
      try {
        const fresh = await load();
        await writeCache(key, fresh, ctx);
        return fresh;
      } finally { inFlight.delete(key); }
    })());
  }
  try {
    return await inFlight.get(key);
  } catch (err) {
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
      const list = Object.keys(PROVIDERS).map((k) => ({ key: k, name: PROVIDERS[k].name, live: !!PROVIDERS[k].live, schedule: !!PROVIDERS[k].schedule, idHelp: PROVIDERS[k].idHelp || "" }));
      return json({ providers: list }, 200, Object.assign({ "cache-control": "public, max-age=3600" }, cors));
    }

    const provider = (url.searchParams.get("provider") || "").toLowerCase();
    const id = url.searchParams.get("id") || "";
    const failed = (err) => json({ error: "Could not read scores from " + PROVIDERS[provider].name, detail: String(err.message || err), provider }, 502, Object.assign({ "cache-control": "no-store" }, cors));
    const ok = (data) => json(data, 200, Object.assign({ "cache-control": "public, max-age=5" }, cors));

    if (path === "/v1/live") {
      const bad = validate(provider, id);
      if (bad) return json({ error: bad }, 400, cors);
      try {
        const key = "https://padelhq.cache/v1/live/" + provider + "/" + id;
        return ok(await remembered(key, provider === "demo" ? FRESH.demo : FRESH.live, ctx, () => getLive(provider, id)));
      } catch (err) { return failed(err); }
    }
    if (path === "/v1/schedule") {
      const date = url.searchParams.get("date") || "";
      const bad = validateSchedule(provider, id, date);
      if (bad) return json({ error: bad }, 400, cors);
      try {
        const key = "https://padelhq.cache/v1/schedule/" + provider + "/" + id + "/" + (date || "auto");
        return ok(await remembered(key, FRESH.schedule, ctx, () => getSchedule(provider, id, date)));
      } catch (err) { return failed(err); }
    }
    if (path === "/v1/league") {
      const bad = validateLeague(provider, id);
      if (bad) return json({ error: bad }, 400, cors);
      try {
        const key = "https://padelhq.cache/v1/league/" + provider + "/" + id;
        return ok(await remembered(key, FRESH.league, ctx, () => getLeague(provider, id)));
      } catch (err) { return failed(err); }
    }
    return json({ error: "Not found" }, 404, cors);
  }
};
