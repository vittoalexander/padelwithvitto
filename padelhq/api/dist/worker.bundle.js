// ../providers.js
var PROVIDERS = {
  pbpi: {
    name: "PBPI",
    live: true,
    schedule: true,
    idPattern: /^\d{1,6}$/,
    idHelp: "PBPI tournament number, e.g. 46",
    home: "https://www.pbpi.or.id/en/tournaments"
  },
  alfred: {
    name: "Alfred for Padel",
    live: true,
    schedule: false,
    idPattern: /^[a-z0-9][a-z0-9-]{0,80}$/,
    idHelp: "the last part of the Alfred tournament link, e.g. padel-gp500",
    home: "https://www.alfredforpadel.com/",
    browserOk: true
    // Alfred allows other sites to read its data straight from the browser
  },
  skor: {
    name: "SKOR",
    live: false,
    league: true,
    leaguePattern: /^[a-z0-9][a-z0-9-]{0,40}$/,
    idHelp: "the SKOR event id from event.skorapp.id/matches?id=..., e.g. ipl",
    home: "https://event.skorapp.id/"
  },
  demo: { name: "Demo data", live: true, schedule: false, idPattern: /^[a-z0-9-]{1,20}$/, idHelp: "anything", home: "" },
  // Link-only providers: no adapter yet, the page sends people to the provider's own live page.
  incourta: { name: "Incourta", live: false, home: "https://incourta.com/events" },
  recourt: { name: "Recourt", live: false, home: "https://recourt.id/" },
  skorpad: { name: "SkorPad", live: false, home: "https://skorpad.com/" },
  padelscore: { name: "PadelScore.id", live: false, home: "https://padelscore.id/" }
};
var MAX_LIST = 12;
var CLIENT = "Mozilla/5.0 (compatible; padel-score-reader/0.1)";
var IN_BROWSER = typeof window !== "undefined" && typeof document !== "undefined";
var DATE = /^\d{4}-\d{2}-\d{2}$/;
function validate(provider, id) {
  const p = PROVIDERS[provider];
  if (!p || !p.live) return "Unknown or link-only provider";
  if (!p.idPattern.test(String(id || ""))) return "Bad id. Expected " + p.idHelp;
  return "";
}
function validateSchedule(provider, id, date) {
  const bad = validate(provider, id);
  if (bad) return bad;
  if (!PROVIDERS[provider].schedule) return PROVIDERS[provider].name + " has no order of play feed";
  if (date && !DATE.test(date)) return "Bad date. Expected YYYY-MM-DD";
  return "";
}
function validateLeague(provider, id) {
  const p = PROVIDERS[provider];
  if (!p || !p.league) return "Unknown league provider";
  if (!p.leaguePattern.test(String(id || ""))) return "Bad id. Expected " + p.idHelp;
  return "";
}
function sourceUrl(provider, id) {
  if (provider === "alfred") return "https://www.alfredforpadel.com/tournament/" + id + "/match";
  const p = PROVIDERS[provider];
  return p ? p.home : "";
}
function stamp(out, provider, id) {
  out.provider = provider;
  out.providerName = PROVIDERS[provider].name;
  out.sourceUrl = out.sourceUrl || sourceUrl(provider, id);
  out.fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
  return out;
}
async function getLive(provider, id, fetchFn) {
  const err = validate(provider, id);
  if (err) throw new Error(err);
  const f = fetchFn || fetch;
  let out;
  if (provider === "pbpi") out = await pbpiLive(String(id), f);
  else if (provider === "alfred") out = await alfred(String(id), f);
  else out = demo(Date.now());
  return stamp(out, provider, id);
}
async function getSchedule(provider, id, date, fetchFn) {
  const err = validateSchedule(provider, id, date);
  if (err) throw new Error(err);
  return stamp(await pbpiSchedule(String(id), date || "", fetchFn || fetch), provider, id);
}
async function getLeague(provider, id, fetchFn) {
  const err = validateLeague(provider, id);
  if (err) throw new Error(err);
  const out = await skorLeague(String(id), fetchFn || fetch);
  out.provider = provider;
  out.providerName = PROVIDERS[provider].name;
  out.sourceUrl = "https://event.skorapp.id/rankings?id=" + id;
  out.fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
  return out;
}
async function getJson(f, url) {
  const init = IN_BROWSER ? {} : { headers: { "user-agent": CLIENT, accept: "application/json" } };
  const r = await f(url, init);
  if (!r.ok) throw new Error("Provider answered " + r.status);
  return r.json();
}
var tidy = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
function titleCase(s) {
  s = tidy(s);
  if (s && (s === s.toUpperCase() || s === s.toLowerCase())) {
    s = s.toLowerCase().replace(/(^|[\s'’.-])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());
  }
  return s;
}
function words(s) {
  s = tidy(String(s || "").replace(/_/g, " ").replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/([0-9])([A-Za-z])/g, "$1 $2"));
  if (!s) return "";
  s = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return s.replace(/\bu ?(\d+)\b/i, "U$1").replace(/^(Group|Pool) ([a-z])$/, (m, a, b) => a + " " + b.toUpperCase());
}
var num = (v) => typeof v === "number" && isFinite(v) ? v : null;
function team(names, full, sets, tb, points, serving, winner) {
  return { names, full, sets, tb, points: points == null || points === "" ? null : String(points), serving: !!serving, winner: !!winner };
}
function todayJakarta(now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now == null ? Date.now() : now));
}
var PBPI = "https://www.pbpi.or.id/api/";
var PBPI_TYPES = { doubleMen: "Men's doubles", doubleWomen: "Women's doubles", doubleMixed: "Mixed doubles", singleMen: "Men's singles", singleWomen: "Women's singles" };
function pbpiSide(side) {
  const ps = side && side.players || [];
  if (!ps.length) {
    const label = tidy(side && side.alternativeText) || (side && side.bye ? "Bye" : "To be decided");
    return { names: [label], full: [label] };
  }
  const names = [], full = [];
  ps.forEach((p) => {
    const first = tidy(p.firstName), last = titleCase(p.lastName);
    const whole = titleCase(p.name) || tidy([first, last].join(" ")) || "Player";
    names.push(first && last.replace(/\./g, "").length > 1 ? first.charAt(0).toUpperCase() + ". " + last : whole);
    full.push(whole);
  });
  return { names, full };
}
function pbpiMatch(m, status) {
  const liveSets = m.live && Array.isArray(m.live.sets) && m.live.sets.length ? m.live.sets : null;
  const raw = liveSets || m.sets || m.scoreSets || [];
  const sets = raw.map((s) => ({
    h: num(s.home != null ? s.home : s.teamHomeScore),
    a: num(s.away != null ? s.away : s.teamOpponentScore),
    ht: num(s.homeTieBreak != null ? s.homeTieBreak : s.tieBreakTeamHomeScore),
    at: num(s.awayTieBreak != null ? s.awayTieBreak : s.tieBreakTeamOpponentScore)
  })).filter((s) => s.h != null && s.a != null);
  const lv = status === "live" && m.live && (m.live.home != null || m.live.away != null) ? m.live : null;
  let winner = m.winner === "home" || m.winner === "away" ? m.winner : null;
  if (!winner && status === "done" && sets.length) {
    const h = sets.filter((s) => s.h > s.a).length, a = sets.filter((s) => s.a > s.h).length;
    winner = h > a ? "home" : a > h ? "away" : null;
  }
  const type = m.category || m.type;
  const cat = [words(m.level), PBPI_TYPES[type] || words(type)].filter(Boolean).join(" \xB7 ");
  let timeLabel = "";
  if (!m.startTime) timeLabel = m.notBefore ? "Not before" : status === "next" ? "Followed by" : "";
  const home = pbpiSide(m.home), away = pbpiSide(m.away);
  return {
    id: "pbpi-" + m.matchId,
    status,
    court: tidy(m.court),
    round: words(m.round),
    category: cat,
    time: m.startTime || m.notBefore || null,
    timeLabel,
    featured: !!m.featured,
    note: tidy(m.featuredNote),
    teams: [
      team(home.names, home.full, sets.map((s) => s.h), sets.map((s) => s.ht), lv ? lv.home : null, lv && lv.server === "home", winner === "home"),
      team(away.names, away.full, sets.map((s) => s.a), sets.map((s) => s.at), lv ? lv.away : null, lv && lv.server === "away", winner === "away")
    ]
  };
}
async function pbpiLive(id, f) {
  const d = await getJson(f, PBPI + "tournament-live?tournamentId=" + encodeURIComponent(id));
  const list = (a, st) => (Array.isArray(a) ? a : []).slice(0, MAX_LIST).map((m) => pbpiMatch(m, st));
  return { live: list(d.now, "live"), recent: list(d.recent, "done"), next: list(d.next, "next") };
}
function natural(a, b) {
  return String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });
}
async function pbpiSchedule(id, date, f) {
  const opt = await getJson(f, PBPI + "order-of-play-date-options/" + encodeURIComponent(id));
  const options = (opt && opt.data && opt.data.dateOption || []).filter((o) => o && typeof o.value === "string" && DATE.test(o.value.slice(0, 10)));
  options.sort((p, q) => p.value.localeCompare(q.value));
  const days = options.map((o) => ({ date: o.value.slice(0, 10) }));
  if (!days.length) return { days: [], date: null, courts: [] };
  const today = todayJakarta();
  let pick = options.find((o) => o.value.slice(0, 10) === date);
  if (!pick) pick = options.find((o) => o.value.slice(0, 10) === today) || options.find((o) => o.value.slice(0, 10) > today) || options[options.length - 1];
  const d = await getJson(f, PBPI + "order-of-play/" + encodeURIComponent(id) + "/" + encodeURIComponent(pick.value));
  const rows = d && d.data && d.data.orderOfPlay || [];
  const courts = /* @__PURE__ */ new Map();
  rows.forEach((m) => {
    const key = (m.courtId != null ? m.courtId : tidy(m.court)) + "|" + tidy(m.courtVenue);
    if (!courts.has(key)) courts.set(key, { name: tidy(m.court) || "Court", venue: tidy(m.courtVenue || m.venue), matches: [] });
    const status = m.matchStatus === "ongoing" ? "live" : m.matchStatus === "completed" ? "done" : "next";
    const x = pbpiMatch(m, status);
    x.order = num(m.matchOrder) || 0;
    x.court = "";
    if (!m.startTime && !m.notBefore) x.timeLabel = "Followed by";
    courts.get(key).matches.push(x);
  });
  const list = Array.from(courts.values());
  list.forEach((c) => c.matches.sort((p, q) => p.order - q.order));
  list.sort((p, q) => natural(p.venue, q.venue) || natural(p.name, q.name));
  return { days, date: pick.value.slice(0, 10), courts: list };
}
var ALFRED = "https://www.alfredforpadel.com/api/trpc/";
var alfredIds = /* @__PURE__ */ new Map();
async function alfredCall(f, proc, input) {
  const url = ALFRED + proc + "?batch=1&input=" + encodeURIComponent(JSON.stringify({ 0: { json: input } }));
  const j = await getJson(f, url);
  const r = j && j[0] && j[0].result && j[0].result.data;
  if (!r) throw new Error("Unexpected answer from Alfred");
  return r.json;
}
var POINTS = ["0", "15", "30", "40"];
function alfredPoints(m, rules, side) {
  const mine = side === "home" ? m.pointsHome : m.pointsAway;
  const theirs = side === "home" ? m.pointsAway : m.pointsHome;
  if (m.inTiebreak) return String((side === "home" ? m.tbPointsHome : m.tbPointsAway) || 0);
  const a = mine || 0, b = theirs || 0;
  if (a < 3 || b < 3) return POINTS[Math.min(a, 3)];
  if (rules && rules.deuceMode === "no-ad" || m.goldenDeciding) return "40";
  return a > b ? "AD" : "40";
}
function alfredSide(players, teamObj, slot) {
  const ps = (players || []).map((p) => titleCase(p.displayName)).filter(Boolean);
  if (ps.length) return ps;
  if (teamObj && teamObj.isBye) return ["Bye"];
  const n = tidy(teamObj && (teamObj.customName || teamObj.name));
  if (n) return n.split(" / ").map(titleCase);
  return [slot && slot.slotIdentifier ? words(slot.slotIdentifier) : "To be decided"];
}
function alfredMatch(x, status) {
  const m = x.match;
  const done = (x.matchSets || []).slice().sort((p, q) => p.setIndex - q.setIndex);
  const sets = done.map((s) => ({ h: s.gamesHome || 0, a: s.gamesAway || 0, ht: num(s.tbPointsHome), at: num(s.tbPointsAway) }));
  if (status === "live" && done.length === (m.setsHome || 0) + (m.setsAway || 0)) {
    sets.push({ h: m.gamesHome || 0, a: m.gamesAway || 0, ht: null, at: null });
  }
  const live = status === "live";
  const home = alfredSide(x.homePlayers, x.homeTeam, x.homeSlot), away = alfredSide(x.awayPlayers, x.awayTeam, x.awaySlot);
  return {
    id: "alfred-" + m.id,
    status,
    court: tidy(m.court),
    round: tidy(m.customStageName) || x.encounter && tidy(x.encounter.stageDisplayName) || words(m.stage),
    category: tidy(x.category && x.category.name),
    time: null,
    // Alfred does not say which time zone its schedule uses, so no clock time is shown
    timeLabel: "",
    featured: false,
    note: "",
    teams: [
      team(home, home, sets.map((s) => s.h), sets.map((s) => s.ht), live ? alfredPoints(m, x.rules, "home") : null, live && m.servingTeam === "home", m.winnerSide === "home"),
      team(away, away, sets.map((s) => s.a), sets.map((s) => s.at), live ? alfredPoints(m, x.rules, "away") : null, live && m.servingTeam === "away", m.winnerSide === "away")
    ]
  };
}
async function alfred(slug, f) {
  let t = alfredIds.get(slug);
  if (!t || Date.now() - t.at > 6e5) {
    const info = await alfredCall(f, "tournamentPublic.getBySlug", { slug });
    if (!info || !info.id) throw new Error("Alfred has no tournament called " + slug);
    t = { id: info.id, name: info.name, at: Date.now() };
    alfredIds.set(slug, t);
    if (alfredIds.size > 50) alfredIds.delete(alfredIds.keys().next().value);
  }
  const all = await alfredCall(f, "tournament.getMatchesByTournamentId", { tournamentId: t.id, hideUnplayableInterclub: true });
  const ms = (Array.isArray(all) ? all : []).filter((x) => x && x.match && !(x.homeTeam && x.homeTeam.isBye) && !(x.awayTeam && x.awayTeam.isBye));
  const by = (k, dir) => (p, q) => dir * String(p.match[k] || "").localeCompare(String(q.match[k] || ""));
  const live = ms.filter((x) => x.match.status === "in_progress").sort(by("updatedAt", -1));
  const recent = ms.filter((x) => x.match.status === "completed").sort(by("completedAt", -1));
  const next = ms.filter((x) => x.match.status !== "in_progress" && x.match.status !== "completed" && x.match.isPlayable !== false && x.homeTeam && x.awayTeam).sort((p, q) => String(p.match.scheduledAt || "9").localeCompare(String(q.match.scheduledAt || "9")) || (p.match.position || 0) - (q.match.position || 0));
  return {
    title: t.name,
    live: live.slice(0, MAX_LIST).map((x) => alfredMatch(x, "live")),
    recent: recent.slice(0, MAX_LIST).map((x) => alfredMatch(x, "done")),
    next: next.slice(0, MAX_LIST).map((x) => alfredMatch(x, "next"))
  };
}
var SKOR = "https://event.skorapp.id/api/";
function clubName(s) {
  s = tidy(s);
  if (s !== s.toUpperCase()) return s;
  return s.split(" ").map((w) => w.length <= 3 && /^[A-Z]+$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}
var shortGame = (n) => tidy(n).replace(/^[A-Z]{2,5}\s*-\s*/, "");
function skorMatch(m) {
  const fin = m.status === "finished";
  const sets = (m.sets || []).slice().sort((p, q) => p.set_number - q.set_number);
  const side = (k) => {
    const club = clubName(((m["team_" + k + "_participants"] || [])[0] || {}).name || "To be decided");
    const players = (m["team_" + k + "_lineup"] || []).map((p) => titleCase(p.name)).filter(Boolean);
    return { club, players };
  };
  const a = side("a"), b = side("b");
  const winner = fin ? m.team_a_score > m.team_b_score ? "a" : m.team_b_score > m.team_a_score ? "b" : "" : "";
  const mk = (s, k) => team([s.club], s.players.length ? s.players : [s.club], sets.map((x) => num(x["team_" + k] && x["team_" + k].score)), sets.map(() => null), null, false, winner === k);
  return {
    id: "skor-" + m.id,
    // SKOR calls unplayed fixtures "ongoing" too, so a match is only live once it has a score.
    status: fin ? "done" : sets.some((x) => num(x.team_a && x.team_a.score) || num(x.team_b && x.team_b.score)) ? "live" : "next",
    court: "",
    round: "Round " + m.round_number + (m.court_name ? " \xB7 " + tidy(m.court_name) : ""),
    category: shortGame(m.game_name),
    time: null,
    timeLabel: "",
    featured: false,
    note: "",
    teams: [mk(a, "a"), mk(b, "b")]
  };
}
async function skorLeague(slug, f) {
  const ev = await getJson(f, SKOR + "events/" + encodeURIComponent(slug));
  if (!ev || !ev.id) throw new Error("SKOR has no event called " + slug);
  const games = (await getJson(f, SKOR + "games?event_id=" + encodeURIComponent(ev.id))).filter((g) => g && g.is_visible !== false);
  const tables = [];
  for (const g of games) {
    const rows = await getJson(f, SKOR + "games/" + encodeURIComponent(g.id) + "/squad-battle-leaderboard");
    if (!Array.isArray(rows) || !rows.length) continue;
    rows.sort((p, q) => q.battle_points - p.battle_points || q.battle_win - p.battle_win || q.match_score_diff - p.match_score_diff);
    tables.push({ name: shortGame(g.name), rows: rows.map((r) => [clubName(r.squad_name), r.battle_total, r.battle_win, r.battle_lose, r.battle_points]) });
  }
  tables.sort((p, q) => (/women/i.test(p.name) ? 1 : 0) - (/women/i.test(q.name) ? 1 : 0));
  const base = SKOR + "matches?event_id=" + encodeURIComponent(ev.id);
  let raw = [];
  for (let off = 0; off < 1e3; ) {
    const page = await getJson(f, base + "&limit=100&offset=" + off);
    if (!Array.isArray(page) || !page.length) break;
    raw = raw.concat(page);
    off += page.length;
    if (page.length < 100 || page[0].total_count && raw.length >= page[0].total_count) break;
  }
  raw.sort((p, q) => q.round_number - p.round_number || String(p.court_name).localeCompare(String(q.court_name), "en", { numeric: true }));
  const ms = raw.map(skorMatch);
  return {
    title: tidy(ev.name),
    tables,
    live: ms.filter((m) => m.status === "live"),
    recent: ms.filter((m) => m.status === "done").slice(0, 24),
    matchesPlayed: raw.filter((m) => m.status === "finished").length,
    matchesTotal: raw.length
  };
}
function rng(seed) {
  return () => (seed = seed * 1664525 + 1013904223 >>> 0) / 4294967296;
}
function demoMatch(seed, steps, names, court, round, keepGoing) {
  let r = rng(seed), sets = [[0, 0]], pts = [0, 0], serve = 0, won = [0, 0], over = false;
  for (let i = 0; i < steps; i++) {
    if (over) {
      if (!keepGoing) break;
      r = rng(++seed);
      sets = [[0, 0]];
      pts = [0, 0];
      won = [0, 0];
      over = false;
    }
    const w = r() < 0.52 ? 0 : 1;
    pts[w]++;
    if (pts[w] >= 4) {
      pts[0] = pts[1] = 0;
      serve = 1 - serve;
      const s = sets[sets.length - 1];
      s[w]++;
      if (s[w] >= 6 && s[w] - s[1 - w] >= 2 || s[w] === 7) {
        won[w]++;
        if (won[w] === 2) over = true;
        else sets.push([0, 0]);
      }
    }
  }
  const t = (i) => team(names[i], names[i], sets.map((s) => s[i]), sets.map(() => null), over ? null : POINTS[pts[i]], !over && serve === i, over && won[i] === 2);
  return { id: "demo-" + court.replace(/\W/g, "").toLowerCase(), status: over ? "done" : "live", court, round, category: "Demo \xB7 Men's doubles", time: null, timeLabel: "", featured: false, note: "", teams: [t(0), t(1)] };
}
function demo(now) {
  const hour = Math.floor(now / 36e5), step = Math.floor(now % 36e5 / 8e3);
  const a = demoMatch(hour * 1e3 + 1, step, [["A. Santoso", "B. Wijaya"], ["C. Pratama", "D. Hartono"]], "Centre court", "Semifinals", true);
  const b = demoMatch(hour * 1e3 + 500, Math.floor(step * 0.8) + 40, [["E. Garcia", "F. Nugroho"], ["G. Lim", "H. Siregar"]], "Court 2", "Semifinals", true);
  const c = demoMatch(hour * 1e3 + 900, 9999, [["I. Kusuma", "J. Tan"], ["K. Halim", "L. Setiawan"]], "Court 3", "Quarterfinals", false);
  const tbd = (label) => team([label], [label], [], [], null, false, false);
  const n = { id: "demo-next", status: "next", court: "Centre court", round: "Final", category: "Demo \xB7 Men's doubles", time: null, timeLabel: "Followed by", featured: false, note: "", teams: [tbd("Winner SF 1"), tbd("Winner SF 2")] };
  const all = [a, b, c];
  return { demo: true, live: all.filter((m) => m.status === "live"), recent: all.filter((m) => m.status === "done"), next: [n] };
}

// worker.js
var FRESH = { live: 12, schedule: 30, demo: 4, league: 60 };
var STALE_SECONDS = 900;
var DEFAULT_ORIGINS = "https://vittoalexander.github.io,http://localhost:8788,http://127.0.0.1:8788";
var memory = /* @__PURE__ */ new Map();
var inFlight = /* @__PURE__ */ new Map();
function corsHeaders(request, env) {
  const allowed = String(env && env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean);
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
var ageOf = (v) => v && v.fetchedAt ? (Date.now() - Date.parse(v.fetchedAt)) / 1e3 : Infinity;
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
  } catch (e) {
  }
  return best;
}
async function writeCache(key, value, ctx) {
  memory.set(key, value);
  if (memory.size > 300) memory.delete(memory.keys().next().value);
  try {
    if (typeof caches !== "undefined" && caches.default) {
      const res = new Response(JSON.stringify(value), { headers: { "content-type": "application/json", "cache-control": "public, max-age=" + STALE_SECONDS } });
      const put = caches.default.put(key, res);
      if (ctx && ctx.waitUntil) ctx.waitUntil(put.catch(() => {
      }));
      else await put;
    }
  } catch (e) {
  }
}
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
      } finally {
        inFlight.delete(key);
      }
    })());
  }
  try {
    return await inFlight.get(key);
  } catch (err) {
    if (cached && age < STALE_SECONDS) return Object.assign({}, cached, { stale: true, cached: true, error: String(err.message || err) });
    throw err;
  }
}
var worker_default = {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return json({ error: "Only GET is supported" }, 405, cors);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (path === "/" || path === "/v1/health") {
      return json({ ok: true, service: "padelhq-scores", time: (/* @__PURE__ */ new Date()).toISOString() }, 200, cors);
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
      } catch (err) {
        return failed(err);
      }
    }
    if (path === "/v1/schedule") {
      const date = url.searchParams.get("date") || "";
      const bad = validateSchedule(provider, id, date);
      if (bad) return json({ error: bad }, 400, cors);
      try {
        const key = "https://padelhq.cache/v1/schedule/" + provider + "/" + id + "/" + (date || "auto");
        return ok(await remembered(key, FRESH.schedule, ctx, () => getSchedule(provider, id, date)));
      } catch (err) {
        return failed(err);
      }
    }
    if (path === "/v1/league") {
      const bad = validateLeague(provider, id);
      if (bad) return json({ error: bad }, 400, cors);
      try {
        const key = "https://padelhq.cache/v1/league/" + provider + "/" + id;
        return ok(await remembered(key, FRESH.league, ctx, () => getLeague(provider, id)));
      } catch (err) {
        return failed(err);
      }
    }
    return json({ error: "Not found" }, 404, cors);
  }
};
export {
  worker_default as default
};
