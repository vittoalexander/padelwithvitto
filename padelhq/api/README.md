# PadelHQ score API

A small go-between that reads live scores from each tournament's scoring platform and hands them to the PadelHQ page in one common shape.

| Platform | What PadelHQ does | Id to put in "Scoring ID" |
|---|---|---|
| PBPI (pbpi.or.id) | Live scores and order of play on PadelHQ, needs this API | Tournament number, e.g. `46` |
| Alfred for Padel | Live on PadelHQ, with or without this API | Last part of the tournament link, e.g. `padel-gp500` |
| Incourta, Recourt, SkorPad, PadelScore.id | Button to their live page | Not used yet |

## Files

- `../providers.js`: one adapter per platform. Shared by this API, the tests and the page.
- `worker.js`: the API itself (Cloudflare Worker). Routes: `/v1/live` (on court, just finished, next) and `/v1/schedule` (one day's order of play). Remembers live answers for 12 seconds and the order of play for 30, and keeps showing the last good answer for up to 15 minutes if a platform goes down.
- `dist/worker.bundle.js`: the API as one file, for pasting into the Cloudflare dashboard. Rebuild with `npx esbuild padelhq/api/worker.js --bundle --format=esm --outfile=padelhq/api/dist/worker.bundle.js` after changing `worker.js` or `providers.js`.
- `dev-server.mjs`: runs the API and the page on your computer.
- `test.mjs`: automated checks. No internet needed.

## Try it locally

```
node padelhq/api/dev-server.mjs
```

Then open `http://localhost:8788/?api=http://localhost:8787&demo=1`. Useful page options:

- `?demo=1` shows made-up matches that move every few seconds.
- `?scores=pbpi:43` shows any tournament on a supported platform (43 is Sirkuit Nasional Medan 2026).
- `?today=2026-11-19` shows the page as it will look on that day.
- `?builtin=1` uses the built-in tournament list instead of the Google Sheet.

Run the checks with `node --test padelhq/api/test.mjs`.

## Deploy

Either way you need a free Cloudflare account.

**With the command line:** from `padelhq/api`, run `npx wrangler deploy` and sign in when the browser opens.

**Without the command line:** in the Cloudflare dashboard go to Workers & Pages, Create, start from "Hello World", name it `padelhq-scores` and deploy. Then choose Edit code, replace everything with the contents of `dist/worker.bundle.js`, and Deploy.

Then copy the address (ends in `workers.dev`) into `apiBase` in `../config.js`.

Only the websites listed in `ALLOWED_ORIGINS` can read the API from a browser. The default list in `worker.js` already covers the live site.

## Add a platform

Add an adapter function in `../providers.js` that returns `{ live, recent, next }`, register it in `PROVIDERS` with `live: true` and an id pattern, and add a case in `getLive`. Add a hand-made sample answer and a check in `test.mjs`.

## Ground rules

- The API only calls the fixed platform addresses with a checked id. It cannot be used to fetch other pages.
- Only player names and scores are passed on. Sign-up details in a platform's raw data are dropped.
- Scores belong to the platforms. The page always names the platform and links to its own live page.
