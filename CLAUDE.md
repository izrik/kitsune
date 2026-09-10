# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kitsune is a Firefox extension (manifest v3) for managing tabs and windows. Its two
surfaces are:

- A **browser action popup** for naming the current window. The name is shown in the
  OS window title bar as a `[name] ` prefix, which makes many open windows
  distinguishable in the window list, taskbar, and alt-tab switcher.
- A **manager page** (a full tab) listing every open window and its tabs, with per-window
  and per-tab actions plus JSON export/import.

Published at https://addons.mozilla.org/en-US/firefox/addon/kitsune2/

## Architecture

### Core files

- **datastore.js** — the persistence layer. `DataStore` reads and writes a per-window
  `userWindowData` JSON blob via `browser.sessions.{get,set}WindowValue`, and
  `refreshAppearanceForWindow()` pushes the stored title into the window chrome using
  `browser.windows.update(id, {titlePreface})`. Module-level `getDataStore()` returns a
  lazily-created singleton; every other file imports that rather than constructing a
  `DataStore` directly.
- **background.js** — the background module. Calls `refreshAppearanceForWindow()` on
  `windows.onCreated`, and again on `tabs.onActivated` because session values for a
  restored window are often not readable yet when `onCreated` fires.
- **popup/** — `popup.html` is a one-field form plus a header button that opens the
  manager in a new tab; `popup.js` loads the current title on open, saves on submit,
  and closes the popup.
- **manager/** — `manager.html` (markup plus all the page CSS) and `manager.js`, which is
  where nearly all the feature work lives. It renders a sortable windows table
  (title / tabs / status), a detail pane for the selected window with a tab table, and a
  bottom toolbar (Export, Import, Minimize All Windows, Unload All Tabs, Refresh Window
  Titles). Window titles are editable inline from the table. Per-tab actions: pin, mute,
  switch to, unload, move to new window, move to an existing window, duplicate, reload,
  close; checkboxes drive a bulk close/move bar. All browser events that could change the
  window or tab list are funneled through `scheduleRefresh()`, a 200ms debounce around
  `populateWindowsList()`.
- **kitsune.js** — vestigial; a single `console.debug` line. Nothing imports it. The
  `DataStore` it once held now lives in `datastore.js`.
- **tools/** — one-off local scripts (bulk title import, title merging), not shipped.

### Data flow

Setting a title: popup form submit → `saveTitleForWindow(windowId, title)` →
`refreshAppearanceForWindow(windowId)` → `browser.windows.update` sets the titlePreface →
popup closes. The manager's inline title editing follows the same two-call sequence.

### Storage strategy

Titles live in `browser.sessions` window values, not `browser.storage`. That ties a title
to a specific window and lets it survive both a browser restart and a window
close-and-restore, without leaving orphaned records behind when a window is closed for
good. The tradeoff is that window IDs are not stable across sessions and a title is only
readable once the session data for that window has loaded — hence the second refresh on
`tabs.onActivated` in `background.js`.

### Export format

`kitsune-windows-<timestamp>.json`: `{timestamp, windows: [{id, title, tabs: [{title, url}]}]}`.
Import reopens each window with its tab URLs and restores the stored title, skipping
`Window <id>` fallback titles. Only URLs are captured — not navigation history, scroll
position, or form state, and that is a hard limit: Firefox exposes no extension API to
restore a tab with its history intact. Don't scope work that assumes otherwise. (A
sleep/wake feature was removed for this reason; tab unloading covers the resource-usage
goal it was meant to serve.)

## Conventions

- Vanilla JS, ES modules, no framework, no bundler, no build step for the extension code.
- DOM is built imperatively with `createElement` / `textContent` / `replaceChildren`.
  Avoid `innerHTML` — tab titles and URLs are untrusted input.
- Intra-extension imports and asset paths are root-absolute (`/datastore.js`,
  `/icons/close.png`), so they resolve the same from the popup and the manager.
- Liberal `console.debug` tracing, typically naming the function and its arguments.
- Icons are Material Symbols PNGs in `icons/`; the extension's own logo is
  `icons/kitsune_thick.svg` (plus a white variant for dark themes).
- Destructive actions (closing a window, unloading tabs, importing, bulk close) confirm
  first via `confirm()`.

## Development

### Loading the extension

1. Navigate to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `manifest.json` from the project directory

Reload from the same page after changes. The background script and the manager page each
have their own console.

### Testing

Manual only — there is no automated test suite. Exercise changes with several windows
open, at least one of them titled, and check that titles survive a browser restart.

### Building and signing

`build.sh` (produces `web-ext-artifacts/kitsune-<version>.zip`) and `sign.sh` (submits to
AMO on the unlisted channel) both **require the current commit to carry a tag whose name
matches `manifest.json`'s version** — `v0.4` for version `0.4` — and exit with an error
otherwise. So a release is: bump `manifest.json`, commit, `git tag vX.Y`, then build/sign.
Both need `web-ext` and `jq`; `sign.sh` also needs `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`.

Both scripts exclude local scratch (`*.sh`, `*.py`, `instance/`, `notes.md`, `tools/`,
`CLAUDE.md`, exported JSON) from the package. Several of those files are untracked working
files kept deliberately out of git.

## File structure

```
/
├── manifest.json       # Extension manifest (v3)
├── background.js       # Background module: refreshes window titles on window/tab events
├── datastore.js        # DataStore + getDataStore() singleton
├── kitsune.js          # Vestigial stub, unused
├── popup/              # Browser action popup (set the current window's title)
├── manager/            # Manager page: windows/tabs tables, actions, export/import
├── icons/              # Extension logo and UI icons
├── logo/               # Logo source art
├── tools/              # Local one-off scripts, not shipped
├── build.sh            # web-ext build; enforces tag == manifest version
└── sign.sh             # web-ext sign to AMO; same version check
```

## Browser APIs used

- `browser.sessions` — per-window value storage (`getWindowValue` / `setWindowValue`)
- `browser.windows` — enumerate, focus, minimize, create, remove, and set `titlePreface`
- `browser.tabs` — enumerate, create, update (pin/mute/activate), move, duplicate,
  reload, discard, remove
- `browser.runtime.getURL` — used by the scripts in `tools/`

## Permissions

- `activeTab` — access to the current tab
- `sessions` — per-window persistent storage
- `storage` — extension storage
- `tabs` — tab titles/URLs and tab manipulation from the manager
