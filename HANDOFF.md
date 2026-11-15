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
