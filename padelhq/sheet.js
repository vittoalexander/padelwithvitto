/* PadelHQ "Matches" tab: an order of play typed into the Google Sheet by hand.
   Used when a tournament's scoring platform publishes nothing (for example Sirkuit Nasional Bali 2026,
   whose order of play only went out on Instagram). Also carries YouTube links per court.

   Sheet columns (header row near the top, title rows above it are skipped):
     Event     the event's Name exactly as on the Events tab, e.g. Sirkuit Nasional Bali
     Date      19 Nov 2026, 2026-11-19 or 19/11/2026
     Time      10:00, "Not before 14:00", or blank (= follows the match above it)
     Court     e.g. Court 1
     Category  e.g. Men's Open
     Round     e.g. Round of 16
     Team 1    players split by "/" or "&", e.g. Andi S. / Budi H.
     Team 2
     Score     Team 1 games first, sets split by spaces or commas, e.g. 6-4 3-6 10-8
     Status    Live, Finished, or blank (= not started; a row with a score counts as finished)
     YouTube   the stream link for this match
   A row with a Court and a YouTube link but no teams is a court stream: it is added to every match on
   that court on that day (or on every day if Date is blank), including matches that come from PBPI.

   Runs in the browser (live.js) and in Node (api/test.mjs). */

const tidy = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, mei: 4, jun: 5, jul: 6, aug: 7, agu: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, des: 11 };
const slug = (s) => tidy(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => (m < 0 || m > 11 || d < 1 || d > 31 ? "" : y + "-" + pad(m + 1) + "-" + pad(d));

/** "2026-11-19", "19 Nov 2026", "Sat 21 Nov 2026", "19/11/2026" -> "2026-11-19" (or "" if unreadable). */
export function toYmd(s) {
  s = tidy(s);
  let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return ymd(+m[1], +m[2] - 1, +m[3]);
  if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s))) return ymd(+m[3], +m[2] - 1, +m[1]);
  if ((m = /^(?:[A-Za-z]+,?\s+)?(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s+(\d{4})$/.exec(s))) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    return mo == null ? "" : ymd(+m[3], mo, +m[1]);
  }
  return "";
}

/** Small CSV reader (quotes, commas and line breaks inside cells). */
export function csvRows(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  text = String(text || "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
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

const HEAD = {
  "event": "event", "event id": "event", "date": "date", "time": "time", "court": "court", "category": "category",
  "round": "round", "team 1": "t1", "team 2": "t2", "score": "score", "status": "status",
  "youtube": "stream", "youtube link": "stream", "stream": "stream", "stream link": "stream"
};

function safeUrl(u) {
  u = tidy(u);
  return /^https:\/\/[^\s"'<>]+$/.test(u) ? u : "";
}
function names(s) {
  return tidy(s).split(/\s*(?:\/|&|\+)\s*/).map(tidy).filter(Boolean);
}
/** "6-4 3-6 10-8" or "6-4, 7-6(5)" -> [[6,4],[3,6],[10,8]] (tie-break points are dropped). */
export function parseScore(s) {
  const out = [];
  tidy(s).replace(/\(\d+\)/g, "").split(/[\s,;]+/).forEach((p) => {
    const m = /^(\d{1,2})\s*[-–:]\s*(\d{1,2})$/.exec(p);
    if (m) out.push([+m[1], +m[2]]);
  });
  return out;
}
/** "10:00", "10.00", "Not before 14:00", "NB 14:00" -> { hm: "10:00", notBefore } */
function parseTime(s) {
  s = tidy(s);
  const m = /(\d{1,2})[:.](\d{2})/.exec(s);
  return { hm: m && +m[1] < 24 && +m[2] < 60 ? pad(+m[1]) + ":" + m[2] : "", notBefore: /not before|^nb\b|belum/i.test(s) };
}
function statusOf(s, sets) {
  s = tidy(s).toLowerCase();
  if (/^(live|on court|playing|main|berlangsung)/.test(s)) return "live";
  if (/^(finished|done|final|selesai|ended|complete|w\/?o|walkover|retired|ret)/.test(s)) return "done";
  if (/^(next|upcoming|scheduled|not started|belum)/.test(s)) return "next";
  return sets.length ? "done" : "next";
}

/** Read the Matches tab CSV. Returns { "<event id>": { days: ["2026-11-21", ...], matches: [...], streams: [...] } } */
export function parseMatches(text) {
  const rows = csvRows(text);
  let h = -1, map = [];
  for (let r = 0; r < Math.min(rows.length, 12) && h < 0; r++) {
    const keys = rows[r].map((c) => HEAD[tidy(c).toLowerCase()] || "");
    if (keys.includes("event") && keys.includes("court")) { h = r; map = keys; }
  }
  if (h < 0) throw new Error("No header row with Event and Court");

  const out = {};
  const get = (id) => out[id] || (out[id] = { days: [], matches: [], streams: [] });
  for (let r = h + 1; r < rows.length; r++) {
    const o = {};
    map.forEach((k, i) => { if (k) o[k] = tidy(rows[r][i]); });
    const event = slug(o.event);                   // the page names events by their Name, made URL-safe (see app.js)
    if (!event) continue;
    const date = toYmd(o.date), court = o.court || "", stream = safeUrl(o.stream);
    const t1 = names(o.t1), t2 = names(o.t2);
    const ev = get(event);

    if (!t1.length && !t2.length) {               // a court stream row
      if (court && stream) ev.streams.push({ date, court, url: stream });
      continue;
    }
    if (!date) continue;
    const sets = parseScore(o.score);
    const status = statusOf(o.status, sets);
    let winner = null;
    if (status === "done" && sets.length) {
      const a = sets.filter((s) => s[0] > s[1]).length, b = sets.filter((s) => s[1] > s[0]).length;
      winner = a > b ? 0 : b > a ? 1 : null;
    }
    const t = parseTime(o.time);
    const team = (list, i) => ({
      names: list.length ? list : ["To be decided"], full: list.length ? list : ["To be decided"],
      sets: sets.map((s) => s[i]), tb: [], points: null, serving: false, winner: winner === i
    });
    ev.matches.push({
      id: "sheet-" + event + "-" + r, status, date, order: r, court: court || "Court", round: o.round || "", category: o.category || "",
      time: t.hm ? date + "T" + t.hm + ":00+07:00" : null, timeLabel: t.hm ? (t.notBefore ? "Not before" : "") : "Followed by",
      featured: false, note: "", stream, teams: [team(t1, 0), team(t2, 1)]
    });
    if (!ev.days.includes(date)) ev.days.push(date);
  }
  Object.values(out).forEach((ev) => ev.days.sort());
  return out;
}

const natural = (a, b) => String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });

/** The YouTube link for a court on a day, from the court stream rows. */
export function courtStream(ev, court, date) {
  if (!ev || !court) return "";
  const c = tidy(court).toLowerCase();
  const hit = ev.streams.find((s) => s.court.toLowerCase() === c && s.date === date) || ev.streams.find((s) => s.court.toLowerCase() === c && !s.date);
  return hit ? hit.url : "";
}
function withStream(ev, m, date) {
  return m.stream ? m : Object.assign({}, m, { stream: courtStream(ev, m.court, date) });
}

/** Order of play for one day in the same shape as the score API's /v1/schedule. */
export function sheetSchedule(ev, date, today) {
  const days = ev.days.map((d) => ({ date: d }));
  if (!days.length) return { days: [], date: null, courts: [], manual: true, fetchedAt: new Date().toISOString() };
  const pick = ev.days.includes(date) ? date : ev.days.includes(today) ? today : ev.days.find((d) => d > today) || ev.days[ev.days.length - 1];
  const courts = new Map();
  ev.matches.filter((m) => m.date === pick).forEach((m) => {
    if (!courts.has(m.court)) courts.set(m.court, { name: m.court, venue: "", stream: courtStream(ev, m.court, pick), matches: [] });
    const x = withStream(ev, m, pick);
    courts.get(m.court).matches.push(Object.assign({}, x, { court: "" }));
  });
  const list = Array.from(courts.values()).sort((p, q) => natural(p.name, q.name));
  list.forEach((c) => c.matches.sort((p, q) => p.order - q.order));
  return { days, date: pick, courts: list, manual: true, fetchedAt: new Date().toISOString() };
}

/** On court now, just finished and up next for today, in the same shape as /v1/live. */
export function sheetLive(ev, today, max) {
  max = max || 12;
  const ms = ev.matches.filter((m) => m.date === today).map((m) => withStream(ev, m, today));
  const byTime = (p, q) => (p.time || "").localeCompare(q.time || "") || p.order - q.order;
  const done = ms.filter((m) => m.status === "done");
  return {
    live: ms.filter((m) => m.status === "live").sort(byTime).slice(0, max),
    recent: done.slice(-max).reverse(),
    next: ms.filter((m) => m.status === "next").sort((p, q) => p.order - q.order).slice(0, max),
    manual: true, fetchedAt: new Date().toISOString()
  };
}

/** Add the sheet's court streams to matches that came from a scoring platform. */
export function addStreams(ev, list, date) {
  if (!ev || !ev.streams.length) return list;
  return list.map((m) => withStream(ev, m, date));
}
