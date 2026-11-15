# Handoff: padelwithvitto

Updated 15 Nov 2026.

## Done
- Back link "← padelwithvitto" added to the headers of padel-101, shot-breaks and road-to-pro (edited in this repo, branch claude/determined-dirac-p8emgx).
- Guide 3 phase 1 built at people-lose-it/index.html: skeleton, hero, chapters 00 (the count), 01 (the hard line), 02 (a bird in the hand), "still being built" list, data disclosure. Landing page has a "Guide 03 · In progress" card.
- Checked at 1280 px and 360 px: no script errors, no sideways scroll, figures end on 48/52, 20 of 20, +13/+12.

## Left
- Merge the branch into main so GitHub Pages shows it, then check live.
- Copy the three edited index.html files (padel-101, shot-breaks, road-to-pro) back into the local source folders. Otherwise the next publish.sh run overwrites the back link. Guide 3 and the landing page live only in this repo, so publish.sh leaves them alone.
- Guide 3 phase 2: chapters 03 (volley errors, 1 of 19) and 04 (overhead winners, 17 of 22, never behind the error line).
- Guide 3 phase 3: chapter 05 reverse stress test with an interactive "flip the set" slider, using Vitto's four sets (a Gold final and a Gold round of 16; partners and opponents anonymised), and chapter 06 method (name players consistently: left player left, right player right, your pair on top, opponents below; note serving vs returning; watch each point; tally the box). Method first, copyable sheet with simple rules second. Invite readers to improve it or build their own.
- Padel 101 phases 3-4.

## Guide 3 decisions
- One guide, for improvers who want numbers behind their next step. Few numbers, analogies with matching visuals.
- Theme: "nobody wins padel, people lose it" / "a bird in the hand". Reverse stress test is the closing idea.
- Design: PadelIQ direction A "Signature" (navy #002941, soft blue #B6DFED, coral #FD6E6E). Coral = errors and key numbers, soft blue = winners. Never white on coral.
- Data: Indonesian Padel League, high Silver and up (about 4.0-6.5), 23 scored sets, 16-24 Oct 2026, 1,307 points. Everyone except Vitto anonymised. Be open about what is in the data, in the spirit of a CFA performance presentation.
- No "forced error" box: a shot that forces a miss counts as a winner. Shot list is incomplete (wall exits, counter-smashes filed under FH/BH/volley/smash). Vitto is happy to say his calls are sometimes wrong.

## Usage guard
State phase and size, wait for "go", one phase per run, update this file, commit.
