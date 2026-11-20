/* PadelHQ settings. The only file to touch when connecting the score API or the Google Sheet. */
window.PADELHQ_CONFIG = {
  // Address of the PadelHQ score API (the Cloudflare Worker in api/). Leave "" until it is deployed.
  // Example: "https://padelhq-scores.your-name.workers.dev"
  apiBase: "https://padelhq-scores.vittoalexander13.workers.dev",

  // Google Sheet with the tournament list ("PadelHQ Events", tab "Events", table starting at B5), read as CSV.
  // Leave "" to use the built-in list in events.js. If the sheet cannot be read, the page falls back to
  // the last copy it saw, then to events.js.
  // League results ("Results" tab of the same sheet). Added to the standings in ipl.js and scored with the league's points rules.
  iplResultsCsvUrl: "https://docs.google.com/spreadsheets/d/1xUILyClgipeGOEVEWOLCm000M0gOBawmiSwXOFHrbYg/gviz/tq?tqx=out:csv&sheet=Results&range=B5:I&headers=1",

  // League standings and results read live from SKOR (the league's scoring partner) through the score API.
  iplSkorId: "ipl",

  // Order of play typed in by hand ("Matches" tab), used when a scoring platform publishes nothing, plus YouTube links per court.
  matchesCsvUrl: "https://docs.google.com/spreadsheets/d/1xUILyClgipeGOEVEWOLCm000M0gOBawmiSwXOFHrbYg/gviz/tq?tqx=out:csv&sheet=Matches&range=B5:L&headers=1",

  sheetCsvUrl: "https://docs.google.com/spreadsheets/d/1xUILyClgipeGOEVEWOLCm000M0gOBawmiSwXOFHrbYg/gviz/tq?tqx=out:csv&sheet=Events&range=B5:T&headers=1"
};
