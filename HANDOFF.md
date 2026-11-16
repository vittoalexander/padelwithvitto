# Handoff: padelwithvitto

Updated 16 Nov 2026.

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
