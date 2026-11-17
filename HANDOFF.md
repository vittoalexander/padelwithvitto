# Handoff: padelwithvitto

Updated 17 Nov 2026.

## Goal
- Keep the padelwithvitto sites (landing, Padel 101, Why a padel shot breaks, Road to Pro, Guide 3) correct and live.
- Next content: Padel 101 phases 3-4, and a Guide 4.

## Done (all live on main)
- Back link "← padelwithvitto" on padel-101, shot-breaks and road-to-pro.
- "Last updated 16 Nov 2026" on every page: a visible <time> element plus an article:modified_time meta tag. Change both when a page changes.
- Guide 3 complete at people-lose-it/index.html ("Nobody wins padel. People lose it."): chapters 00-06, flip-the-set tool, six-line recap, three next-match actions, "The case against this guide", data disclosure.
- Charting template downloads: people-lose-it/downloads/padel-set-charting-template.xlsx and .pdf (v1.0).
- Landing page: two cards per row, Guide 03 card in the Signature navy look, Road to Pro card in white and orange, dashed "Guide 04 · Coming next." placeholder.
- Road to Pro: Valentine's wording made neutral (story chapter, day-counter caption, partner guide), 15 kg line added to the story, "Everything else later." on its own line. Top navigation is the ORIGINAL version (the boxed version was tried and reverted at Vitto's request). Stylesheet link is style.css?v=8; bump the number whenever style.css changes.
- Source sheet: Padel Benchmark Lab, Reverse stress test tab, section D rows 51-56 added.

## PadelHQ (live at /padelhq/ since 17 Nov 2026)
- What it is: calendar and live scores for open-level padel in Indonesia. padelhq/: index.html, style.css, config.js, events.js, app.js (calendar), live.js (scoreboards), providers.js (score adapters), api/ (score API), og.png, favicon.svg. Lives only in this repo, so publish.sh leaves it alone. No build step. Bump the ?v= numbers in index.html (and the import in live.js) when a script or the stylesheet changes.
- Tournament list: Google Sheet "PadelHQ Events" (id 1xUILyClgipeGOEVEWOLCm000M0gOBawmiSwXOFHrbYg), tab Events, table from B5, shared as anyone-with-link viewer. The page reads it as CSV (config.js -> sheetCsvUrl). If it fails or takes over 6 s the page uses the last copy it saw, then events.js. Tab Guide explains each column. Dates can be typed as 19 Nov 2026, 2026-11-19 or 19/11/2026.
- Calendar: month grid (Monday first, Indonesia time), "On now / Next up" strip, event cards (only real buttons, Add to Google Calendar), "Dates to be confirmed" list.
- Scoreboards: each event has a scoring platform (Scoring provider) and that platform's id (Scoring ID). A board shows from 2 days before the start until 1 day after the end.
  - PBPI: live matches from pbpi.or.id/api/tournament-live?tournamentId=N (the feed PBPI's own page polls every 15 s) and the order of play from /api/order-of-play-date-options/N and /api/order-of-play/N/<date>. PBPI does not allow other sites' pages to read these from a browser, so PBPI only works through the score API. Sirkuit Nasional Bali = 46, Youth = 48, Medan 2026 = 43 (finished, good for testing).
  - Alfred for Padel: public tRPC endpoints. Works from the browser too, so it is live even without the API (30 s refresh instead of 15 s).
  - Incourta, Recourt, SkorPad, PadelScore.id: link-out only. Incourta's robots.txt disallows its data endpoints and Recourt's disallows Anthropic agents, so neither was read. Ask them for access before adding adapters.
  - Instagram shows a login wall to the cloud session, so captions cannot be read. "SkorApp" could not be matched to a public web score page.
- Score API: padelhq/api/worker.js, live at https://padelhq-scores.vittoalexander13.workers.dev (config.js -> apiBase). Routes /v1/live and /v1/schedule. 12 s memory for live, 30 s for the order of play, last good answer for 15 min if a platform is down, browser access limited to vittoalexander.github.io and localhost.
- How it deploys: Cloudflare is connected to this GitHub repo (Workers Builds) and runs "npx wrangler deploy" at the repo root on every push to main. wrangler.jsonc at the root points it at padelhq/api/worker.js. Do not delete that file: without it Cloudflare uploads the whole repo as a website instead. No API token is needed (the one saved in the cloud environment is invalid and unused).
- Verified on 17 Nov: PBPI answers requests from Cloudflare, the short memory works on workers.dev, Alfred's large answers are fine. Free plan allows 100,000 requests a day (about 550 viewer-hours of live watching).
- Not yet seen with a real match in progress: PBPI's live fields (points, server) and Alfred's in-progress set were taken from each platform's page code. Check on the first live day (19 Nov for PBPI, 21 Nov for Alfred).
- Testing: node --test padelhq/api/test.mjs (11 checks). node padelhq/api/dev-server.mjs, then http://localhost:8788/?api=http://localhost:8787 plus &demo=1, &scores=pbpi:43 or &today=2026-11-19. ?builtin=1 skips the sheet.
- Cloud environment "padelwithvitto" allows the provider sites, pbpi.or.id, instagram.com, docs.google.com and vittoalexander.github.io.
- Design: charcoal #0D1012, ball green #C8F53C (Tier 1, live, main action), tosca #2FD6C3 (secondary), amber #FFB454 (deadlines, unconfirmed). Barlow Condensed headings, Barlow body, DM Mono labels and scores.
- Indonesian Padel League (IPL 2026, presented by bale): match weeks 7-15, the moved week 4 (3-5 Jan 2027, clubs and venues not yet known to us) and the play-offs are in the sheet as calendar rows (22 rows, names start with "IPL"). Source: instagram.com/p/Dd0jhzJE9m7 (screenshots from Vitto). Each week has 2 venues; the home club hosts 3 visiting clubs on 3 days, 10:00-21:00. Line-ups are submitted on match day. Scoring partner is SKOR (no public web score page found yet, so no live scores).
  - Points, men: win 2-0 or 2-1 = 3, lose 1-2 = 1, lose 0-3 (as printed; means losing without winning a set) = 0. Women: win = 3, loss = 0.
  - Standings 17 Nov, men (M W L Pts): Rosiade 7 6 1 19; Dewa United 9 4 5 16; Aubry 5 5 0 15; ASC 8 4 4 15; Yasika 7 4 3 14; Blacksteel 7 3 4 10; AAS 3 2 1 6; Exodia 6 1 5 5; Onic 5 1 4 4; Belio Midnight Borneo 3 0 3 3.
  - Standings 17 Nov, women: Blacksteel 7 7 0 21; Dewa United 9 7 2 21; Rosiade 7 5 2 15; Aubry 5 4 1 12; ASC 7 3 4 9; Yasika 6 2 4 6; Belio Midnight Borneo 3 1 2 3; AAS 3 0 3 0; Onic 5 0 5 0; Exodia 6 0 6 0.
  - On the page: an IPL section with both standings tables and the next 4 match days from the sheet. Standings = the last posted league table in padelhq/ipl.js (updatedDate) plus rows on the sheet's Results tab dated after it, scored in app.js (men: win 3, lose by one 1, else 0; women: win 3, lose 0). Sort: points, wins, fewer losses. When the league posts a new table, copy it into ipl.js and move updatedDate.
  - Landing page: wide PadelHQ card under the guides (index.html, a.hq styles), showing the top 3 of each table from padelhq/ipl.js (the posted table, not the sheet results).
  - Not built yet: results filled in automatically from live scores (SKOR has no public feed found).
- Other follow-ups: PadelHQ card on the landing page (not added: landing page layout is Vitto's call), accept the PBPI page link as Scoring ID instead of the number, tournament pages with draws.

## Left
- Vitto: on the Mac, sync the local source folders so publish.sh does not overwrite the live edits:
    cd ~/padelwithvitto && git pull
    cp padel-101/index.html ../padel-101/index.html
    cp shot-breaks/index.html ../padel-shot-breaks/index.html
    rsync -a road-to-pro/ ../padel-athlete-site/
- Vitto: check the live site by eye (cloud sessions cannot fetch github.io).
- Padel 101 phases 3-4.
- Guide 4 (topic not chosen).
- With a second batch of charted sets: re-test Guide 3 findings 3-5 (volley, overhead) and the "would break finding 1" check.

## Decisions
- Guide 3 design: PadelIQ direction A "Signature" (navy #002941, soft blue #B6DFED, coral #FD6E6E). Coral = errors and key numbers, soft blue = winners. Never white on coral.
- Guide 3 data: Indonesian Padel League, high Silver and up (about 4.0-6.5), 23 scored sets from 10 matches, 16-24 Oct 2026, 1,307 points. Everyone except Vitto anonymised; the website does not name João.
- No "forced error" box: a shot that forces a miss counts as a winner. Counting is set by set.
- Claims are worded "in this sample", never "always".
- Landing page: max two cards per row.
- Usage guard: state phase and size, wait for "go", one phase per run, update this file, commit. Merge to main only when Vitto says so.

## Files
- Repo: vittoalexander/padelwithvitto. Work on branch claude/determined-dirac-p8emgx, fast-forward main to publish. GitHub Pages serves main.
- Guide 3 and the landing page exist only in this repo. Padel 101, shot-breaks and Road to Pro also have local source folders on the Mac (~/padel-101, ~/padel-shot-breaks, ~/padel-athlete-site) that publish.sh copies over the repo.
- Sheets: Padel Benchmark Lab (findings), Padel Match Charting, Vitto's Padel Match Charting.

## Next step
- Vitto runs the four sync lines above, then says which is next: Padel 101 phase 3 or Guide 4.
