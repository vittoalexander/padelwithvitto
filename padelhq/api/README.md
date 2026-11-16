# PadelHQ score API

A small go-between that reads live scores from each tournament's scoring platform and hands them to the PadelHQ page in one common shape.

| Platform | What PadelHQ does | Id to put in "Scoring ID" |
|---|---|---|
| PBPI (pbpi.or.id) | Live on PadelHQ, needs this API | Tournament number, e.g. `46` |
| Alfred for Padel | Live on PadelHQ, with or without this API | Last part of the tournament link, e.g. `padel-gp500` |
| Incourta, Recourt, SkorPad, PadelScore.id | Button to their live page | Not used yet |

## Files

- `../providers.js`: one adapter per platform. Shared by this API, the tests and the page.
- `worker.js`: the API itself (Cloudflare Worker). Remembers each answer for 12 seconds, and keeps showing the last good answer for up to 15 minutes if a platform goes down.
- `dev-server.mjs`: runs the API and the page on your computer.
- `test.mjs`: automated checks. No internet needed.

## Try it locally

```
node padelhq/api/dev-server.mjs
```

Then open `http://localhost:8788/?api=http://localhost:8787&demo=1`. Useful page options:

- `?demo=1` shows made-up matches that move every few seconds.
- `?scores=pbpi:43` shows any tournament on a supported platform (43 is Sirkuit Nasional Medan 2026).

Run the checks with `node --test padelhq/api/test.mjs`.

## Deploy

1. Create a free Cloudflare account.
2. From `padelhq/api`, run `npx wrangler deploy` and sign in when asked.
3. Copy the address it prints (ends in `workers.dev`) into `apiBase` in `../config.js`.

Only the websites listed in `ALLOWED_ORIGINS` (in `wrangler.toml`) can read the API from a browser.

## Add a platform

Add an adapter function in `../providers.js` that returns `{ live, recent, next }`, register it in `PROVIDERS` with `live: true` and an id pattern, and add a case in `getLive`. Add a hand-made sample answer and a check in `test.mjs`.

## Ground rules

- The API only calls the fixed platform addresses with a checked id. It cannot be used to fetch other pages.
- Only player names and scores are passed on. Sign-up details in a platform's raw data are dropped.
- Scores belong to the platforms. The page always names the platform and links to its own live page.
