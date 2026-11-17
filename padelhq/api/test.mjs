/* Checks for the score adapters and the API. Run with:  node --test padelhq/api/test.mjs
   No internet needed: the provider answers below are small hand-made copies of the real formats. */
import test from "node:test";
import assert from "node:assert/strict";
import { getLive, getSchedule, validate, validateSchedule, demo, todayJakarta } from "../providers.js";
import worker from "./worker.js";

// ---------- hand-made provider answers ----------
const player = (first, last) => ({ name: first + " " + last, firstName: first, lastName: last, handle: "private-handle", country: "indonesia" });
const side = (a, b, id) => ({ players: [a, b], teamType: "doubleMen", bye: false, alternativeText: null, teamId: id });
const PBPI_LIVE = {
  now: [
    { matchId: 1, court: "Centre", round: "semifinals", draw: "mainDraw", level: "open", category: "doubleMen",
      home: side(player("Andi", "Saputra"), player("BUDI", "HARTONO"), 10), away: side(player("Citra", "R."), player("Dewi", "Lestari"), 11),
      sets: [], live: { sets: [{ home: 7, away: 6, homeTieBreak: 7, awayTieBreak: 4 }, { home: 2, away: 3 }], home: "40", away: "30", server: "away" },
      startTime: "2026-11-19T02:00:00.000Z", winner: null, featured: true, featuredNote: "Live on YouTube" },
    // A match that is on court but only gets its set scores typed in, with no point-by-point data.
    { matchId: 4, court: "Court 4", round: "groupStage", level: "open", category: "doubleWomen",
      home: side(player("Ika", "Wulan"), player("Jeni", "Ayu"), 14), away: side(player("Kiki", "Sari"), player("Lia", "Dewi"), 15),
      sets: [{ home: 3, away: 1 }], live: { sets: [], home: null, away: null, server: null }, winner: null }
  ],
  recent: [{ matchId: 2, court: "Court 2", round: "roundOf16", level: "youthU16", category: "doubleWomen",
    home: side(player("Eka", "Putri"), player("Fina", "Sari"), 12), away: side(player("Gita", "Ayu"), player("Hana", "Dewi"), 13),
    sets: [{ home: 6, away: 2 }, { home: 6, away: 4 }], live: null, winner: "home" }],
  next: [{ matchId: 3, court: "Centre", round: "final", level: "open", category: "doubleMen",
    home: { players: [], bye: false, alternativeText: "Winner SF1" }, away: { players: [], bye: false, alternativeText: null },
    sets: [], live: null, startTime: null, notBefore: "2026-11-19T07:00:00.000Z", winner: null }]
};
const oop = (matchId, order, court, courtId, venue, status, extra) => Object.assign({
  id: 100 + matchId, matchId, matchOrder: order, court, courtId, courtVenue: venue, venue, matchStatus: status, live: null, featured: false, featuredNote: null,
  level: "open", type: "doubleMen", isStarting: order === 1, startTime: order === 1 ? "2026-11-19T01:00:00.000Z" : null, notBefore: null, round: "roundOf32",
  home: side(player("Home", "One" + matchId), player("Home", "Two" + matchId), matchId * 2), away: side(player("Away", "One" + matchId), player("Away", "Two" + matchId), matchId * 2 + 1),
  scoreSets: []
}, extra);
const set = (h, a, ht, at) => ({ teamHomeScore: h, teamOpponentScore: a, tieBreakTeamHomeScore: ht == null ? null : ht, tieBreakTeamOpponentScore: at == null ? null : at });
const PBPI_DAYS = { message: "Order of Play detail", data: { dateOption: [
  { label: "20/11/2026", value: "2026-11-20T00:00:00.000Z" }, { label: "19/11/2026", value: "2026-11-19T00:00:00.000Z" }] } };
const PBPI_OOP = { message: "ok", data: { orderOfPlay: [
  oop(13, 3, "Court 10", 3, "Monster Padel", "scheduled", {}),
  oop(12, 2, "Court 2", 2, "Monster Padel", "ongoing", { live: { sets: [{ home: 4, away: 4 }], home: "15", away: "0", server: "home" } }),
  oop(11, 1, "Court 2", 2, "Monster Padel", "completed", { scoreSets: [set(6, 7, 5, 7), set(6, 2), set(8, 10)] }),   // third "set" is a match tie-break
  oop(14, 1, "Court 10", 3, "Monster Padel", "completed", { scoreSets: [] }),                                           // walkover: no score, no winner
  oop(15, 2, "Court 10", 3, "Monster Padel", "scheduled", { notBefore: "2026-11-19T06:00:00.000Z", type: "doubleWomen" })
] } };

const aPlayer = (n) => ({ id: n, displayName: n, instagram: "@secret", jerseySize: "L", userId: "u-" + n });
const aMatch = (id, status, extra) => Object.assign({ id, status, stage: "group_a", court: "Court 1", isPlayable: true, pointsHome: 0, pointsAway: 0, gamesHome: 0, gamesAway: 0, setsHome: 0, setsAway: 0, tbPointsHome: 0, tbPointsAway: 0, inTiebreak: false, goldenDeciding: false, servingTeam: null, winnerSide: null, scheduledAt: null, completedAt: null, updatedAt: "2026-11-21 03:00:00" }, extra);
const ALFRED_MATCHES = [
  { match: aMatch("m1", "in_progress", { pointsHome: 3, pointsAway: 3, gamesHome: 4, gamesAway: 2, setsHome: 1, setsAway: 0, servingTeam: "home" }),
    category: { name: "Silver Open" }, homeTeam: { name: "x", isBye: false }, awayTeam: { name: "y", isBye: false },
    homePlayers: [aPlayer("rudi"), aPlayer("Sari")], awayPlayers: [aPlayer("Tono"), aPlayer("Umar")], rules: { deuceMode: "no-ad" },
    matchSets: [{ setIndex: 1, gamesHome: 6, gamesAway: 3, tbPointsHome: null, tbPointsAway: null, winnerSide: "home" }] },
  { match: aMatch("m2", "completed", { winnerSide: "away", completedAt: "2026-11-21 02:10:00.5", gamesHome: 2, gamesAway: 6, setsAway: 1 }),
    category: { name: "Silver Open" }, homeTeam: { name: "A / B", isBye: false }, awayTeam: { name: "C / D", isBye: false }, homePlayers: [], awayPlayers: [], rules: {},
    matchSets: [{ setIndex: 1, gamesHome: 2, gamesAway: 6, winnerSide: "away" }] },
  { match: aMatch("m3", "scheduled", {}), category: { name: "Silver Open" }, homeTeam: { name: "E / F", isBye: false }, awayTeam: { name: "", isBye: true }, homePlayers: [], awayPlayers: [], matchSets: [] },
  { match: aMatch("m4", "in_progress", { pointsHome: 4, pointsAway: 3, gamesHome: 1, gamesAway: 1, servingTeam: "away" }),
    category: { name: "Bronze Open" }, homeTeam: { name: "G / H", isBye: false }, awayTeam: { name: "I / J", isBye: false }, homePlayers: [], awayPlayers: [], rules: { deuceMode: "advantage" }, matchSets: [] },
  { match: aMatch("m5", "in_progress", { inTiebreak: true, tbPointsHome: 5, tbPointsAway: 6, gamesHome: 6, gamesAway: 6 }),
    category: { name: "Bronze Open" }, homeTeam: { name: "K / L", isBye: false }, awayTeam: { name: "M / N", isBye: false }, homePlayers: [], awayPlayers: [], rules: {}, matchSets: [] }
];
function fakeFetch(calls) {
  return async (url) => {
    url = String(url); calls.push(url);
    const ok = (body) => new Response(JSON.stringify(body), { status: 200 });
    if (url.includes("pbpi.or.id/api/tournament-live?tournamentId=46")) return ok(PBPI_LIVE);
    if (url.includes("pbpi.or.id/api/order-of-play-date-options/46")) return ok(PBPI_DAYS);
    if (url.includes("pbpi.or.id/api/order-of-play-date-options/47")) return ok({ data: { dateOption: [] } });
    if (url.includes("pbpi.or.id/api/order-of-play/46/")) return ok(PBPI_OOP);
    if (url.includes("tournamentPublic.getBySlug")) return ok([{ result: { data: { json: { id: "t-1", name: "Test Cup" } } } }]);
    if (url.includes("tournament.getMatchesByTournamentId")) return ok([{ result: { data: { json: ALFRED_MATCHES } } }]);
    return new Response("nope", { status: 404 });
  };
}

// ---------- adapters ----------
test("PBPI live: live, finished and next matches come out in the common shape", async () => {
  const d = await getLive("pbpi", "46", fakeFetch([]));
  assert.equal(d.providerName, "PBPI");
  const m = d.live[0];
  assert.equal(m.status, "live");
  assert.equal(m.round, "Semifinals");
  assert.equal(m.category, "Open · Men's doubles");
  assert.deepEqual(m.teams[0].names, ["A. Saputra", "B. Hartono"]);          // ALL CAPS family name repaired
  assert.deepEqual(m.teams[0].full, ["Andi Saputra", "Budi Hartono"]);        // full names kept for the player search
  assert.deepEqual(m.teams[1].names, ["Citra R.", "D. Lestari"]);            // initial-only family name left as written
  assert.deepEqual(m.teams[0].sets, [7, 2]);
  assert.deepEqual(m.teams[0].tb, [7, null]);
  assert.equal(m.teams[0].points, "40");
  assert.equal(m.teams[1].serving, true);
  assert.equal(m.featured, true);
  assert.equal(m.note, "Live on YouTube");
  assert.equal(d.recent[0].category, "Youth U16 · Women's doubles");
  assert.equal(d.recent[0].round, "Round of 16");
  assert.equal(d.recent[0].teams[0].winner, true);
  assert.deepEqual(d.next[0].teams[0].names, ["Winner SF1"]);
  assert.deepEqual(d.next[0].teams[1].names, ["To be decided"]);
  assert.equal(d.next[0].timeLabel, "Not before");
  assert.equal(d.next[0].time, "2026-11-19T07:00:00.000Z");
});

test("PBPI live: a match on court without point-by-point scoring shows set scores and no points", async () => {
  const d = await getLive("pbpi", "46", fakeFetch([]));
  const m = d.live[1];
  assert.equal(m.status, "live");
  assert.deepEqual(m.teams[0].sets, [3]);
  assert.equal(m.teams[0].points, null);
  assert.equal(m.teams[1].points, null);
  assert.equal(m.teams[0].serving, false);
});

test("PBPI order of play: courts, order, statuses, winners and day choice", async () => {
  const calls = [];
  const d = await getSchedule("pbpi", "46", "2026-11-19", fakeFetch(calls));
  assert.deepEqual(d.days.map((x) => x.date), ["2026-11-19", "2026-11-20"]);          // sorted, even if the provider lists them out of order
  assert.equal(d.date, "2026-11-19");
  assert.ok(calls.some((u) => u.includes("order-of-play/46/2026-11-19T00%3A00%3A00.000Z")));
  assert.deepEqual(d.courts.map((c) => c.name), ["Court 2", "Court 10"]);              // Court 2 before Court 10 (number order, not alphabet)
  assert.equal(d.courts[0].venue, "Monster Padel");
  const [c2, c10] = d.courts;
  assert.deepEqual(c2.matches.map((m) => m.order), [1, 2]);
  const done = c2.matches[0], live = c2.matches[1];
  assert.equal(done.status, "done");
  assert.deepEqual(done.teams[0].sets, [6, 6, 8]);
  assert.deepEqual(done.teams[1].sets, [7, 2, 10]);
  assert.deepEqual(done.teams[0].tb, [5, null, null]);
  assert.equal(done.teams[1].winner, true);                                             // two sets to one, worked out from the scores
  assert.equal(done.teams[0].winner, false);
  assert.equal(done.court, "");                                                         // the court is the group heading
  assert.equal(live.status, "live");
  assert.equal(live.teams[0].points, "15");
  assert.equal(live.teams[0].serving, true);
  assert.equal(live.timeLabel, "Followed by");
  assert.deepEqual(c10.matches.map((m) => m.status), ["done", "next", "next"]);
  assert.equal(c10.matches[0].teams[0].winner || c10.matches[0].teams[1].winner, false);  // walkover with no score: no winner claimed
  assert.equal(c10.matches[1].timeLabel, "Not before");
  assert.equal(c10.matches[1].category, "Open · Women's doubles");
  assert.equal(c10.matches[2].timeLabel, "Followed by");
});

test("PBPI order of play: picks a sensible day when none is asked for, and copes with nothing published", async () => {
  const realNow = Date.now;
  try {
    Date.now = () => Date.parse("2026-11-20T05:00:00Z");
    assert.equal((await getSchedule("pbpi", "46", "", fakeFetch([]))).date, "2026-11-20");      // today
    Date.now = () => Date.parse("2026-11-17T05:00:00Z");
    assert.equal((await getSchedule("pbpi", "46", "", fakeFetch([]))).date, "2026-11-19");      // before the event: first day
    Date.now = () => Date.parse("2026-11-25T05:00:00Z");
    assert.equal((await getSchedule("pbpi", "46", "", fakeFetch([]))).date, "2026-11-20");      // after the event: last day
    assert.equal((await getSchedule("pbpi", "46", "2026-01-01", fakeFetch([]))).date, "2026-11-20"); // a day with no play falls back
  } finally { Date.now = realNow; }
  const empty = await getSchedule("pbpi", "47", "", fakeFetch([]));
  assert.deepEqual(empty.days, []);
  assert.equal(empty.date, null);
  assert.deepEqual(empty.courts, []);
});

test("Jakarta date is used for 'today' (late evening UTC is already tomorrow in Indonesia)", () => {
  assert.equal(todayJakarta(Date.parse("2026-11-18T16:59:00Z")), "2026-11-18");
  assert.equal(todayJakarta(Date.parse("2026-11-18T17:00:00Z")), "2026-11-19");
});

test("Alfred: scores are read correctly and sign-up details never leave the adapter", async () => {
  const d = await getLive("alfred", "test-cup", fakeFetch([]));
  const m = d.live.find((x) => x.id === "alfred-m1");
  assert.deepEqual(m.teams[0].names, ["Rudi", "Sari"]);
  assert.deepEqual(m.teams[0].sets, [6, 4]);          // finished set plus the set in progress
  assert.deepEqual(m.teams[1].sets, [3, 2]);
  assert.equal(m.teams[0].points, "40");              // 3-3 with golden point shows 40-40
  assert.equal(m.teams[1].points, "40");
  assert.equal(m.teams[0].serving, true);
  const adv = d.live.find((x) => x.id === "alfred-m4");
  assert.equal(adv.teams[0].points, "AD");            // 4-3 with advantage scoring
  assert.equal(adv.teams[1].points, "40");
  assert.equal(adv.teams[1].serving, true);
  const tb = d.live.find((x) => x.id === "alfred-m5");
  assert.deepEqual([tb.teams[0].points, tb.teams[1].points], ["5", "6"]);   // tie-break points are plain numbers
  assert.equal(d.recent[0].teams[1].winner, true);
  assert.deepEqual(d.recent[0].teams[0].names, ["A", "B"]);
  assert.equal(d.recent[0].time, null);               // no clock times from Alfred: its time zone is not stated
  assert.equal(d.next.length, 0);                     // a bye is not a match
  const text = JSON.stringify(d);
  for (const secret of ["@secret", "jerseySize", "userId", "u-rudi"]) assert.ok(!text.includes(secret), secret + " leaked");
});

test("Only known providers, well-formed ids and dates are accepted", () => {
  assert.equal(validate("pbpi", "46"), "");
  assert.equal(validate("alfred", "padel-gp500"), "");
  for (const [p, id] of [["pbpi", "46/../x"], ["pbpi", ""], ["pbpi", "1234567"], ["alfred", "https://evil.example"], ["alfred", "a b"], ["alfred", "-x"], ["incourta", "x"], ["nope", "1"], ["__proto__", "1"], ["constructor", "1"]]) {
    assert.notEqual(validate(p, id), "", p + ":" + id + " should be rejected");
  }
  assert.equal(validateSchedule("pbpi", "46", ""), "");
  assert.equal(validateSchedule("pbpi", "46", "2026-11-19"), "");
  assert.notEqual(validateSchedule("pbpi", "46", "19/11/2026"), "");
  assert.notEqual(validateSchedule("pbpi", "46", "2026-11-19T00:00"), "");
  assert.notEqual(validateSchedule("alfred", "padel-gp500", ""), "");      // Alfred has no order of play feed
});

test("Demo feed moves as time passes and always has a match in progress", () => {
  const a = demo(1700000000000), b = demo(1700000000000 + 60000);
  assert.ok(a.live.length >= 1 && b.live.length >= 1);
  assert.notEqual(JSON.stringify(a.live), JSON.stringify(b.live));
  for (let t = 0; t < 3600; t += 37) assert.ok(demo(1700000000000 + t * 1000).live.length >= 1, "no live demo match at +" + t + "s");
});

// ---------- the API ----------
const get = (path, origin) => worker.fetch(new Request("http://api.test" + path, origin ? { headers: { origin } } : {}), {}, {});

test("API: routes, bad input, and who may read it from a browser", async () => {
  assert.equal((await get("/v1/health")).status, 200);
  assert.equal((await get("/")).status, 200);
  assert.equal((await get("/v1/live?provider=pbpi&id=abc")).status, 400);
  assert.equal((await get("/v1/live?provider=incourta&id=x")).status, 400);
  assert.equal((await get("/v1/live")).status, 400);
  assert.equal((await get("/v1/schedule?provider=pbpi&id=46&date=tomorrow")).status, 400);
  assert.equal((await get("/v1/schedule?provider=alfred&id=some-cup")).status, 400);
  assert.equal((await get("/v1/elsewhere")).status, 404);
  assert.equal((await worker.fetch(new Request("http://api.test/v1/live", { method: "POST" }), {}, {})).status, 405);
  const providers = await (await get("/v1/providers")).json();
  assert.ok(providers.providers.some((p) => p.key === "pbpi" && p.live && p.schedule));
  const ok = await get("/v1/live?provider=demo&id=x", "https://vittoalexander.github.io");
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://vittoalexander.github.io");
  assert.ok(Array.isArray((await ok.json()).live));
  const other = await get("/v1/live?provider=demo&id=x", "https://someone-else.example");
  assert.equal(other.headers.get("access-control-allow-origin"), null);
  const pre = await worker.fetch(new Request("http://api.test/v1/live", { method: "OPTIONS", headers: { origin: "https://vittoalexander.github.io" } }), {}, {});
  assert.equal(pre.status, 204);
  const open = await worker.fetch(new Request("http://api.test/v1/health", { headers: { origin: "https://anything.example" } }), { ALLOWED_ORIGINS: "*" }, {});
  assert.equal(open.headers.get("access-control-allow-origin"), "*");
});

test("API: remembers an answer briefly, and serves the last good one if the provider goes down", async () => {
  const realFetch = globalThis.fetch; const calls = []; let down = false; const realNow = Date.now;
  globalThis.fetch = async (url) => { if (down) throw new Error("provider down"); return fakeFetch(calls)(url); };
  try {
    const live = () => get("/v1/live?provider=pbpi&id=46").then((r) => r.json().then((j) => [r.status, j]));
    const [s1, first] = await live();
    const [, second] = await live();
    assert.equal(s1, 200);
    assert.equal(calls.length, 1, "second request within a few seconds must not hit the provider again");
    assert.equal(second.cached, true);

    const sched = (date) => get("/v1/schedule?provider=pbpi&id=46" + (date ? "&date=" + date : "")).then((r) => r.json().then((j) => [r.status, j]));
    const before = calls.length;
    const [s2, day] = await sched("2026-11-19");
    assert.equal(s2, 200);
    assert.equal(day.courts.length, 2);
    await sched("2026-11-19");
    assert.equal(calls.length, before + 2, "an order of play costs two provider requests, and a repeat costs none");

    down = true; Date.now = () => realNow() + 60000;       // a minute later, provider is down
    const [s3, third] = await live();
    assert.equal(s3, 200);
    assert.equal(third.stale, true);
    assert.deepEqual(third.live, first.live);
    const [s5, staleDay] = await sched("2026-11-19");
    assert.equal(s5, 200);
    assert.equal(staleDay.stale, true);
    Date.now = () => realNow() + 3600000;                  // an hour later: too old to show
    const [s4] = await live();
    assert.equal(s4, 502);
  } finally { globalThis.fetch = realFetch; Date.now = realNow; }
});

test("API: many visitors at the same moment share one provider request", async () => {
  const realFetch = globalThis.fetch; let hits = 0;
  globalThis.fetch = async (url) => { hits++; await new Promise((r) => setTimeout(r, 20)); return fakeFetch([])(url); };
  try {
    const all = await Promise.all(Array.from({ length: 25 }, () => get("/v1/schedule?provider=pbpi&id=46&date=2026-11-20")));
    assert.ok(all.every((r) => r.status === 200));
    assert.equal(hits, 2);
  } finally { globalThis.fetch = realFetch; }
});
