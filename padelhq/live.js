/* PadelHQ live scoreboards.
   For every tournament that is on now (or starts within two days) and has a scoring platform,
   draw a scoreboard and keep it fresh.

   Where the scores come from, in order of preference:
   1. The PadelHQ score API (config.js -> apiBase). Works for every supported platform.
   2. Straight from the platform, for platforms that allow it from a browser (Alfred for Padel).
   3. Otherwise a button that opens the platform's own live page.

   Testing helpers (add to the page address):
     ?demo=1                      a scoreboard with made-up matches that move every few seconds
     ?scores=pbpi:43              a scoreboard for any tournament on a supported platform
     ?today=2026-11-19            show the page as it will look on that day
     ?api=http://localhost:8787   use a score API running on this computer */
import { getLive, validate, PROVIDERS, demo } from "./providers.js?v=3";

const cfg = window.PADELHQ_CONFIG || {};
const params = new URLSearchParams(location.search);
const localApi = params.get("api");
const API = (localApi && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(localApi) ? localApi : cfg.apiBase || "").replace(/\/+$/, "");

const DAY = 86400000;
const API_TIMEOUT = 12000;            // give up on a request after this long and try again on the next round
const OLD_AFTER = 90000;              // scores older than this get an "out of date" warning
const wrap = document.getElementById("live");
const boards = [];
let started = false;

// ---------- small helpers ----------
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false });
const hhmm = (t) => { const d = new Date(t); return isNaN(d) ? "" : clock.format(d); };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (ymd) => { const d = new Date(ymd + "T00:00:00Z"); return isNaN(d) ? ymd : DOW[d.getUTCDay()] + " " + d.getUTCDate() + " " + MON[d.getUTCMonth()]; };
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const plural = (n, word) => n + " " + word + (n === 1 ? "" : (/ch$/.test(word) ? "es" : "s"));

function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 5) return "just now";
  if (s < 90) return s + "s ago";
  return Math.round(s / 60) + " min ago";
}
/** Only touch the page when something actually changed: keeps focus, selection and scroll steady. */
function setHtml(node, html) {
  if (node && node.__html !== html) { node.innerHTML = html; node.__html = html; }
}
function remember(key, value) { try { sessionStorage.setItem("padelhq." + key, value); } catch (e) { /* private mode */ } }
function recall(key) { try { return sessionStorage.getItem("padelhq." + key) || ""; } catch (e) { return ""; } }

// ---------- one match ----------
function matchHtml(m, changed, inSchedule) {
  const a = m.teams[0], b = m.teams[1];
  const n = Math.max(a.sets.length, b.sets.length);
  const live = m.status === "live";
  const hasPts = live && (a.points != null || b.points != null);
  const head = [m.court, m.round, m.category].filter(Boolean).map(esc).join(" · ");

  let right = "";
  if (m.status === "next") {
    const when = [m.timeLabel, m.time ? hhmm(m.time) : ""].filter(Boolean).join(" ");
    if (when) right = '<span class="when">' + esc(when) + "</span>";
  } else if (inSchedule) {
    right = live ? '<span class="st on">Live</span>' : '<span class="st">Finished</span>';
  }

  const rows = m.teams.map((t, i) => {
    const o = m.teams[1 - i];
    let cells = "";
    for (let k = 0; k < n; k++) {
      const v = t.sets[k], w = o.sets[k];
      const cls = live && k === n - 1 ? "cur" : v != null && w != null && v > w ? "won" : "";
      cells += '<span class="set ' + cls + '">' + (v == null ? "" : v) + (t.tb && t.tb[k] != null ? "<sup>" + t.tb[k] + "</sup>" : "") + "</span>";
    }
    const pts = hasPts ? '<span class="pts">' + esc(t.points == null ? "–" : t.points) + "</span>" : "";
    const full = (t.full && t.full.length ? t.full : t.names).join(" / ");
    return '<div class="team' + (t.winner ? " win" : "") + '">' +
      '<span class="who" title="' + esc(full) + '">' + (t.serving ? '<i class="ball" title="Serving"></i>' : "") + esc(t.names.join(" / ")) + "</span>" +
      cells + pts + "</div>";
  }).join("");

  const score = (t) => t.sets.join(" ");
  const label = [head.replace(/ · /g, ", "), a.names.join(" and ") + " against " + b.names.join(" and "),
    live ? "in play" : m.status === "done" ? "finished" : "not started",
    n ? "sets " + score(a) + " to " + score(b) : ""].filter(Boolean).join(". ");

  return '<article class="match ' + m.status + (changed ? " chg" : "") + (m.featured ? " feat" : "") + '" style="--sets:' + n + '" aria-label="' + esc(label) + '">' +
    '<p class="mhead"><span>' + (m.featured ? '<b class="star">★ Featured</b> · ' : "") + head + "</span>" + right + "</p>" + rows +
    (m.featured && m.note ? '<p class="mnote">' + esc(m.note) + "</p>" : "") + "</article>";
}

// ---------- the parts of a board ----------
function column(title, list, changed) {
  if (!list.length) return "";
  return '<div class="col"><h3>' + title + " <span>" + list.length + "</span></h3>" + list.map((m) => matchHtml(m, changed.has(m.id), false)).join("") + "</div>";
}

function troubleHtml(b) {
  const p = PROVIDERS[b.provider];
  return '<div class="linkout"><p>Can\'t reach the scores right now. This page keeps trying by itself.</p>' +
    (b.url ? '<a class="btn" href="' + esc(b.url) + '" target="_blank" rel="noopener">Open them on ' + esc(p.name) + " ↗</a>" : "") + "</div>";
}

function linkHtml(b) {
  const p = PROVIDERS[b.provider];
  return '<div class="linkout"><p>' + esc(b.note) + "</p>" +
    (b.url ? '<a class="btn pri" href="' + esc(b.url) + '" target="_blank" rel="noopener">Open live scores on ' + esc(p.name) + " ↗</a>" : "") + "</div>";
}

function liveHtml(b) {
  const v = b.live, d = v.data, p = PROVIDERS[b.provider];
  if (!d) return v.error ? troubleHtml(b) : '<p class="none">Loading scores…</p>';
  if (!(d.live.length + d.recent.length + d.next.length)) {
    if (b.phase === "pre") return '<p class="none">Play starts ' + esc(b.startLabel) + ". Live scores will show here by themselves, no need to refresh.</p>";
    if (b.phase === "post") return '<p class="none">This tournament has finished.</p>';
    return '<p class="none">No matches yet. Scores show here as soon as ' + esc(p.name) + " starts scoring this tournament.</p>";
  }
  const idle = d.live.length || b.phase !== "on" ? "" :
    '<p class="none">No match on court right now.' + (b.hasTabs ? ' <button type="button" class="linkbtn" data-tab="schedule">See the order of play</button>' : "") + "</p>";
  return idle +
    '<div class="cols">' + column("On court now", d.live, v.changed) + column("Just finished", d.recent, v.changed) + column("Up next", d.next, v.changed) + "</div>";
}

const courtKey = (c) => c.name + "|" + c.venue;
function matchText(m) {
  return norm(m.teams.map((t) => (t.full || []).concat(t.names).join(" ")).join(" ") + " " + m.round + " " + m.category);
}
function scheduleHtml(b) {
  const v = b.sched, d = v.data, p = PROVIDERS[b.provider];
  if (!d || v.pending) return v.error && !v.pending ? troubleHtml(b) : '<p class="none">Loading the order of play…</p>';
  if (!d.days.length) {
    return '<p class="none">' + esc(p.name) + " has not published the order of play yet. This page checks again every minute, so it will appear here by itself.</p>";
  }
  const q = norm(b.q).trim(), cat = b.cat;
  let total = 0, shown = 0, onCourt = 0, finished = 0;
  const courts = d.courts.map((c) => {
    const ms = c.matches.filter((m) => {
      total++;
      if (m.status === "live") onCourt++; else if (m.status === "done") finished++;
      const keep = (!cat || m.category === cat) && (!q || matchText(m).includes(q));
      if (keep) shown++;
      return keep;
    });
    return { c, ms };
  }).filter((x) => x.ms.length);

  const filtered = !!(q || cat);
  const summary = '<p class="sum">' + plural(total, "match") + (onCourt ? " · " + onCourt + " on court" : "") + (finished ? " · " + finished + " finished" : "") +
    (filtered ? " · showing " + shown : "") + "</p>";
  if (!total) return '<p class="none">No matches are listed for ' + esc(dayLabel(d.date)) + " yet.</p>";
  if (!shown) {
    return summary + '<p class="none">No match found' + (q ? " for “" + esc(b.q.trim()) + "”" : "") + ' on this day. <button type="button" class="linkbtn" data-clear>Clear the filter</button></p>';
  }
  return summary + '<div class="courts">' + courts.map((x) => {
    const key = courtKey(x.c);
    const open = filtered || !b.closed.has(key);
    return '<details class="court" data-court="' + esc(key) + '"' + (open ? " open" : "") + "><summary><span class=\"cname\">" + esc(x.c.name) + "</span>" +
      (x.c.venue ? '<span class="cvenue">' + esc(x.c.venue) + "</span>" : "") + '<span class="ccount">' + x.ms.length + "</span></summary>" +
      x.ms.map((m) => matchHtml(m, v.changed.has(m.id), true)).join("") + "</details>";
  }).join("") + "</div>";
}

function pillFor(b) {
  if (b.demo) return { text: "Demo", cls: "on" };
  if (b.phase === "pre") return { text: b.startsIn === 1 ? "Starts tomorrow" : "Starts in " + b.startsIn + " days", cls: "" };
  if (b.phase === "post") return { text: "Finished", cls: "" };
  if (b.mode === "link") return { text: "On now", cls: "" };
  const d = b.live.data;
  if (!d) return { text: b.live.error ? "No connection" : "Connecting", cls: "" };
  return d.live.length ? { text: "Live", cls: "on" } : { text: "Between matches", cls: "" };
}

function drawHead(b) {
  const pill = pillFor(b);
  const node = b.el.querySelector("[data-pill]");
  if (node.textContent !== pill.text) node.textContent = pill.text;
  node.className = "pill" + (pill.cls ? " " + pill.cls : "");

  const upd = b.el.querySelector("[data-upd]");
  if (b.mode === "link") { setHtml(upd, ""); return; }
  const v = b.tab === "schedule" ? b.sched : b.live;
  const p = PROVIDERS[b.provider];
  let html = "";
  if (v.data) {
    const old = v.data.stale || (v.error && Date.now() - v.at > OLD_AFTER);
    html = old
      ? '<span class="warn">' + esc(p.name) + " is not answering. Showing what we had at " + esc(hhmm(v.data.fetchedAt)) + ".</span>"
      : '<span data-at="' + v.at + '">' + (b.phase === "on" ? "Updated " : "Checked ") + ago(v.at) + "</span>";
  }
  setHtml(upd, html);
}

function drawTabs(b) {
  const tabs = b.el.querySelector("[data-tabs]");
  tabs.hidden = !b.hasTabs;
  if (!b.hasTabs) return;
  const n = b.live.data ? b.live.data.live.length : 0;
  setHtml(tabs,
    '<button type="button" data-tab="live" aria-pressed="' + (b.tab === "live") + '">Live' + (n ? ' <span class="n">' + n + "</span>" : "") + "</button>" +
    '<button type="button" data-tab="schedule" aria-pressed="' + (b.tab === "schedule") + '">Order of play</button>');
}

function drawTools(b) {
  const tools = b.el.querySelector("[data-tools]");
  const d = b.sched.data;
  const show = b.hasTabs && b.tab === "schedule" && d && d.days.length > 0;
  tools.hidden = !show;
  if (!show) return;

  const today = new Date(b.today).toISOString().slice(0, 10);
  const picked = b.sched.pending ? b.day : d.date;
  setHtml(tools.querySelector("[data-days]"), d.days.map((x) =>
    '<button type="button" class="chip" data-day="' + esc(x.date) + '" aria-pressed="' + (x.date === picked) + '">' + (x.date === today ? "Today · " : "") + esc(dayLabel(x.date)) + "</button>").join(""));

  const cats = Array.from(new Set(d.courts.flatMap((c) => c.matches.map((m) => m.category)).filter(Boolean))).sort();
  if (b.cat && !cats.includes(b.cat) && !b.sched.pending) b.cat = "";
  setHtml(tools.querySelector("[data-cats]"), cats.length < 2 ? "" :
    '<button type="button" class="chip" data-cat="" aria-pressed="' + (!b.cat) + '">All</button>' +
    cats.map((c) => '<button type="button" class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (c === b.cat) + '">' + esc(c) + "</button>").join(""));
}

function drawBody(b) {
  setHtml(b.el.querySelector("[data-body]"), b.mode === "link" ? linkHtml(b) : b.tab === "schedule" ? scheduleHtml(b) : liveHtml(b));
}

function draw(b) { drawHead(b); drawTabs(b); drawTools(b); drawBody(b); }

// ---------- getting the scores ----------
async function apiGet(path, b, extra) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), API_TIMEOUT);
  try {
    const r = await fetch(API + path + "?provider=" + encodeURIComponent(b.provider) + "&id=" + encodeURIComponent(b.id) + (extra || ""), { cache: "no-store", signal: ctl.signal });
    const d = await r.json();
    if (!r.ok || !d || d.error && !d.fetchedAt) throw new Error((d && d.error) || "API answered " + r.status);
    return d;
  } finally { clearTimeout(timer); }
}

function prints(list) {
  const map = new Map();
  for (const m of list) map.set(m.id, JSON.stringify([m.status, m.teams.map((t) => [t.sets, t.points, t.winner])]));
  return map;
}
/** Store a fresh answer and work out which matches changed since the last one (they flash briefly). */
function accept(v, d, list) {
  const now = prints(list), changed = new Set();
  if (v.prints) now.forEach((val, k) => { if (v.prints.has(k) && v.prints.get(k) !== val) changed.add(k); });
  v.prints = now; v.changed = changed; v.data = d; v.error = ""; v.at = Date.now();
}

async function loadLive(b) {
  const v = b.live;
  if (v.busy) return;
  v.busy = true;
  try {
    let d;
    if (b.provider === "demo") d = Object.assign(demo(Date.now()), { fetchedAt: new Date().toISOString() });
    else if (b.mode === "api") {
      try {
        d = await apiGet("/v1/live", b);
        b.apiFails = 0;
      } catch (e) {
        if (!PROVIDERS[b.provider].browserOk) throw e;
        d = await getLive(b.provider, b.id);           // our API is having trouble: read the platform directly instead
        if (++b.apiFails >= 3) b.mode = "direct";
      }
    } else d = await getLive(b.provider, b.id);
    if (!d || !Array.isArray(d.live) || !Array.isArray(d.recent) || !Array.isArray(d.next)) throw new Error("Unexpected answer");
    accept(v, d, [].concat(d.live, d.recent, d.next));
  } catch (e) {
    v.error = String((e && e.message) || e); v.changed = new Set();
  } finally { v.busy = false; }
  draw(b);
}

async function loadSchedule(b) {
  const v = b.sched;
  if (v.busy) { v.again = true; return; }             // a newer request (another day) waits for the one in flight
  v.busy = true;
  const want = b.day;
  try {
    const d = await apiGet("/v1/schedule", b, want ? "&date=" + encodeURIComponent(want) : "");
    if (!d || !Array.isArray(d.days) || !Array.isArray(d.courts)) throw new Error("Unexpected answer");
    if (b.day === want) { accept(v, d, d.courts.flatMap((c) => c.matches)); v.pending = false; }
  } catch (e) {
    if (b.day === want) { v.error = String((e && e.message) || e); v.changed = new Set(); v.pending = false; }
  } finally { v.busy = false; }
  if (v.again) { v.again = false; return loadSchedule(b); }
  draw(b);
}

function delay(b) {
  if (b.provider === "demo") return 4000;
  const base = b.mode === "api" ? 15000 : 30000;
  if (b.phase !== "on") return 60000;                                    // nothing is being played: a slow check is enough
  return b.live.data && b.live.data.live.length ? base : base * 2;      // faster while a match is on court
}
async function refresh(b, force) {
  const jobs = [loadLive(b)];
  if (b.hasTabs && b.tab === "schedule" && (force || Date.now() - b.sched.at > 45000)) jobs.push(loadSchedule(b));
  await Promise.all(jobs);
}
function loop(b) {
  clearTimeout(b.timer);
  b.timer = setTimeout(async () => {
    if (!document.hidden) await refresh(b, false);     // do not spend data while the tab is in the background
    loop(b);
  }, delay(b));
}

// ---------- building boards ----------
function drawsUrl(url) {
  if (!/^https:\/\/(www\.)?pbpi\.or\.id\/[a-z]{2}\/tournaments\/[^?#]+/.test(url || "")) return "";
  return url.replace(/[?#].*$/, "") + "?tab=draws";
}

function addBoard(spec) {
  const p = PROVIDERS[spec.provider];
  if (!p) return null;
  const readable = p.live && spec.id && !validate(spec.provider, spec.id);
  let mode = "link";
  if (spec.provider === "demo") mode = "direct";
  else if (readable && API) mode = "api";
  else if (readable && p.browserOk) mode = "direct";
  if (mode === "link" && spec.phase !== "on") return null;       // nothing useful to show before or after play

  const b = Object.assign({
    el: document.createElement("section"), mode, url: "", stream: "", sub: "", eventId: "", startsIn: 0, startLabel: "", demo: false,
    live: { data: null, error: "", at: 0, changed: new Set() },
    sched: { data: null, error: "", at: 0, changed: new Set(), pending: false },
    day: "", q: "", cat: "", closed: new Set(), apiFails: 0, today: Date.now()
  }, spec);
  b.hasTabs = mode === "api" && !!p.schedule;
  b.tab = "live";
  if (b.hasTabs) {
    const saved = recall("tab." + b.key);
    b.tab = saved === "live" || saved === "schedule" ? saved : b.phase === "on" ? "live" : "schedule";
  }
  if (mode === "link") {
    b.note = readable
      ? "This tournament is scored on " + p.name + ". PadelHQ's own scoreboard is not switched on yet, so follow the score on their page for now."
      : "This tournament is scored on " + p.name + ". Follow the score on their page.";
  }

  const by = b.url ? '<a class="by" href="' + esc(b.url) + '" target="_blank" rel="noopener">Scores by ' + esc(p.name) + " ↗</a>" : '<span class="by">' + esc(p.name) + "</span>";
  const links = [];
  const draws = drawsUrl(b.url);
  if (draws) links.push('<a href="' + esc(draws) + '" target="_blank" rel="noopener">Draws on ' + esc(p.name) + " ↗</a>");
  if (b.stream) links.push('<a href="' + esc(b.stream) + '" target="_blank" rel="noopener">Watch the stream ↗</a>');
  if (b.eventId) links.push('<a href="#' + esc(b.eventId) + '" data-jump="' + esc(b.eventId) + '">Event details ↓</a>');
  const footNote = b.hasTabs ? "Match times are shown as listed on " + esc(p.name) + ". " : "";

  b.el.className = "board";
  b.el.id = "board-" + b.key;
  b.el.innerHTML =
    '<header class="bhead"><div class="brow"><span class="pill" data-pill></span><h2>' + esc(b.title) + "</h2></div>" +
    (b.sub ? '<p class="bsub">' + esc(b.sub) + "</p>" : "") +
    '<p class="bmeta">' + by + '<span class="upd" data-upd></span></p></header>' +
    (b.demo ? '<p class="demo">Demo data: these matches are made up, to show how a live board behaves.</p>' : "") +
    '<div class="tabs" data-tabs role="group" aria-label="What to show" hidden></div>' +
    '<div class="tools" data-tools hidden><div class="chips" data-days role="group" aria-label="Day"></div>' +
    '<div class="findrow"><label class="find"><span class="vh">Find a player in the order of play</span>' +
    '<input type="search" data-q placeholder="Find a player" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"></label>' +
    '<div class="chips" data-cats role="group" aria-label="Category"></div></div></div>' +
    '<div class="bbody" data-body></div>' +
    (footNote || links.length ? '<p class="bfoot">' + footNote + links.join("") + "</p>" : "");

  b.el.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-tab],[data-day],[data-cat],[data-clear]");
    if (!t || !b.el.contains(t)) return;
    if (t.hasAttribute("data-tab")) {
      const tab = t.getAttribute("data-tab");
      if (tab === b.tab) return;
      b.tab = tab; remember("tab." + b.key, tab);
      draw(b);
      if (tab === "schedule" && Date.now() - b.sched.at > 15000) loadSchedule(b);
    } else if (t.hasAttribute("data-day")) {
      const day = t.getAttribute("data-day");
      if (b.sched.data && day === b.sched.data.date && !b.sched.pending) return;
      b.day = day; b.sched.pending = true; b.sched.prints = null;
      draw(b); loadSchedule(b);
    } else if (t.hasAttribute("data-cat")) {
      b.cat = t.getAttribute("data-cat"); drawTools(b); drawBody(b);
    } else {
      b.q = ""; b.cat = "";
      const input = b.el.querySelector("[data-q]"); if (input) input.value = "";
      drawTools(b); drawBody(b);
    }
  });
  b.el.addEventListener("input", (ev) => {
    if (ev.target.matches && ev.target.matches("[data-q]")) { b.q = ev.target.value; drawBody(b); }
  });
  // <details> open/close does not bubble, so listen on the way down. Remember which courts were folded.
  b.el.addEventListener("toggle", (ev) => {
    const d = ev.target;
    if (!d.matches || !d.matches("details[data-court]") || b.q || b.cat) return;
    const key = d.getAttribute("data-court");
    if (d.open !== b.closed.has(key)) return;          // nothing changed (this also fires when a board is first drawn)
    if (d.open) b.closed.delete(key); else b.closed.add(key);
    const body = b.el.querySelector("[data-body]"); if (body) body.__html = null;   // the page no longer matches the last drawn text
  }, true);

  wrap.appendChild(b.el);
  boards.push(b);
  draw(b);
  if (mode !== "link") { refresh(b, true); loop(b); }
  return b;
}

/** Point the page's other links at the boards: hide the duplicate "on now" strip and make "Live scores" jump down. */
function decorate() {
  const strip = document.getElementById("now");
  boards.forEach((b) => {
    if (!b.eventId) return;
    if (strip) strip.querySelectorAll('[data-event="' + CSS.escape(b.eventId) + '"]').forEach((n) => { n.hidden = true; });
    if (b.mode === "link") return;
    document.querySelectorAll('[data-board="' + CSS.escape(b.eventId) + '"]').forEach((a) => {
      a.setAttribute("href", "#" + b.el.id);
      a.removeAttribute("target"); a.removeAttribute("rel");
      a.setAttribute("data-goto", b.el.id);
      a.textContent = "Live scores ↓";
    });
  });
  if (strip && boards.length) strip.hidden = !Array.from(strip.children).some((n) => !n.hidden);
}

function phaseOf(e, today) {
  if (e.s == null) return "";
  if (today < e.s) return e.s - today <= 2 * DAY ? "pre" : "";
  if (today > e.e) return today - e.e <= DAY ? "post" : "";
  return "on";
}

function start() {
  const hq = window.PADELHQ;
  if (!hq || started || !wrap) return;
  started = true;

  if (params.get("demo")) addBoard({ key: "demo", title: "Demo tournament", provider: "demo", id: "demo", phase: "on", demo: true, today: hq.today });
  const test = /^([a-z]+):([A-Za-z0-9-]+)$/.exec(params.get("scores") || "");
  if (test && PROVIDERS[test[1]]) {
    addBoard({ key: "test", title: "Test: " + PROVIDERS[test[1]].name + " " + test[2], provider: test[1], id: test[2], phase: "on", today: hq.today });
  }

  const order = { on: 0, pre: 1, post: 2 };
  hq.events
    .map((e) => ({ e, phase: e.scorer ? phaseOf(e, hq.today) : "" }))
    .filter((x) => x.phase)
    .sort((p, q) => order[p.phase] - order[q.phase] || (q.e.t1 ? 1 : 0) - (p.e.t1 ? 1 : 0) || p.e.s - q.e.s)
    .forEach((x) => {
      const e = x.e;
      addBoard({
        key: e.id, eventId: e.id, title: e.name, provider: e.scoring, id: e.scoringId, url: e.scores, stream: e.stream, phase: x.phase, today: hq.today,
        sub: [hq.rangeDow(e), [e.venue, e.city].filter(Boolean).join(", ")].filter(Boolean).join(" · "),
        startsIn: Math.round((e.s - hq.today) / DAY), startLabel: "on " + hq.fmtDow(e.s)
      });
    });

  wrap.hidden = !boards.length;
  decorate();
  if (!boards.length) return;

  setInterval(() => {                       // keep "Updated 12s ago" ticking between refreshes, and flag scores that went old
    boards.forEach((b) => { if (b.mode !== "link") drawHead(b); });
  }, 1000);
  const wake = () => { if (!document.hidden) boards.forEach((b) => { if (b.mode !== "link" && Date.now() - b.live.at > 5000) refresh(b, true); }); };
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("online", wake);
}

document.addEventListener("click", (ev) => {
  const a = ev.target.closest && ev.target.closest("[data-goto]");
  if (!a) return;
  const target = document.getElementById(a.getAttribute("data-goto"));
  if (!target) return;
  ev.preventDefault();
  target.scrollIntoView({ block: "start" });
});
document.addEventListener("padelhq:rendered", decorate);
document.addEventListener("padelhq:ready", start);
if (window.PADELHQ) start();
