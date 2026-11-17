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
- Score API: padelhq/api/worker.js (Cloudflare Worker). Routes /v1/live and /v1/schedule. 12 s memory for live, 30 s for the order of play, last good answer for 15 min if a platform is down, browser access limited to vittoalexander.github.io and localhost. NOT DEPLOYED YET: the Cloudflare token saved in the "padelwithvitto" cloud environment is rejected by Cloudflare as badly formatted (twice). Until it is deployed, PBPI events show a button to PBPI's page instead of a scoreboard. To deploy: a valid token (template "Edit Cloudflare Workers"), or paste padelhq/api/dist/worker.bundle.js into a new Worker in the Cloudflare dashboard. Then put the workers.dev address in config.js -> apiBase and add that host to the cloud environment to test it. See padelhq/api/README.md.
- Still to verify once deployed: that PBPI answers requests coming from Cloudflare, that the Worker's cache works on workers.dev, and Alfred's large answers within the free plan's limits. Free plan allows 100,000 requests a day (about 550 viewer-hours of live watching).
- Not yet seen with a real match in progress: PBPI's live fields (points, server) and Alfred's in-progress set were taken from each platform's page code. Check on the first live day (19 Nov for PBPI, 21 Nov for Alfred).
- Testing: node --test padelhq/api/test.mjs (11 checks). node padelhq/api/dev-server.mjs, then http://localhost:8788/?api=http://localhost:8787 plus &demo=1, &scores=pbpi:43 or &today=2026-11-19. ?builtin=1 skips the sheet.
- Cloud environment "padelwithvitto" allows the provider sites, pbpi.or.id, instagram.com, docs.google.com and vittoalexander.github.io.
- Design: charcoal #0D1012, ball green #C8F53C (Tier 1, live, main action), tosca #2FD6C3 (secondary), amber #FFB454 (deadlines, unconfirmed). Barlow Condensed headings, Barlow body, DM Mono labels and scores.
- Next scope (Vitto, 17 Nov): Indonesian Padel League matches, from 24 Nov to late January, line-ups submitted on match day. Source post: instagram.com/p/Dd0jhzJE9m7 (cannot be read from the cloud session: needs the schedule as text or screenshots, and which platform keeps the score).
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
