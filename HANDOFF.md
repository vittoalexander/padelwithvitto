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
- padelhq/: index.html, style.css, app.js, events.js. Lives only in this repo, so publish.sh leaves it alone. No build step.
- What it does: month calendar (Monday first, Indonesia time), "Live now / Next up" strip, event cards with Register / Scores / Watch / Details buttons, and a "Dates to be confirmed" list for events without dates.
- Data: events.js is the built-in list. Set SHEET_CSV_URL in app.js to read a Google Sheet instead (header row needs Name and Start date; title rows above it are skipped; falls back to events.js if the sheet fails).
- Design: charcoal #0D1012, ball green #C8F53C (Tier 1, live, main action), tosca #2FD6C3 (secondary), amber #FFB454 (deadlines, unconfirmed). Barlow Condensed headings, Barlow body, DM Mono labels.
- Seed data: only Sirkuit Nasional Bali (19-22 Nov, Monster Padel Bali) is confirmed by Vitto. The rest came from web search because Instagram and pbpi.or.id are blocked in the cloud session; they are marked "unconfirmed".
- Next: create the Google Sheet (plan shown to Vitto, waiting for approval), link PadelHQ from the landing page, merge to main, then Phase 2 (tournament pages, draws, order of play).

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
