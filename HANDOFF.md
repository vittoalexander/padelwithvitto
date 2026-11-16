# Handoff: padelwithvitto

Updated 16 Nov 2026.

## Done (all live on main)
- Back link "← padelwithvitto" on padel-101, shot-breaks and road-to-pro.
- "Last updated 16 Nov 2026" on every page (landing, padel-101, shot-breaks, road-to-pro, sponsors.html, guide 3): a visible <time> element plus an article:modified_time meta tag. Change both when a page changes.
- Guide 3 complete at people-lose-it/index.html: hero, chapters 00-06, flip-the-set tool, six-line recap, three next-match actions, "The case against this guide" (three objections with replies), data disclosure.
- Animations: scroll sets a target and each figure eases toward it at a capped speed; on phones the figure pins under the header while it plays.
- After the devil's-advocate review: chapter 01 explains why (winners 14.2 vs 13.1, errors 11.6 vs 17.9) and adds the match-level check (10 of 10); absolute wording softened to "in this sample"; disclosure adds 10 matches, 13 stats tested, set-by-set counting, dates and source.
- Charting template for chapter 06: people-lose-it/downloads/padel-set-charting-template.xlsx and .pdf, v1.0, rebuilt from the Template tab layout (no player names). Caveats stated: 10 marks per shot, one set per sheet.
- Source sheet: Padel Benchmark Lab, Reverse stress test tab, section D, rows 51-56 added (independent matches, match-level check, stats tested, why the UE gap dominates, unforced is a judgement, counting method).

## PadelHQ (test build, on branch claude/gifted-keller-k1xu9w, not yet on main)
- padelhq/: index.html, style.css, config.js, events.js, app.js (calendar), live.js (scoreboards), providers.js (score adapters), api/ (score API). Lives only in this repo, so publish.sh leaves it alone. No build step.
- Calendar: month grid (Monday first, Indonesia time), "Live now / Next up" strip, event cards, "Dates to be confirmed" list.
- Live scores: each event has a scoring platform (scoring) and that platform's id (scoringId). On the event's dates the page draws a scoreboard and refreshes it every 15 s.
  - PBPI: reads pbpi.or.id/api/tournament-live?tournamentId=N (the same feed PBPI's own page polls every 15 s). PBPI does not allow other sites' pages to read it from a browser, so it only works through the score API. Sirkuit Nasional Bali = 46, Youth = 48, Medan 2026 = 43 (finished, good for testing).
  - Alfred for Padel: reads its public tRPC endpoints. Works from the browser too, so it is live even without the API (slower refresh, 30 s).
  - Incourta, Recourt, SkorPad, PadelScore.id: link-out only. Incourta's robots.txt disallows its data endpoints and Recourt's disallows Anthropic agents, so neither was read. Ask them for access before adding adapters.
  - Instagram shows a login wall to the cloud session, so captions cannot be read. "SkorApp" could not be matched to a public web score page.
- Score API: padelhq/api/worker.js (Cloudflare Worker), 12 s cache, last good answer for 15 min if a platform is down, browser access limited to vittoalexander.github.io and localhost. Not deployed yet. After deploying, put its address in config.js -> apiBase. See padelhq/api/README.md.
- Testing: node --test padelhq/api/test.mjs (6 checks). node padelhq/api/dev-server.mjs then http://localhost:8788/?api=http://localhost:8787&demo=1 or &scores=pbpi:43.
- Not yet seen with a real match in progress: the PBPI "live" fields (points, server) were taken from PBPI's page code, and Alfred's in-progress set handling from its page code. Check both on the first live day (19 Nov for PBPI, 21 Nov for Alfred).
- Cloud environment "padelwithvitto" allows the provider sites, pbpi.or.id, instagram.com and vittoalexander.github.io.
- Data: events.js is the built-in list; config.js -> sheetCsvUrl switches to a Google Sheet (columns now include "Scoring provider" and "Scoring ID"). Sheet not created yet (plan shown, waiting for approval).
- Design: charcoal #0D1012, ball green #C8F53C (Tier 1, live, main action), tosca #2FD6C3 (secondary), amber #FFB454 (deadlines, unconfirmed). Barlow Condensed headings, Barlow body, DM Mono labels and scores.
- Next: deploy the API, merge to main, create the Google Sheet, link PadelHQ from the landing page, then tournament pages (draws, order of play).

## Left
- Vitto checks the live site by eye (the cloud session cannot fetch github.io).
- Copy the edited padel-101, shot-breaks and road-to-pro files from this repo back into the local source folders (padel-101, padel-shot-breaks, padel-athlete-site). Otherwise the next publish.sh run overwrites the back link and the date stamps. Guide 3 and the landing page live only in this repo, so publish.sh leaves them alone.
- Guide 3 follow-ups worth doing with a second batch of charted sets: re-test findings 3-5 (volley, overhead), and re-run the "would break finding 1" check.
- Padel 101 phases 3-4.

## Guide 3 decisions
- One guide, for improvers who want numbers behind their next step. Few numbers, analogies with matching visuals.
- Theme: "nobody wins padel, people lose it" / "a bird in the hand". Reverse stress test is the closing idea.
- Design: PadelIQ direction A "Signature" (navy #002941, soft blue #B6DFED, coral #FD6E6E). Coral = errors and key numbers, soft blue = winners. Never white on coral.
- Data: Indonesian Padel League, high Silver and up (about 4.0-6.5), 23 scored sets, 16-24 Oct 2026, 1,307 points. Everyone except Vitto anonymised. Be open about what is in the data, in the spirit of a CFA performance presentation.
- No "forced error" box: a shot that forces a miss counts as a winner. Shot list is incomplete (wall exits, counter-smashes filed under FH/BH/volley/smash). Vitto is happy to say his calls are sometimes wrong.

## Usage guard
State phase and size, wait for "go", one phase per run, update this file, commit.
