/* PadelHQ live scoreboards.
   For every tournament that is on today and has a scoring platform, draw a scoreboard and keep it fresh.

   Where the scores come from, in order of preference:
   1. The PadelHQ score API (config.js -> apiBase). Works for every supported platform.
   2. Straight from the platform, for platforms that allow it from a browser (Alfred for Padel).
   3. Otherwise a button that opens the platform's own live page.

   Testing helpers (add to the page address):
     ?demo=1                 a scoreboard with made-up matches that move every few seconds
     ?scores=pbpi:43         a scoreboard for any tournament on a supported platform
     ?api=http://localhost:8787   use a score API running on this computer */
import { getLive, validate, PROVIDERS, demo } from "./providers.js?v=2";

const cfg = window.PADELHQ_CONFIG || {};
const params = new URLSearchParams(location.search);
const localApi = params.get("api");
const API = (localApi && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(localApi) ? localApi : cfg.apiBase || "").replace(/\/+$/, "");

const POLL_API = 15000, POLL_DIRECT = 30000, POLL_DEMO = 4000;
const wrap = document.getElementById("live");
const boards = [];

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false });
const hhmm = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : clock.format(d) + " WIB"; };

function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 5) return "just now";
  if (s < 90) return s + "s ago";
  return Math.round(s / 60) + " min ago";
}

// ---------- one match ----------
function matchHtml(m, changed) {
  const n = Math.max(m.teams[0].sets.length, m.teams[1].sets.length);
  const live = m.status === "live";
  const head = [m.court, m.round, m.category].filter(Boolean).map(esc).join(" · ");
  let when = "";
  if (m.status === "next") when = [m.timeLabel, m.time ? hhmm(m.time) : ""].filter(Boolean).join(" ");
  const rows = m.teams.map((t, i) => {
    const o = m.teams[1 - i];
    let cells = "";
    for (let k = 0; k < n; k++) {
      const v = t.sets[k], w = o.sets[k];
      const current = live && k === n - 1;
      const cls = current ? "cur" : v != null && w != null && v > w ? "won" : "";
      cells += '<span class="set ' + cls + '">' + (v == null ? "" : v) + (t.tb && t.tb[k] != null ? "<sup>" + t.tb[k] + "</sup>" : "") + "</span>";
    }
    const pts = live ? '<span class="pts">' + esc(t.points == null ? "–" : t.points) + "</span>" : "";
    return '<div class="team' + (t.winner ? " win" : "") + '">' +
      '<span class="who">' + (t.serving ? '<i class="ball" title="Serving"></i>' : "") + esc(t.names.join(" / ")) + "</span>" +
      cells + pts + "</div>";
  }).join("");
  return '<article class="match ' + m.status + (changed ? " chg" : "") + '" style="--sets:' + n + '">' +
    '<p class="mhead"><span>' + head + "</span>" + (when ? "<span>" + esc(when) + "</span>" : "") + "</p>" + rows + "</article>";
}

// ---------- one board ----------
function column(title, list, changed, emptyText) {
  if (!list.length && !emptyText) return "";
  return '<div class="col"><h3>' + title + (list.length ? " <span>" + list.length + "</span>" : "") + "</h3>" +
    (list.length ? list.map((m) => matchHtml(m, changed.has(m.id))).join("") : '<p class="none">' + esc(emptyText) + "</p>") + "</div>";
}

function draw(b) {
  const p = PROVIDERS[b.provider] || { name: b.provider };
  const d = b.data;
  const link = b.url ? '<a class="by" href="' + esc(b.url) + '" target="_blank" rel="noopener">Scores by ' + esc(p.name) + " ↗</a>" : '<span class="by">' + esc(p.name) + "</span>";
  let body;

  if (b.mode === "link") {
    body = '<div class="linkout"><p>' + esc(b.note) + "</p>" +
      (b.url ? '<a class="btn pri" href="' + esc(b.url) + '" target="_blank" rel="noopener">Open live scores on ' + esc(p.name) + " ↗</a>" : "") + "</div>";
  } else if (!d) {
    body = b.error
      ? '<div class="linkout"><p>Can\'t reach the scores right now. Trying again every few seconds.</p>' + (b.url ? '<a class="btn" href="' + esc(b.url) + '" target="_blank" rel="noopener">Open them on ' + esc(p.name) + " ↗</a>" : "") + "</div>"
      : '<p class="none">Loading scores…</p>';
  } else {
    const any = d.live.length + d.recent.length + d.next.length;
    body = any
      ? (d.live.length ? "" : '<p class="none">No match on court right now.</p>') + '<div class="cols">' +
        column("On court now", d.live, b.changed, "") +
        column("Just finished", d.recent, b.changed, "") +
        column("Up next", d.next, b.changed, "") + "</div>"
      : '<p class="none">No matches yet. Scores show up here as soon as ' + esc(p.name) + " starts scoring this tournament.</p>";
  }

  let status = "";
  if (b.mode !== "link") {
    if (d && (b.error || d.stale)) status = '<span class="upd warn" data-upd>' + esc(p.name) + " is not answering. Showing scores from " + esc(hhmm(d.fetchedAt)) + ".</span>";
    else if (d) status = '<span class="upd" data-upd data-at="' + b.at + '">Updated ' + ago(b.at) + "</span>";
  }
  const liveCount = d ? d.live.length : 0;
  b.el.innerHTML =
    '<header class="bhead"><span class="pill' + (liveCount ? " on" : "") + '">' + (b.demo ? "Demo" : liveCount ? "Live" : "Scores") + "</span>" +
    "<h2>" + esc(b.title) + "</h2>" + link + status + "</header>" +
    (b.demo ? '<p class="demo">Demo data: these matches are made up, to show how a live board behaves.</p>' : "") + body;
}

function fingerprints(d) {
  const map = new Map();
  for (const m of [].concat(d.live, d.recent, d.next)) map.set(m.id, JSON.stringify([m.status, m.teams.map((t) => [t.sets, t.points, t.winner])]));
  return map;
}

async function load(b) {
  try {
    let d;
    if (b.provider === "demo") d = Object.assign(demo(Date.now()), { fetchedAt: new Date().toISOString() });
    else if (b.mode === "api") {
      const r = await fetch(API + "/v1/live?provider=" + encodeURIComponent(b.provider) + "&id=" + encodeURIComponent(b.id), { cache: "no-store" });
      d = await r.json();
      if (!r.ok || !d || !Array.isArray(d.live)) throw new Error((d && d.error) || "API answered " + r.status);
    } else d = await getLive(b.provider, b.id);

    const now = fingerprints(d), changed = new Set();
    if (b.prints) now.forEach((v, k) => { if (b.prints.get(k) !== v) changed.add(k); });
    b.prints = now; b.changed = changed; b.data = d; b.error = ""; b.at = Date.now();
  } catch (e) {
    b.error = String((e && e.message) || e); b.changed = new Set();
  }
  draw(b);
}

function schedule(b) {
  clearTimeout(b.timer);
  const every = b.provider === "demo" ? POLL_DEMO : b.mode === "api" ? POLL_API : POLL_DIRECT;
  b.timer = setTimeout(async () => {
    if (!document.hidden) await load(b);   // do not spend data while the tab is in the background
    schedule(b);
  }, every);
}

function addBoard(title, provider, id, url, isDemo) {
  const p = PROVIDERS[provider];
  if (!p) return;
  const el = document.createElement("section");
  el.className = "board";
  wrap.appendChild(el);
  const b = { el, title, provider, id, url: url || "", demo: !!isDemo, changed: new Set(), data: null, error: "", at: 0 };

  const readable = p.live && id && !validate(provider, id);
  if (provider === "demo") b.mode = "direct";
  else if (readable && API) b.mode = "api";
  else if (readable && p.browserOk) b.mode = "direct";
  else {
    b.mode = "link";
    b.note = readable
      ? "This tournament is scored on " + p.name + ". PadelHQ's score service is not connected yet, so follow the score on their page for now."
      : "This tournament is scored on " + p.name + ". PadelHQ can't show their scores on this page yet, so follow them on their page.";
  }
  boards.push(b);
  draw(b);
  if (b.mode !== "link") { load(b); schedule(b); }
}

function start() {
  const hq = window.PADELHQ;
  if (!hq || boards.length) return;

  if (params.get("demo")) addBoard("Demo tournament", "demo", "demo", "", true);
  const test = /^([a-z]+):([A-Za-z0-9-]+)$/.exec(params.get("scores") || "");
  if (test && PROVIDERS[test[1]]) addBoard("Test: " + PROVIDERS[test[1]].name + " " + test[2], test[1], test[2], "");

  hq.events.filter((e) => e.scorer && hq.state(e) === "live").forEach((e) => addBoard(e.name, e.scoring, e.scoringId, e.scores));

  wrap.hidden = !boards.length;
  if (!boards.length) return;
  setInterval(() => {                       // keep "Updated 12s ago" ticking between refreshes
    wrap.querySelectorAll("[data-at]").forEach((n) => { n.textContent = "Updated " + ago(Number(n.dataset.at)); });
  }, 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) boards.forEach((b) => { if (b.mode !== "link") load(b); }); });
}

if (window.PADELHQ) start();
document.addEventListener("padelhq:ready", start);
