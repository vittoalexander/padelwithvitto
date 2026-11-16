/* PadelHQ settings. The only file to touch when connecting the score API or the Google Sheet. */
window.PADELHQ_CONFIG = {
  // Address of the PadelHQ score API (the Cloudflare Worker in api/). Leave "" until it is deployed.
  // Example: "https://padelhq-scores.your-name.workers.dev"
  apiBase: "",

  // Google Sheet with the tournament list, as a CSV link. Leave "" to use the built-in list in events.js.
  // Example: "https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:csv&sheet=Events"
  sheetCsvUrl: ""
};
