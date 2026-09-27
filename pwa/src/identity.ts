// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's identity — name, copy, colors, URLs — in one module. Imported by
// the browser app AND by the build plumbing (pwa-plugin.ts, the icon
// generator), so a rename or a palette change happens here once.
// Keep this file free of browser- and Node-only imports.

export const APP_NAME = "Sea Haven";
/** The house, on the studio card the app will open on. Drawn upper-cased, so
 * write it however it is written everywhere else. */
export const PUBLISHER = "Agilator Games";
/** What the browser tab and the installed app are called. Just the name: a
 * tab shows about thirty characters before it cuts, so a tagline bolted on
 * after a dash is a tagline nobody finishes reading. The share card is a
 * different surface with room for one, and keeps its own. */
export const APP_TITLE = APP_NAME;
/** The home-screen name: a launcher gives it about twelve characters before
 * it starts cutting, and this is eight. Both words survive, run together so
 * the launcher never breaks them onto two lines. */
export const APP_SHORT_NAME = "SeaHaven";
export const APP_DESCRIPTION =
  "A personal-watercraft racing game that runs in your browser. Ride a jet ski " +
  "along generated northern shores through buoy gates and airborne rings, on water " +
  "built from real wave physics — on your phone or desktop, offline once loaded. " +
  "No account, no download.";
export const SITE_URL = "https://game3.niclaslindstedt.se";
/** Where the source lives — on the website, the HUD's build label and the
 * menu's version link a build's commit here, so the running app can always say
 * exactly what it is. The browser code never imports it: it reads
 * `__SOURCE_URL__`, which a packaged build (`VITE_SHELL_BUILD=on`) leaves
 * empty, so the label prints plain and the URL is not in its bundle. */
export const REPO_URL = "https://github.com/niclaslindstedt/game3";
/** The game's page on the publisher's app site, which carries its privacy
 * policy (`privacy/`) and support page (`support/`). It is where the store
 * listing and the packaged apps send a player: a phone or desktop build names
 * neither the website above nor the source, and its bundle scripts refuse one
 * that does (`scripts/lib/no-source.mjs`). The website keeps both. */
export const APPS_PAGE_URL = "https://apps.agilator.se/sea-haven/";

/** A northern sea: deep teal water under a pale sky, granite and pine along
 * the shore, sand in the pockets, foam on the crests and an orange buoy to
 * aim at. */
export const PALETTE = {
  /** Brand + boot background: the water. */
  sea: "#1b6f8a",
  seaDeep: "#0b3d4f",
  seaShallow: "#3fa7b8",
  sky: "#d7e9f0",
  skyHigh: "#9cc6d8",
  granite: "#8d9298",
  graniteDark: "#5f656c",
  pine: "#274d33",
  pineDark: "#1a3524",
  sand: "#c9a86a",
  foam: "#f2f7f8",
  buoy: "#f28c28",
  hudInk: "#ffffff",
  hudShadow: "#082a38",
  hudBad: "#ff5a4e",
} as const;
