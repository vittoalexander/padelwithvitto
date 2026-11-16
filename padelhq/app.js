/* PadelHQ calendar. Plain JavaScript, no build step.
   Data: the list in events.js, or a Google Sheet when sheetCsvUrl is set in config.js.
   Live scores are drawn by live.js, which reads the event list this file publishes on window.PADELHQ. */
(function () {
  "use strict";

  var CONFIG = window.PADELHQ_CONFIG || {};
  var SHEET_CSV_URL = CONFIG.sheetCsvUrl || "";
  // Display names for scoring platforms. "live" = PadelHQ can show the score itself; otherwise it links out.
  var SCORERS = {
    pbpi: { name: "PBPI", live: true, home: "https://www.pbpi.or.id/en/tournaments" },
    alfred: { name: "Alfred for Padel", live: true, home: "https://www.alfredforpadel.com/" },
    incourta: { name: "Incourta", live: false, home: "https://incourta.com/events" },
    recourt: { name: "Recourt", live: false, home: "https://recourt.id/" },
    skorpad: { name: "SkorPad", live: false, home: "https://skorpad.com/" },
    padelscore: { name: "PadelScore.id", live: false, home: "https://padelscore.id/" }
  };

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MON = MONTHS.map(function (m) { return m.slice(0, 3); });
  var DAY = 86400000;

  // ---------- dates (plain calendar days, counted in Indonesia time) ----------
  function parse(s) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || "").trim());
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function todayWIB() {
    var p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return parse(p);
  }
  function fmt(t, withYear) {
    var d = new Date(t);
    return d.getUTCDate() + " " + MON[d.getUTCMonth()] + (withYear ? " " + d.getUTCFullYear() : "");
  }
  function range(e) {
    if (e.s == null) return "Dates to be confirmed";
    if (e.endKnown === false) return "From " + fmt(e.s, true) + " (end date to be confirmed)";
    if (e.s === e.e) return fmt(e.s, true);
    var a = new Date(e.s), b = new Date(e.e);
    if (a.getUTCMonth() === b.getUTCMonth()) return a.getUTCDate() + "–" + fmt(e.e, true);
    return fmt(e.s) + " – " + fmt(e.e, true);
  }
  function inDays(n) { return n === 0 ? "today" : n === 1 ? "tomorrow" : "in " + n + " days"; }

  // ---------- data ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function safeUrl(u) { u = String(u || "").trim(); return /^https?:\/\//i.test(u) ? u : ""; }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  function normalise(raw) {
    var e = {
      name: String(raw.name || "").trim(),
      fullName: String(raw.fullName || "").trim(),
      organizer: String(raw.organizer || "").trim(),
      tier: String(raw.tier || "").trim(),
      level: String(raw.level || "").trim(),
      city: String(raw.city || "").trim(),
      venue: String(raw.venue || "").trim(),
      prize: Number(String(raw.prize || "").replace(/[^\d]/g, "")) || 0,
      register: safeUrl(raw.register), scores: safeUrl(raw.scores), stream: safeUrl(raw.stream), info: safeUrl(raw.info),
      status: /^conf/i.test(String(raw.status || "")) ? "confirmed" : "unconfirmed",
      notes: String(raw.notes || "").trim(),
      scoring: String(raw.scoring || "").trim().toLowerCase().replace(/[^a-z]/g, ""),
      scoringId: String(raw.scoringId || "").trim()
    };
    if (e.scoring === "alfredforpadel") e.scoring = "alfred";
    e.scorer = SCORERS[e.scoring] || null;
    if (!e.scorer) e.scoring = "";
    // No scores link typed in: fall back to the scoring platform's own page for this tournament.
    if (!e.scores && e.scorer) {
      e.scores = e.scoring === "alfred" && /^[a-z0-9-]+$/.test(e.scoringId) ? "https://www.alfredforpadel.com/tournament/" + e.scoringId + "/match" : e.scorer.home;
    }
    e.id = raw.id ? slug(raw.id) : slug(e.name);
    e.s = parse(raw.start);
    e.e = parse(raw.end);
    e.endKnown = e.e != null;
    if (e.s != null && (e.e == null || e.e < e.s)) e.e = e.s;
    e.reg = parse(raw.regDeadline);
    e.t1 = /tier\s*1\b/i.test(e.tier);
    return e;
  }

  // Small CSV reader (handles quotes and commas inside cells).
  function csvRows(text) {
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c !== "\r") cell += c;
    }
    row.push(cell); rows.push(row);
    return rows;
  }
  // Sheet column headers -> fields. The header row can sit anywhere near the top (title rows above it are skipped).
  var HEAD = {
    "id": "id", "name": "name", "full name": "fullName", "organizer": "organizer", "organiser": "organizer", "tier": "tier",
    "level": "level", "city": "city", "venue": "venue", "start date": "start", "end date": "end",
    "registration deadline": "regDeadline", "reg deadline": "regDeadline", "prize (rp)": "prize",
    "register link": "register", "scores link": "scores", "stream link": "stream", "info link": "info",
    "status": "status", "notes": "notes",
    "scoring provider": "scoring", "scoring": "scoring", "scoring id": "scoringId"
  };
  function fromCsv(text) {
    var rows = csvRows(text), h = -1, map = [];
    for (var r = 0; r < Math.min(rows.length, 12) && h < 0; r++) {
      var keys = rows[r].map(function (c) { return HEAD[c.trim().toLowerCase()] || ""; });
      if (keys.indexOf("name") >= 0 && keys.indexOf("start") >= 0) { h = r; map = keys; }
    }
    if (h < 0) throw new Error("No header row with Name and Start date");
    var out = [];
    for (r = h + 1; r < rows.length; r++) {
      var o = {};
      map.forEach(function (k, i) { if (k) o[k] = rows[r][i]; });
      if (String(o.name || "").trim()) out.push(o);
    }
    if (!out.length) throw new Error("Sheet has no events");
    return out;
  }

  // ---------- rendering ----------
  var events = [], today = todayWIB(), view;
  var $ = function (id) { return document.getElementById(id); };

  function state(e) {
    if (e.s == null) return "tbc";
    if (today < e.s) return "upcoming";
    if (today > e.e) return "done";
    return "live";
  }

  function renderNow() {
    var live = events.filter(function (e) { return state(e) === "live"; });
    var next = events.filter(function (e) { return state(e) === "upcoming"; }).sort(function (a, b) { return a.s - b.s; });
    var show = live.concat(live.length ? [] : next.slice(0, 1));
    $("now").innerHTML = show.map(function (e) {
      var isLive = state(e) === "live";
      var where = [e.venue, e.city].filter(Boolean).join(", ");
      var board = isLive && e.scorer;                     // a live scoreboard is drawn further down the page
      var target = board ? "#live" : isLive && e.scores ? e.scores : "#" + e.id;
      var ext = target.charAt(0) !== "#";
      return '<a class="nowcard' + (isLive ? " live" : "") + '" href="' + esc(target) + '"' + (ext ? ' target="_blank" rel="noopener"' : board ? "" : ' data-jump="' + esc(e.id) + '"') + ">" +
        '<span class="pill">' + (isLive ? "Live now" : "Next up · " + inDays(Math.round((e.s - today) / DAY))) + "</span>" +
        "<b>" + esc(e.name) + "</b>" +
        '<span class="meta">' + esc(range(e)) + (where ? " · " + esc(where) : "") + "</span>" +
        '<span class="go">' + (board ? "Live scores ↓" : isLive && e.scores ? "Open live scores →" : "Details →") + "</span></a>";
    }).join("");
  }

  function renderGrid() {
    var y = view.y, m = view.m;
    $("monthTitle").innerHTML = esc(MONTHS[m]) + " <span>" + y + "</span>";
    var first = Date.UTC(y, m, 1);
    var lead = (new Date(first).getUTCDay() + 6) % 7;            // Monday-first
    var gridStart = first - lead * DAY;
    var daysIn = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    var weeks = Math.ceil((lead + daysIn) / 7);
    var html = "";

    for (var w = 0; w < weeks; w++) {
      var ws = gridStart + w * 7 * DAY, we = ws + 6 * DAY, items = [];
      events.forEach(function (e) {
        if (e.s != null && e.s <= we && e.e >= ws) {
          items.push({ a: Math.max(e.s, ws), b: Math.min(e.e, we), e: e, contL: e.s < ws, contR: e.e > we });
        }
        if (e.reg != null && e.reg >= ws && e.reg <= we) items.push({ a: e.reg, b: e.reg, e: e, reg: true });
      });
      items.sort(function (p, q) { return (p.reg ? 1 : 0) - (q.reg ? 1 : 0) || p.a - q.a || (q.b - q.a) - (p.b - p.a); });
      var lanes = [];
      items.forEach(function (it) {
        var l = 0;
        while (lanes[l] != null && lanes[l] >= it.a) l++;
        lanes[l] = it.b; it.lane = l;
      });
      var n = Math.max(lanes.length, 2);
      html += '<div class="week" style="grid-template-rows:30px repeat(' + n + ',auto) minmax(6px,1fr)">';
      for (var d = 0; d < 7; d++) {
        var t = ws + d * DAY, dt = new Date(t);
        var cls = "day c" + (d + 1) + (dt.getUTCMonth() !== m ? " out" : "") + (d > 4 ? " wkend" : "") + (t === today ? " today" : "");
        html += '<div class="' + cls + '" style="grid-column:' + (d + 1) + '"><span class="n">' + dt.getUTCDate() + "</span></div>";
      }
      items.forEach(function (it) {
        var c0 = Math.round((it.a - ws) / DAY) + 1, span = Math.round((it.b - it.a) / DAY) + 1, e = it.e;
        var cls = "bar" + (it.reg ? " reg" : (e.t1 ? " t1" : "") + (e.status !== "confirmed" ? " unc" : "") + (it.contL ? " contL" : "") + (it.contR ? " contR" : ""));
        var label = it.reg ? "Reg closes: " + e.name : e.name;
        html += '<a class="' + cls + '" href="#' + esc(e.id) + '" data-jump="' + esc(e.id) + '" title="' + esc(label + " · " + (it.reg ? fmt(e.reg, true) : range(e))) + '" style="grid-column:' + c0 + " / span " + span + ";grid-row:" + (it.lane + 2) + '">' + esc(label) + "</a>";
      });
      html += "</div>";
    }
    $("grid").innerHTML = html;
  }

  function card(e) {
    var st = state(e), b = "";
    if (st === "live") b += '<span class="badge live">Live now</span>';
    if (e.tier) b += '<span class="badge' + (e.t1 ? " t1" : "") + '">' + esc(e.tier) + "</span>";
    if (e.city) b += '<span class="badge city">' + esc(e.city) + "</span>";
    if (st === "done") b += '<span class="badge done">Finished</span>';
    if (e.status !== "confirmed") b += '<span class="badge unc">Unconfirmed</span>';

    var rows = "<dt>Dates</dt><dd>" + (e.s == null ? '<span class="tbc">To be confirmed</span>' : esc(range(e))) + "</dd>";
    if (e.venue) rows += "<dt>Venue</dt><dd>" + esc(e.venue) + "</dd>";
    if (e.level) rows += "<dt>Level</dt><dd>" + esc(e.level) + "</dd>";
    if (e.organizer) rows += "<dt>Host</dt><dd>" + esc(e.organizer) + "</dd>";
    if (e.prize) rows += "<dt>Prize</dt><dd>Rp " + e.prize.toLocaleString("en-US") + "</dd>";
    if (e.scorer && st !== "done") rows += "<dt>Scoring</dt><dd>" + esc(e.scorer.name) + ' <span class="tbc">(' + (e.scorer.live && e.scoringId ? "live on PadelHQ during play" : "link to their live page") + ")</span></dd>";
    if (st !== "done") {
      var reg;
      if (e.reg == null) reg = '<span class="tbc">Deadline not added yet</span>';
      else if (e.reg < today) reg = "Closed " + esc(fmt(e.reg, true));
      else reg = "Closes " + esc(fmt(e.reg, true)) + ' <span class="cd">(' + inDays(Math.round((e.reg - today) / DAY)) + ")</span>";
      rows += "<dt>Register</dt><dd>" + reg + "</dd>";
    }

    function btn(url, label, pri) {
      return url ? '<a class="btn' + (pri ? " pri" : "") + '" href="' + esc(url) + '" target="_blank" rel="noopener">' + label + "</a>" : '<span class="btn" title="Link not added yet">' + label + "</span>";
    }
    var regOpen = st !== "done" && (e.reg == null || e.reg >= today);
    var btns = (st === "done" ? "" : btn(e.register, "Register", regOpen && st !== "live")) +
      btn(e.scores, st === "done" ? "Results" : "Scores", st === "live") +
      (st === "done" ? "" : btn(e.stream, "Watch")) +
      (e.info ? btn(e.info, "Details") : "");

    return '<article class="card" id="' + esc(e.id) + '"><div class="badges">' + b + "</div>" +
      "<h3>" + esc(e.name) + "</h3>" +
      (e.fullName && e.fullName !== e.name ? '<p class="full">' + esc(e.fullName) + "</p>" : "") +
      "<dl>" + rows + "</dl>" +
      (e.notes ? '<p class="note">' + esc(e.notes) + "</p>" : "") +
      '<div class="btns">' + btns + "</div></article>";
  }

  function renderLists() {
    var ms = Date.UTC(view.y, view.m, 1), me = Date.UTC(view.y, view.m + 1, 0);
    var inMonth = events.filter(function (e) { return e.s != null && e.s <= me && e.e >= ms; }).sort(function (a, b) { return a.s - b.s; });
    $("listTitle").textContent = "Events in " + MONTHS[view.m] + " " + view.y;
    $("list").innerHTML = inMonth.length ? inMonth.map(card).join("") : '<p class="empty">No events added for ' + MONTHS[view.m] + " yet.</p>";
    var tbc = events.filter(function (e) { return e.s == null; });
    $("tbcWrap").hidden = !tbc.length;
    $("tbc").innerHTML = tbc.map(card).join("");
  }

  function render() { renderNow(); renderGrid(); renderLists(); }

  function jump(id) {
    var e = events.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    if (e.s != null) {
      var d = new Date(e.s);
      var ms = Date.UTC(view.y, view.m, 1), me = Date.UTC(view.y, view.m + 1, 0);
      if (!(e.s <= me && e.e >= ms)) { view = { y: d.getUTCFullYear(), m: d.getUTCMonth() }; render(); }
    }
    var el = $(id);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.classList.add("hit");
    setTimeout(function () { el.classList.remove("hit"); }, 2200);
  }

  function shift(n) {
    var d = new Date(Date.UTC(view.y, view.m + n, 1));
    view = { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    render();
  }

  function start(list, source) {
    events = list.map(normalise).filter(function (e) { return e.name; });
    var d = new Date(today);
    view = { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    $("src").textContent = "Data: " + source;
    render();
    // Hand the event list to live.js.
    window.PADELHQ = { events: events, today: today, state: state, range: range };
    document.dispatchEvent(new CustomEvent("padelhq:ready"));
    if (location.hash.length > 1) jump(location.hash.slice(1));
  }

  $("prev").onclick = function () { shift(-1); };
  $("next").onclick = function () { shift(1); };
  $("today").onclick = function () { var d = new Date(today); view = { y: d.getUTCFullYear(), m: d.getUTCMonth() }; render(); };
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("[data-jump]");
    if (a) { ev.preventDefault(); jump(a.getAttribute("data-jump")); }
  });

  var seed = window.PADELHQ_EVENTS || [];
  if (SHEET_CSV_URL) {
    fetch(SHEET_CSV_URL, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { start(fromCsv(t), "Google Sheet"); })
      .catch(function () { start(seed, "built-in list (sheet did not load)"); });
  } else {
    start(seed, "built-in list");
  }
})();
