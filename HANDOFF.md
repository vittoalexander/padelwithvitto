# Handoff: padelwithvitto

Updated 15 Nov 2026.

## Done
- Back link "← padelwithvitto" on padel-101, shot-breaks and road-to-pro. Live on main.
- Guide 3 phases 1-2 (hero, chapters 00-04, data disclosure, landing card). Live on main at 81b50b8.
- Guide 3 phase 3, on branch claude/determined-dirac-p8emgx only (not merged):
  - Chapter 05 reverse stress test: Vitto's four sets (Padel Pro Gold final, Gold round of 16) and an interactive "Flip the set" tool with a "Your set" mode.
  - Chapter 06 method: five steps plus an animated charting grid (twelve made-up points).
  - "The whole guide in six lines" recap and "Three things to take on court" call to action.
  - "Still being built" section and the "In progress" label removed.
  - Animations retimed: scroll sets a target and each figure eases toward it at a capped speed (about 3 s minimum for a full play); items fade and slide instead of popping; on phones the figure pins under the header while its story plays. Pause motion shows every figure complete.
- Tested at 1280, 1040, 390 and 360 px: no script errors, no sideways scroll, end states 48/52, 23 sets, +13/+12, 1/18, 17/5, 2/6; flip tool verdicts checked for all presets and the custom mode.

## Left
- Merge phase 3 into main when Vitto says so. The live URL cannot be fetched from the cloud session (proxy blocks github.io), so Vitto checks it by eye.
- Copy the three edited index.html files (padel-101, shot-breaks, road-to-pro) back into the local source folders. Otherwise the next publish.sh run overwrites the back link. Guide 3 and the landing page live only in this repo, so publish.sh leaves them alone.
- Optional: a copyable charting sheet for chapter 06. Needs Vitto to share a public template sheet; the guide currently teaches the pen-and-grid method only.
- Padel 101 phases 3-4.

## Guide 3 decisions
- One guide, for improvers who want numbers behind their next step. Few numbers, analogies with matching visuals.
- Theme: "nobody wins padel, people lose it" / "a bird in the hand". Reverse stress test is the closing idea.
- Design: PadelIQ direction A "Signature" (navy #002941, soft blue #B6DFED, coral #FD6E6E). Coral = errors and key numbers, soft blue = winners. Never white on coral.
- Data: Indonesian Padel League, high Silver and up (about 4.0-6.5), 23 scored sets, 16-24 Oct 2026, 1,307 points. Everyone except Vitto anonymised. Be open about what is in the data, in the spirit of a CFA performance presentation.
- No "forced error" box: a shot that forces a miss counts as a winner. Shot list is incomplete (wall exits, counter-smashes filed under FH/BH/volley/smash). Vitto is happy to say his calls are sometimes wrong.

## Usage guard
State phase and size, wait for "go", one phase per run, update this file, commit.
