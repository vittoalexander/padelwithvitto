/* PadelHQ calendar. Plain JavaScript, no build step.
   Data: the list in events.js, or a Google Sheet when sheetCsvUrl is set in config.js.
   Live scores are drawn by live.js, which reads the event list this file publishes on window.PADELHQ.

   Testing helper: add ?today=2026-11-19 to the page address to see the page as it will look on that day. */
(function () {
  "use strict";

  var CONFIG = window.PADELHQ_CONFIG || {};
  var SHEET_CSV_URL = CONFIG.sheetCsvUrl || "";
  var SHEET_WAIT_MS = 6000;          // if the sheet has not answered by then, use the last copy we have
  var SHEET_MEMORY = "padelhq.sheet.v1";

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
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DAY = 86400000;
  // Month words people actually type, English and Indonesian.
  var MONTH_WORDS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, mei: 4, jun: 5, jul: 6, aug: 7, agu: 7, agt: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, des: 11 };

  // ---------- dates (plain calendar days, counted in Indonesia time) ----------
  function ymd(y, m, d) {
    // Reject impossible dates such as 31 Feb instead of silently rolling them over.
    var t = Date.UTC(y, m, d), x = new Date(t);
    return x.getUTCFullYear() === y && x.getUTCMonth() === m && x.getUTCDate() === d ? t : null;
  }
  /** Reads 2026-11-19, 19 Nov 2026, 19 November 2026, 19/11/2026 and 19-11-2026. Day comes first in the slash form. */
  function parse(s) {
    s = String(s == null ? "" : s).trim();
    var m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return ymd(+m[1], +m[2] - 1, +m[3]);
    if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s))) return ymd(+m[3], +m[2] - 1, +m[1]);
    if ((m = /^(?:[A-Za-z]+,?\s+)?(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s+(\d{4})$/.exec(s))) {
      var mo = MONTH_WORDS[m[2].slice(0, 3).toLowerCase()];
      return mo == null ? null : ymd(+m[3], mo, +m[1]);
    }
    return null;
  }
  function todayWIB() {
    var p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return parse(p);
  }
  function fmt(t, withYear) {
    var d = new Date(t);
    return d.getUTCDate() + " " + MON[d.getUTCMonth()] + (withYear ? " " + d.getUTCFullYear() : "");
  }
  function fmtDow(t, withYear) { return DOW[new Date(t).getUTCDay()] + " " + fmt(t, withYear); }
  function range(e) {
    if (e.s == null) return "Dates to be confirmed";
    if (e.endKnown === false) return "From " + fmt(e.s, true) + " (end date to be confirmed)";
    if (e.s === e.e) return fmt(e.s, true);
    var a = new Date(e.s), b = new Date(e.e);
    if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) return a.getUTCDate() + "–" + fmt(e.e, true);
    return fmt(e.s, a.getUTCFullYear() !== b.getUTCFullYear()) + " – " + fmt(e.e, true);
  }
  /** Like range(), with weekdays: "Thu 19 – Sun 22 Nov 2026". */
  function rangeDow(e) {
    if (e.s == null) return "Dates to be confirmed";
    if (e.endKnown === false) return "From " + fmtDow(e.s, true) + " (end date to be confirmed)";
    if (e.s === e.e) return fmtDow(e.s, true);
    var a = new Date(e.s), b = new Date(e.e);
    var sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
    return (sameMonth ? DOW[a.getUTCDay()] + " " + a.getUTCDate() : fmtDow(e.s, a.getUTCFullYear() !== b.getUTCFullYear())) + " – " + fmtDow(e.e, true);
  }
  function inDays(n) { return n === 0 ? "today" : n === 1 ? "tomorrow" : "in " + n + " days"; }
  function compact(t) { var d = new Date(t); return "" + d.getUTCFullYear() + ("0" + (d.getUTCMonth() + 1)).slice(-2) + ("0" + d.getUTCDate()).slice(-2); }

  // ---------- data ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function safeUrl(u) { u = String(u || "").trim(); return /^https?:\/\/[^\s<>"']+$/i.test(u) ? u : ""; }
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
      prize: Number(String(raw.prize || "").replace(/[.,]\d{1,2}$/, "").replace(/[^\d]/g, "")) || 0,
      register: safeUrl(raw.register), scores: safeUrl(raw.scores), stream: safeUrl(raw.stream), info: safeUrl(raw.info),
      status: /^conf/i.test(String(raw.status || "").trim()) ? "confirmed" : "unconfirmed",
      notes: String(raw.notes || "").trim(),
      scoring: String(raw.scoring || "").trim().toLowerCase().replace(/[^a-z]/g, ""),
      scoringId: String(raw.scoringId || "").trim()
    };
    if (e.scoring === "alfredforpadel") e.scoring = "alfred";
    if (e.scoring === "padelscoreid") e.scoring = "padelscore";
    e.scorer = SCORERS[e.scoring] || null;
    if (!e.scorer) e.scoring = "";
    // No scores link typed in: fall back to the scoring platform's own page for this tournament.
    if (!e.scores && e.scorer) {
      e.scores = e.scoring === "alfred" && /^[a-z0-9-]+$/.test(e.scoringId) ? "https://www.alfredforpadel.com/tournament/" + e.scoringId + "/match" : e.scorer.home;
    }
    e.id = slug(raw.id || e.name) || "event";
    e.s = parse(raw.start);
    e.e = parse(raw.end);
    e.endKnown = e.e != null;
    if (e.s != null && (e.e == null || e.e < e.s)) e.e = e.s;
    e.reg = parse(raw.regDeadline);
    e.t1 = /tier\s*1\b/i.test(e.tier);
    return e;
  }
  /** Two rows with the same name would otherwise share one id and break the jump links. */
  function uniqueIds(list) {
    var seen = {};
    list.forEach(function (e) {
      var base = e.id, n = 1;
      while (seen[e.id]) e.id = base + "-" + (++n);
      seen[e.id] = true;
    });
    return list;
  }

  // Small CSV reader (handles quotes, commas and line breaks inside cells).
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
    "registration deadline": "regDeadline", "reg deadline": "regDeadline", "prize (rp)": "prize", "prize": "prize",
    "register link": "register", "scores link": "scores", "stream link": "stream", "info link": "info",
    "status": "status", "notes": "notes",
    "scoring provider": "scoring", "scoring": "scoring", "scoring id": "scoringId"
  };
  function fromCsv(text) {
    var rows = csvRows(text), h = -1, map = [];
    for (var r = 0; r < Math.min(rows.length, 12) && h < 0; r++) {
      var keys = rows[r].map(function (c) { return HEAD[c.replace(/\s+/g, " ").trim().toLowerCase()] || ""; });
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
  var params = new URLSearchParams(location.search);
  var forcedToday = parse(params.get("today"));
  var events = [], today = forcedToday != null ? forcedToday : todayWIB(), view;
  var $ = function (id) { return document.getElementById(id); };

  function state(e) {
    if (e.s == null) return "tbc";
    if (today < e.s) return "upcoming";
    if (today > e.e) return "done";
    return "live";
  }

  function renderNow() {
    var live = events.filter(function (e) { return state(e) === "live"; }).sort(function (a, b) { return (b.t1 ? 1 : 0) - (a.t1 ? 1 : 0) || a.s - b.s; });
    var next = events.filter(function (e) { return state(e) === "upcoming"; }).sort(function (a, b) { return a.s - b.s; });
    var show = live.concat(live.length ? [] : next.slice(0, 1));
    $("now").hidden = !show.length;
    $("now").innerHTML = show.map(function (e) {
      var isLive = state(e) === "live";
      var where = [e.venue, e.city].filter(Boolean).join(", ");
      var target = isLive && e.scores ? e.scores : "#" + e.id;
      var ext = target.charAt(0) !== "#";
      return '<a class="nowcard' + (isLive ? " live" : "") + '" data-event="' + esc(e.id) + '" href="' + esc(target) + '"' + (ext ? ' target="_blank" rel="noopener"' : ' data-jump="' + esc(e.id) + '"') + ">" +
        '<span class="pill">' + (isLive ? "On now" : "Next up · " + inDays(Math.round((e.s - today) / DAY))) + "</span>" +
        "<b>" + esc(e.name) + "</b>" +
        '<span class="meta">' + esc(rangeDow(e)) + (where ? " · " + esc(where) : "") + "</span>" +
        '<span class="go">' + (isLive && e.scores ? "Open live scores ↗" : "Details ↓") + "</span></a>";
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
        // Deadline markers only for deadlines you can still act on.
        if (e.reg != null && e.reg >= ws && e.reg <= we && e.reg >= today && state(e) === "upcoming") items.push({ a: e.reg, b: e.reg, e: e, reg: true });
      });
      // Events first (Tier 1 on top, then by start, longest first), deadline markers after.
      items.sort(function (p, q) {
        return (p.reg ? 1 : 0) - (q.reg ? 1 : 0) || (q.e.t1 ? 1 : 0) - (p.e.t1 ? 1 : 0) || p.a - q.a || (q.b - q.a) - (p.b - p.a) || p.e.name.localeCompare(q.e.name);
      });
      // Put each item on the first row ("lane") where its days are still free.
      var lanes = [];
      items.forEach(function (it) {
        var l = 0;
        while (lanes[l] && lanes[l].some(function (o) { return o.a <= it.b && o.b >= it.a; })) l++;
        (lanes[l] = lanes[l] || []).push(it);
        it.lane = l;
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
        var full = it.reg ? "Registration closes: " + e.name + " · " + fmtDow(e.reg, true) : e.name + " · " + rangeDow(e);
        var label = it.reg ? '<span class="lg">Reg closes: ' + esc(e.name) + '</span><span class="sm">Reg</span>' : esc(e.name);
        html += '<a class="' + cls + '" href="#' + esc(e.id) + '" data-jump="' + esc(e.id) + '" title="' + esc(full) + '" aria-label="' + esc(full) + '" style="grid-column:' + c0 + " / span " + span + ";grid-row:" + (it.lane + 2) + '">' + label + "</a>";
      });
      html += "</div>";
    }
    $("grid").innerHTML = html;
  }

  function calendarLink(e) {
    var where = [e.venue, e.city].filter(Boolean).join(", ");
    var page = location.origin + location.pathname + "#" + e.id;
    var details = (e.fullName && e.fullName !== e.name ? e.fullName + "\n" : "") + "Scores, schedule and links: " + page;
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(e.name) +
      "&dates=" + compact(e.s) + "/" + compact(e.e + DAY) +              // all-day events end on the day after the last day
      (where ? "&location=" + encodeURIComponent(where) : "") + "&details=" + encodeURIComponent(details);
  }

  function card(e) {
    var st = state(e), b = "";
    if (st === "live") b += '<span class="badge live">On now</span>';
    if (e.tier) b += '<span class="badge' + (e.t1 ? " t1" : "") + '">' + esc(e.tier) + "</span>";
    if (e.city) b += '<span class="badge city">' + esc(e.city) + "</span>";
    if (st === "done") b += '<span class="badge done">Finished</span>';
    if (e.status !== "confirmed") b += '<span class="badge unc" title="Found online, not yet checked with the organiser">Unconfirmed</span>';

    var when;
    if (e.s == null) when = '<span class="tbc">To be confirmed</span>';
    else {
      when = esc(rangeDow(e));
      if (st === "upcoming") when += ' <span class="tbc">(' + inDays(Math.round((e.s - today) / DAY)) + ")</span>";
      else if (st === "live" && e.e > e.s && e.endKnown) when += ' <span class="tbc">(day ' + (Math.round((today - e.s) / DAY) + 1) + " of " + (Math.round((e.e - e.s) / DAY) + 1) + ")</span>";
    }
    var rows = "<dt>When</dt><dd>" + when + "</dd>";
    if (e.venue) rows += "<dt>Where</dt><dd>" + esc(e.venue) + "</dd>";
    if (e.level) rows += "<dt>Level</dt><dd>" + esc(e.level) + "</dd>";
    if (e.organizer) rows += "<dt>Host</dt><dd>" + esc(e.organizer) + "</dd>";
    if (e.prize) rows += "<dt>Prize</dt><dd>Rp " + e.prize.toLocaleString("en-US") + "</dd>";

    var regOpen = st === "upcoming" && (e.reg == null || e.reg >= today);
    if (st === "upcoming") {
      if (e.reg != null && e.reg < today) rows += '<dt>Entry</dt><dd>Closed ' + esc(fmt(e.reg)) + "</dd>";
      else if (e.reg != null) {
        var left = Math.round((e.reg - today) / DAY);
        rows += "<dt>Entry</dt><dd>Closes " + esc(fmtDow(e.reg)) + ' <span class="cd' + (left <= 3 ? " soon" : "") + '">(' + inDays(left) + ")</span></dd>";
      } else if (e.register) rows += '<dt>Entry</dt><dd><span class="tbc">Deadline not listed</span></dd>';
    }
    if (e.scorer && st !== "done" && st !== "tbc") {
      rows += "<dt>Scores</dt><dd>" + esc(e.scorer.name) + ' <span class="tbc">· ' + (e.scorer.live && e.scoringId ? "live on PadelHQ" : "on their site") + "</span></dd>";
    }

    function btn(url, label, pri, extra) {
      return url ? '<a class="btn' + (pri ? " pri" : "") + '" href="' + esc(url) + '" target="_blank" rel="noopener"' + (extra || "") + ">" + label + " ↗</a>" : "";
    }
    var infoLabel = /instagram\.com/i.test(e.info) ? "Instagram post" : "Event page";
    var btns = "";
    if (st === "live") {
      // live.js turns this into a jump to the scoreboard on this page when it has one for the event.
      btns += btn(e.scores, "Live scores", true, ' data-board="' + esc(e.id) + '"') + btn(e.stream, "Watch");
    } else if (st === "done") {
      btns += btn(e.scores, "Results", false);
    } else {
      if (regOpen) btns += btn(e.register, "Register", true);
      btns += btn(e.scores, "Draws and scores", false) + btn(e.stream, "Watch");
    }
    if (e.info && e.info !== e.scores && e.info !== e.register) btns += btn(e.info, infoLabel);
    if (e.s != null && (st === "upcoming" || st === "live")) {
      btns += '<a class="btn ghost" href="' + esc(calendarLink(e)) + '" target="_blank" rel="noopener">Add to Google Calendar</a>';
    }

    return '<article class="card" id="' + esc(e.id) + '"><div class="badges">' + b + "</div>" +
      "<h3>" + esc(e.name) + "</h3>" +
      (e.fullName && e.fullName !== e.name ? '<p class="full">' + esc(e.fullName) + "</p>" : "") +
      "<dl>" + rows + "</dl>" +
      (e.notes ? '<p class="note">' + esc(e.notes) + "</p>" : "") +
      (btns ? '<div class="btns">' + btns + "</div>" : "") + "</article>";
  }

  function renderLists() {
    var ms = Date.UTC(view.y, view.m, 1), me = Date.UTC(view.y, view.m + 1, 0);
    var inMonth = events.filter(function (e) { return e.s != null && e.s <= me && e.e >= ms; }).sort(function (a, b) { return a.s - b.s || (b.t1 ? 1 : 0) - (a.t1 ? 1 : 0); });
    $("listTitle").textContent = "Events in " + MONTHS[view.m] + " " + view.y;
    $("list").innerHTML = inMonth.length ? inMonth.map(card).join("") : '<p class="empty">No events listed for ' + MONTHS[view.m] + " " + view.y + " yet.</p>";
    var tbc = events.filter(function (e) { return e.s == null; });
    $("tbcWrap").hidden = !tbc.length;
    $("tbc").innerHTML = tbc.map(card).join("");
  }

  // ---------- Indonesian Padel League: standings and the next match days ----------
  function iplTable(title, rows) {
    return '<div class="tbl"><h3>' + title + '</h3><table><thead><tr><th>#</th><th class="club">Club</th><th title="Matches">M</th><th title="Wins">W</th><th title="Losses">L</th><th title="Points">Pts</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        return "<tr><td>" + (i + 1) + '</td><td class="club">' + esc(r[0]) + "</td><td>" + esc(r[1]) + "</td><td>" + esc(r[2]) + "</td><td>" + esc(r[3]) + '</td><td class="tp">' + esc(r[4]) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }
  function renderIpl() {
    var d = window.PADELHQ_IPL, wrap = $("iplWrap");
    if (!wrap) return;
    var days = events.filter(function (e) { return /^IPL\b/i.test(e.name) && e.s != null && state(e) !== "done"; }).sort(function (a, b) { return a.s - b.s; }).slice(0, 4);
    var ok = d && d.men && d.women;
    wrap.hidden = !ok && !days.length;
    if (wrap.hidden) return;
    var html = "";
    if (ok) {
      html += '<div class="ipl">' + iplTable("Men", d.men) + iplTable("Women", d.women) + "</div>" +
        '<p class="note">Standings as posted by the league on ' + esc(d.updated) + ". Men: a win is 3 points and a 1–2 loss is 1 point. Women: a win is 3 points. " +
        (safeUrl(d.source) ? '<a href="' + esc(d.source) + '" target="_blank" rel="noopener">League on Instagram ↗</a>' : "") + "</p>";
    }
    if (days.length) {
      html += '<h3 class="sub">Next match days</h3><ul class="fix">' + days.map(function (e) {
        var where = [e.venue, e.city].filter(Boolean).join(", ");
        return '<li><a href="#' + esc(e.id) + '" data-jump="' + esc(e.id) + '"><b>' + esc(rangeDow(e)) + (state(e) === "live" ? ' <span class="badge live">On now</span>' : "") + "</b>" +
          "<span>" + esc(e.name.replace(/^IPL\s*/i, "")) + (where ? " · " + esc(where) : "") + "</span>" +
          (e.fullName ? '<span class="vis">' + esc(e.fullName) + "</span>" : "") + "</a></li>";
      }).join("") + "</ul>";
    }
    $("ipl").innerHTML = html;
  }

  function render() {
    renderNow(); renderGrid(); renderLists(); renderIpl();
    document.dispatchEvent(new CustomEvent("padelhq:rendered"));   // live.js re-applies its links to the fresh cards
  }

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

  var started = false;
  function start(list, source) {
    if (started) return;
    started = true;
    events = uniqueIds(list.map(normalise).filter(function (e) { return e.name; }));
    var d = new Date(today);
    view = { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    $("src").textContent = "Tournament list: " + source;
    document.body.classList.remove("loading");
    // Hand the event list to live.js.
    window.PADELHQ = { events: events, today: today, DAY: DAY, state: state, range: range, rangeDow: rangeDow, fmtDow: fmtDow, jump: jump };
    render();
    document.dispatchEvent(new CustomEvent("padelhq:ready"));
    if (location.hash.length > 1) jump(decodeURIComponent(location.hash.slice(1)));
  }

  $("prev").onclick = function () { shift(-1); };
  $("next").onclick = function () { shift(1); };
  $("today").onclick = function () { var d = new Date(today); view = { y: d.getUTCFullYear(), m: d.getUTCMonth() }; render(); };
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("[data-jump]");
    if (a) { ev.preventDefault(); jump(a.getAttribute("data-jump")); }
  });
  // A page left open overnight would keep yesterday's "today". Reload once the date changes.
  setInterval(function () { if (forcedToday == null && started && todayWIB() !== today && !document.hidden) location.reload(); }, 60000);

  // ---------- where the tournament list comes from ----------
  var seed = window.PADELHQ_EVENTS || [];
  function remembered() { try { return localStorage.getItem(SHEET_MEMORY) || ""; } catch (e) { return ""; } }
  function fallback(why) {
    var old = remembered();
    if (old) { try { return start(fromCsv(old), "Google Sheet (saved copy, " + why + ")"); } catch (e) { /* fall through */ } }
    start(seed, "built-in list (" + why + ")");
  }
  if (SHEET_CSV_URL && !params.get("builtin")) {
    document.body.classList.add("loading");
    var gaveUp = setTimeout(function () { fallback("sheet is slow to answer"); }, SHEET_WAIT_MS);
    fetch(SHEET_CSV_URL, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) {
        var list = fromCsv(t);                       // throws if the sheet is unreadable, so a broken sheet never replaces a good copy
        clearTimeout(gaveUp);
        try { localStorage.setItem(SHEET_MEMORY, t); } catch (e) { /* private mode: fine */ }
        start(list, "Google Sheet");
      })
      .catch(function () { clearTimeout(gaveUp); fallback("sheet did not load"); });
  } else {
    start(seed, "built-in list");
  }
})();
