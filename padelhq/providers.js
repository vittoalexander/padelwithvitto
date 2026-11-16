/* PadelHQ score providers.
   One small "adapter" per scoring platform. Each adapter reads that platform's public match data
   and returns it in one common shape, so the page never needs to know which platform a tournament uses.

   This file runs in three places: the Cloudflare Worker (api/worker.js), Node (tests), and the browser.

   Common shape returned by getLive():
   {
     provider, providerName, sourceUrl, fetchedAt,
     live:   [match],   // on court now
     recent: [match],   // just finished, newest first
     next:   [match]    // coming up
   }
   match = { id, status: "live"|"done"|"next", court, round, category, time, timeLabel,
             teams: [ { names:[...], sets:[...], tb:[...], points, serving, winner }, { ... } ] }
*/

export const PROVIDERS = {
  pbpi: {
    name: "PBPI",
    live: true,
    idPattern: /^\d{1,6}$/,
    idHelp: "PBPI tournament number, e.g. 46",
    home: "https://www.pbpi.or.id/en/tournaments"
  },
  alfred: {
    name: "Alfred for Padel",
    live: true,
    idPattern: /^[a-z0-9][a-z0-9-]{0,80}$/,
    idHelp: "the last part of the Alfred tournament link, e.g. padel-gp500",
    home: "https://www.alfredforpadel.com/",
    browserOk: true // Alfred allows other sites to read its data straight from the browser
  },
  demo: { name: "Demo data", live: true, idPattern: /^[a-z0-9-]{1,20}$/, idHelp: "anything", home: "" },
  // Link-only providers: no adapter yet, the page sends people to the provider's own live page.
  incourta: { name: "Incourta", live: false, home: "https://incourta.com/events" },
  recourt: { name: "Recourt", live: false, home: "https://recourt.id/" },
  skorpad: { name: "SkorPad", live: false, home: "https://skorpad.com/" },
  padelscore: { name: "PadelScore.id", live: false, home: "https://padelscore.id/" }
};

const MAX_LIST = 12;
// A plain, honest client label. Set a contact address here if a provider asks for one.
const CLIENT = "Mozilla/5.0 (compatible; padel-score-reader/0.1)";
const IN_BROWSER = typeof window !== "undefined" && typeof document !== "undefined";

export function validate(provider, id) {
  const p = PROVIDERS[provider];
  if (!p || !p.live) return "Unknown or link-only provider";
  if (!p.idPattern.test(String(id || ""))) return "Bad id. Expected " + p.idHelp;
  return "";
}

export function sourceUrl(provider, id) {
  if (provider === "alfred") return "https://www.alfredforpadel.com/tournament/" + id + "/match";
  const p = PROVIDERS[provider];
  return p ? p.home : "";
}

/** Fetch and normalise live scores. fetchFn defaults to the global fetch. */
export async function getLive(provider, id, fetchFn) {
  const err = validate(provider, id);
  if (err) throw new Error(err);
  const f = fetchFn || fetch;
  let out;
  if (provider === "pbpi") out = await pbpi(String(id), f);
  else if (provider === "alfred") out = await alfred(String(id), f);
  else out = demo(Date.now());
  out.provider = provider;
  out.providerName = PROVIDERS[provider].name;
  out.sourceUrl = out.sourceUrl || sourceUrl(provider, id);
  out.fetchedAt = new Date().toISOString();
  return out;
}

async function getJson(f, url) {
  const init = IN_BROWSER ? {} : { headers: { "user-agent": CLIENT, accept: "application/json" } };
  const r = await f(url, init);
  if (!r.ok) throw new Error("Provider answered " + r.status);
  return r.json();
}

// ---------- shared helpers ----------
const tidy = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
function titleCase(s) {
  s = tidy(s);
  // Only repair names typed in ALL CAPS or all lower case; leave mixed case (e.g. "McDonald") alone.
  if (s && (s === s.toUpperCase() || s === s.toLowerCase())) {
    s = s.toLowerCase().replace(/(^|[\s'’.-])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());
  }
  return s;
}
function words(s) {
  // "roundOf64" -> "Round of 64", "group_a" -> "Group A", "semifinals" -> "Semifinals"
  s = tidy(String(s || "").replace(/_/g, " ").replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/([0-9])([A-Za-z])/g, "$1 $2"));
  if (!s) return "";
  s = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return s.replace(/\bu ?(\d+)\b/i, "U$1").replace(/^(Group|Pool) ([a-z])$/, (m, a, b) => a + " " + b.toUpperCase());
}
const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
function team(names, sets, tb, points, serving, winner) {
  return { names, sets, tb, points: points == null || points === "" ? null : String(points), serving: !!serving, winner: !!winner };
}

// ---------- PBPI (pbpi.or.id) ----------
const PBPI_TYPES = { doubleMen: "Men's doubles", doubleWomen: "Women's doubles", doubleMixed: "Mixed doubles", singleMen: "Men's singles", singleWomen: "Women's singles" };

function pbpiNames(side) {
  const ps = (side && side.players) || [];
  if (!ps.length) return [tidy(side && side.alternativeText) || (side && side.bye ? "Bye" : "To be decided")];
  return ps.map((p) => {
    const first = tidy(p.firstName), last = titleCase(p.lastName);
    // "Raihannisa R." style names: the family name is only an initial, so keep the name as written.
    if (first && last.replace(/\./g, "").length > 1) return first.charAt(0).toUpperCase() + ". " + last;
    return titleCase(p.name) || "Player";
  });
}
function pbpiMatch(m, status) {
  const liveSets = m.live && Array.isArray(m.live.sets) && m.live.sets.length ? m.live.sets : null;
  // The live feed uses {home, away}; the order-of-play feed uses {teamHomeScore, teamOpponentScore}.
  const raw = liveSets || m.sets || m.scoreSets || [];
  const sets = raw.map((s) => ({
    h: num(s.home != null ? s.home : s.teamHomeScore),
    a: num(s.away != null ? s.away : s.teamOpponentScore),
    ht: num(s.homeTieBreak != null ? s.homeTieBreak : s.tieBreakTeamHomeScore),
    at: num(s.awayTieBreak != null ? s.awayTieBreak : s.tieBreakTeamOpponentScore)
  })).filter((s) => s.h != null && s.a != null);
  const lv = status === "live" && m.live ? m.live : null;
  const cat = [words(m.level), PBPI_TYPES[m.category || m.type] || words(m.category || m.type)].filter(Boolean).join(" · ");
  let timeLabel = "";
  if (status === "next" && !m.startTime) timeLabel = m.notBefore ? "Not before" : "Followed by";
  return {
    id: "pbpi-" + m.matchId,
    status,
    court: tidy(m.court),
    round: words(m.round),
    category: cat,
    time: m.startTime || m.notBefore || null,
    timeLabel,
    teams: [
      team(pbpiNames(m.home), sets.map((s) => s.h), sets.map((s) => s.ht), lv ? lv.home : null, lv && lv.server === "home", m.winner === "home"),
      team(pbpiNames(m.away), sets.map((s) => s.a), sets.map((s) => s.at), lv ? lv.away : null, lv && lv.server === "away", m.winner === "away")
    ]
  };
}
async function pbpi(id, f) {
  const d = await getJson(f, "https://www.pbpi.or.id/api/tournament-live?tournamentId=" + encodeURIComponent(id));
  const list = (a, st) => (Array.isArray(a) ? a : []).slice(0, MAX_LIST).map((m) => pbpiMatch(m, st));
  return { live: list(d.now, "live"), recent: list(d.recent, "done"), next: list(d.next, "next") };
}

// ---------- Alfred for Padel (alfredforpadel.com) ----------
const ALFRED = "https://www.alfredforpadel.com/api/trpc/";
const alfredIds = new Map(); // slug -> { id, name, at }

async function alfredCall(f, proc, input) {
  const url = ALFRED + proc + "?batch=1&input=" + encodeURIComponent(JSON.stringify({ 0: { json: input } }));
  const j = await getJson(f, url);
  const r = j && j[0] && j[0].result && j[0].result.data;
  if (!r) throw new Error("Unexpected answer from Alfred");
  return r.json;
}
const POINTS = ["0", "15", "30", "40"];
function alfredPoints(m, rules, side) {
  const mine = side === "home" ? m.pointsHome : m.pointsAway;
  const theirs = side === "home" ? m.pointsAway : m.pointsHome;
  if (m.inTiebreak) return String((side === "home" ? m.tbPointsHome : m.tbPointsAway) || 0);
  const a = mine || 0, b = theirs || 0;
  if (a < 3 || b < 3) return POINTS[Math.min(a, 3)];
  if ((rules && rules.deuceMode === "no-ad") || m.goldenDeciding) return "40"; // golden point
  return a > b ? "AD" : "40";
}
const utc = (s) => (s ? String(s).replace(" ", "T").replace(/(\.\d+)?$/, "") + "Z" : null);

function alfredNames(players, teamObj, slot) {
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
  // While a match is in progress the set being played is not in matchSets yet.
  if (status === "live" && done.length === (m.setsHome || 0) + (m.setsAway || 0)) {
    sets.push({ h: m.gamesHome || 0, a: m.gamesAway || 0, ht: null, at: null });
  }
  const live = status === "live";
  return {
    id: "alfred-" + m.id,
    status,
    court: tidy(m.court),
    round: tidy(m.customStageName) || (x.encounter && tidy(x.encounter.stageDisplayName)) || words(m.stage),
    category: tidy(x.category && x.category.name),
    time: utc(status === "done" ? m.completedAt : m.scheduledAt),
    timeLabel: "",
    teams: [
      team(alfredNames(x.homePlayers, x.homeTeam, x.homeSlot), sets.map((s) => s.h), sets.map((s) => s.ht), live ? alfredPoints(m, x.rules, "home") : null, live && m.servingTeam === "home", m.winnerSide === "home"),
      team(alfredNames(x.awayPlayers, x.awayTeam, x.awaySlot), sets.map((s) => s.a), sets.map((s) => s.at), live ? alfredPoints(m, x.rules, "away") : null, live && m.servingTeam === "away", m.winnerSide === "away")
    ]
  };
}
async function alfred(slug, f) {
  let t = alfredIds.get(slug);
  if (!t || Date.now() - t.at > 600000) {
    const info = await alfredCall(f, "tournamentPublic.getBySlug", { slug });
    if (!info || !info.id) throw new Error("Alfred has no tournament called " + slug);
    t = { id: info.id, name: info.name, at: Date.now() };
    alfredIds.set(slug, t);
  }
  const all = await alfredCall(f, "tournament.getMatchesByTournamentId", { tournamentId: t.id, hideUnplayableInterclub: true });
  const ms = (Array.isArray(all) ? all : []).filter((x) => x && x.match && !(x.homeTeam && x.homeTeam.isBye) && !(x.awayTeam && x.awayTeam.isBye));
  const by = (k, dir) => (p, q) => dir * String(p.match[k] || "").localeCompare(String(q.match[k] || ""));
  const live = ms.filter((x) => x.match.status === "in_progress").sort(by("updatedAt", -1));
  const recent = ms.filter((x) => x.match.status === "completed").sort(by("completedAt", -1));
  // Only show "next" matches whose pairs are known, soonest scheduled first.
  const next = ms.filter((x) => x.match.status !== "in_progress" && x.match.status !== "completed" && x.match.isPlayable !== false && x.homeTeam && x.awayTeam)
    .sort((p, q) => String(p.match.scheduledAt || "9").localeCompare(String(q.match.scheduledAt || "9")) || (p.match.position || 0) - (q.match.position || 0));
  // Only names and scores leave this function. Alfred's raw data also carries sign-up details, which are dropped here.
  return {
    title: t.name,
    live: live.slice(0, MAX_LIST).map((x) => alfredMatch(x, "live")),
    recent: recent.slice(0, MAX_LIST).map((x) => alfredMatch(x, "done")),
    next: next.slice(0, MAX_LIST).map((x) => alfredMatch(x, "next"))
  };
}

// ---------- Demo (made-up matches that move with the clock, for testing the page) ----------
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
function demoMatch(seed, steps, names, court, round, keepGoing) {
  let r = rng(seed), sets = [[0, 0]], pts = [0, 0], serve = 0, won = [0, 0], over = false;
  for (let i = 0; i < steps; i++) {
    if (over) { // this made-up match has ended: start a fresh one so there is always something live
      if (!keepGoing) break;
      r = rng(++seed); sets = [[0, 0]]; pts = [0, 0]; won = [0, 0]; over = false;
    }
    const w = r() < 0.52 ? 0 : 1; pts[w]++;
    if (pts[w] >= 4) { // golden point: first to four points takes the game
      pts[0] = pts[1] = 0; serve = 1 - serve;
      const s = sets[sets.length - 1]; s[w]++;
      if ((s[w] >= 6 && s[w] - s[1 - w] >= 2) || s[w] === 7) {
        won[w]++;
        if (won[w] === 2) over = true; else sets.push([0, 0]);
      }
    }
  }
  const t = (i) => team(names[i], sets.map((s) => s[i]), sets.map(() => null), over ? null : POINTS[pts[i]], !over && serve === i, over && won[i] === 2);
  return { id: "demo-" + court.replace(/\W/g, "").toLowerCase(), status: over ? "done" : "live", court, round, category: "Demo · Men's doubles", time: null, timeLabel: "", teams: [t(0), t(1)] };
}
export function demo(now) {
  const hour = Math.floor(now / 3600000), step = Math.floor((now % 3600000) / 8000); // one point every 8 seconds
  const a = demoMatch(hour * 1000 + 1, step, [["A. Santoso", "B. Wijaya"], ["C. Pratama", "D. Hartono"]], "Centre court", "Semifinals", true);
  const b = demoMatch(hour * 1000 + 500, Math.floor(step * 0.8) + 40, [["E. Garcia", "F. Nugroho"], ["G. Lim", "H. Siregar"]], "Court 2", "Semifinals", true);
  const c = demoMatch(hour * 1000 + 900, 9999, [["I. Kusuma", "J. Tan"], ["K. Halim", "L. Setiawan"]], "Court 3", "Quarterfinals", false);
  const n = { id: "demo-next", status: "next", court: "Centre court", round: "Final", category: "Demo · Men's doubles", time: null, timeLabel: "Followed by",
    teams: [team(["Winner SF 1"], [], [], null, false, false), team(["Winner SF 2"], [], [], null, false, false)] };
  const all = [a, b, c];
  return { demo: true, live: all.filter((m) => m.status === "live"), recent: all.filter((m) => m.status === "done"), next: [n] };
}
