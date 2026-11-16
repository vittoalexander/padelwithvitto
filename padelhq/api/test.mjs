/* Checks for the score adapters and the API. Run with:  node --test padelhq/api/test.mjs
   No internet needed: the provider answers below are small hand-made copies of the real formats. */
import test from "node:test";
import assert from "node:assert/strict";
import { getLive, validate, demo } from "../providers.js";
import worker from "./worker.js";

const player = (first, last) => ({ name: first + " " + last, firstName: first, lastName: last, handle: "private-handle", country: "indonesia" });
const side = (a, b, id) => ({ players: [a, b], teamType: "doubleMen", bye: false, alternativeText: null, teamId: id });
const PBPI = {
  now: [{ matchId: 1, court: "Centre", round: "semifinals", draw: "mainDraw", level: "open", category: "doubleMen",
    home: side(player("Andi", "Saputra"), player("BUDI", "HARTONO"), 10), away: side(player("Citra", "R."), player("Dewi", "Lestari"), 11),
    sets: [], live: { sets: [{ home: 7, away: 6, homeTieBreak: 7, awayTieBreak: 4 }, { home: 2, away: 3 }], home: "40", away: "30", server: "away" },
    startTime: "2026-11-19T02:00:00.000Z", winner: null }],
  recent: [{ matchId: 2, court: "Court 2", round: "roundOf16", level: "youthU16", category: "doubleWomen",
    home: side(player("Eka", "Putri"), player("Fina", "Sari"), 12), away: side(player("Gita", "Ayu"), player("Hana", "Dewi"), 13),
    sets: [{ home: 6, away: 2 }, { home: 6, away: 4 }], live: null, winner: "home" }],
  next: [{ matchId: 3, court: "Centre", round: "final", level: "open", category: "doubleMen",
    home: { players: [], bye: false, alternativeText: "Winner SF1" }, away: { players: [], bye: false, alternativeText: null },
    sets: [], live: null, startTime: null, notBefore: "2026-11-19T07:00:00.000Z", winner: null }]
};
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
  { match: aMatch("m3", "scheduled", {}), category: { name: "Silver Open" }, homeTeam: { name: "E / F", isBye: false }, awayTeam: { name: "", isBye: true }, homePlayers: [], awayPlayers: [], matchSets: [] }
];
function fakeFetch(calls) {
  return async (url) => {
    calls.push(String(url));
    const ok = (body) => new Response(JSON.stringify(body), { status: 200 });
    if (String(url).includes("pbpi.or.id/api/tournament-live?tournamentId=46")) return ok(PBPI);
    if (String(url).includes("tournamentPublic.getBySlug")) return ok([{ result: { data: { json: { id: "t-1", name: "Test Cup" } } } }]);
    if (String(url).includes("tournament.getMatchesByTournamentId")) return ok([{ result: { data: { json: ALFRED_MATCHES } } }]);
    return new Response("nope", { status: 404 });
  };
}

test("PBPI: live, finished and next matches come out in the common shape", async () => {
  const d = await getLive("pbpi", "46", fakeFetch([]));
  assert.equal(d.providerName, "PBPI");
  const m = d.live[0];
  assert.equal(m.status, "live");
  assert.equal(m.round, "Semifinals");
  assert.equal(m.category, "Open · Men's doubles");
  assert.deepEqual(m.teams[0].names, ["A. Saputra", "B. Hartono"]);          // ALL CAPS family name repaired
  assert.deepEqual(m.teams[1].names, ["Citra R.", "D. Lestari"]);            // initial-only family name left as written
  assert.deepEqual(m.teams[0].sets, [7, 2]);
  assert.deepEqual(m.teams[0].tb, [7, null]);
  assert.equal(m.teams[0].points, "40");
  assert.equal(m.teams[1].serving, true);
  assert.equal(d.recent[0].category, "Youth U16 · Women's doubles");
  assert.equal(d.recent[0].round, "Round of 16");
  assert.equal(d.recent[0].teams[0].winner, true);
  assert.deepEqual(d.next[0].teams[0].names, ["Winner SF1"]);
  assert.deepEqual(d.next[0].teams[1].names, ["To be decided"]);
  assert.equal(d.next[0].timeLabel, "Not before");
});

test("Alfred: scores are read correctly and sign-up details never leave the adapter", async () => {
  const d = await getLive("alfred", "test-cup", fakeFetch([]));
  const m = d.live[0];
  assert.deepEqual(m.teams[0].names, ["Rudi", "Sari"]);
  assert.deepEqual(m.teams[0].sets, [6, 4]);          // finished set plus the set in progress
  assert.deepEqual(m.teams[1].sets, [3, 2]);
  assert.equal(m.teams[0].points, "40");              // 3-3 with golden point shows 40-40
  assert.equal(m.teams[0].serving, true);
  assert.equal(d.recent[0].teams[1].winner, true);
  assert.deepEqual(d.recent[0].teams[0].names, ["A", "B"]);
  assert.equal(d.recent[0].time, "2026-11-21T02:10:00Z");
  assert.equal(d.next.length, 0);                     // a bye is not a match
  const text = JSON.stringify(d);
  for (const secret of ["@secret", "jerseySize", "userId", "u-rudi"]) assert.ok(!text.includes(secret), secret + " leaked");
});

test("Only known providers and well-formed ids are accepted", () => {
  assert.equal(validate("pbpi", "46"), "");
  assert.equal(validate("alfred", "padel-gp500"), "");
  for (const [p, id] of [["pbpi", "46/../x"], ["pbpi", ""], ["alfred", "https://evil.example"], ["alfred", "a b"], ["incourta", "x"], ["nope", "1"]]) {
    assert.notEqual(validate(p, id), "", p + ":" + id + " should be rejected");
  }
});

test("Demo feed moves as time passes and always has a match in progress", () => {
  const a = demo(1700000000000), b = demo(1700000000000 + 60000);
  assert.ok(a.live.length >= 1 && b.live.length >= 1);
  assert.notEqual(JSON.stringify(a.live), JSON.stringify(b.live));
});

test("API: routes, bad input, and who may read it from a browser", async () => {
  const get = (path, origin) => worker.fetch(new Request("http://api.test" + path, origin ? { headers: { origin } } : {}), {}, {});
  assert.equal((await get("/v1/health")).status, 200);
  assert.equal((await get("/v1/live?provider=pbpi&id=abc")).status, 400);
  assert.equal((await get("/v1/live?provider=incourta&id=x")).status, 400);
  assert.equal((await get("/v1/elsewhere")).status, 404);
  assert.equal((await worker.fetch(new Request("http://api.test/v1/live", { method: "POST" }), {}, {})).status, 405);
  const ok = await get("/v1/live?provider=demo&id=x", "https://vittoalexander.github.io");
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://vittoalexander.github.io");
  assert.ok(Array.isArray((await ok.json()).live));
  const other = await get("/v1/live?provider=demo&id=x", "https://someone-else.example");
  assert.equal(other.headers.get("access-control-allow-origin"), null);
});

test("API: remembers an answer briefly, and serves the last good one if the provider goes down", async () => {
  const realFetch = globalThis.fetch; const calls = []; let down = false; const realNow = Date.now;
  globalThis.fetch = async (url) => { if (down) throw new Error("provider down"); return fakeFetch(calls)(url); };
  try {
    const get = () => worker.fetch(new Request("http://api.test/v1/live?provider=pbpi&id=46"), {}, {}).then((r) => r.json().then((j) => [r.status, j]));
    const [s1, first] = await get();
    const [, second] = await get();
    assert.equal(s1, 200);
    assert.equal(calls.length, 1, "second request within a few seconds must not hit the provider again");
    assert.equal(second.cached, true);
    down = true; Date.now = () => realNow() + 60000;       // a minute later, provider is down
    const [s3, third] = await get();
    assert.equal(s3, 200);
    assert.equal(third.stale, true);
    assert.deepEqual(third.live, first.live);
    Date.now = () => realNow() + 3600000;                  // an hour later: too old to show
    const [s4] = await get();
    assert.equal(s4, 502);
  } finally { globalThis.fetch = realFetch; Date.now = realNow; }
});
