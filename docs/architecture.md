# Architecture

See [`CLAUDE.md`](../CLAUDE.md) for the one-paragraph overview and the
architecture-at-a-glance diagram. This is the full breakdown: what each file owns, how a
title gets set, why titles live where they do, what the export format is, and which
browser APIs and permissions the extension relies on.

## File map

```
/
├── CHANGELOG.md        # Release history; add to [Unreleased] as you change things
├── manifest.json       # Extension manifest (v3)
├── background.js       # Background module: refreshes window titles on window/tab events
├── datastore.js        # DataStore + getDataStore() singleton
├── kitsune.js          # Vestigial stub, unused
├── popup/              # Browser action popup (set the current window's title)
├── manager/            # Manager page: windows/tabs tables, actions, export/import
├── icons/              # Extension logo and UI icons
├── logo/               # Logo source art
├── notes/              # Planning docs (1.0 scope, deferred todo list), not shipped
├── docs/               # Agent-facing topic docs (this directory), not shipped
├── tools/              # Local one-off scripts, not shipped
├── build.sh            # web-ext build; enforces tag == manifest version
└── sign.sh             # web-ext sign to AMO; same version check
```

## Core files

- **datastore.js** — the persistence layer. `DataStore` reads and writes a per-window
  `userWindowData` JSON blob (`{displayTitle}`) via
  `browser.sessions.{get,set}WindowValue`, and `refreshAppearanceForWindow()` pushes the
  stored title into the window chrome using
  `browser.windows.update(id, {titlePreface})`. Module-level `getDataStore()` returns a
  lazily-created singleton; every other file imports that rather than constructing a
  `DataStore` directly. (`setDataStore()` and the no-op `createDataStore()` are also
  exported, but nothing calls them.)
- **background.js** — the background module. Calls `refreshAppearanceForWindow()` on
  `windows.onCreated`, and again on `tabs.onActivated` because session values for a
  restored window are often not readable yet when `onCreated` fires.
- **popup/** — `popup.html` is a one-field form plus a header button that opens the
  manager in a new tab; `popup.js` loads the current title on open, saves on submit,
  and closes the popup.
- **manager/** — `manager.html` (markup plus all the page CSS) and `manager.js`, which is
  where nearly all the feature work lives. See *The manager page* below.
- **kitsune.js** — vestigial; a single `console.debug` line. Nothing imports it. The
  `DataStore` it once held now lives in `datastore.js`.
- **tools/** — local one-off scripts, not shipped. Today that is `merge_titles.py`, which
  turns a title dump from
  [webextension-window-titler](https://github.com/tpamula/webextension-window-titler)
  into a JS snippet you paste into Kitsune's console. It is a three-step manual
  procedure, documented in the script's own docstring.

## The manager page

Top to bottom: a header, a stats line (window count, total tabs, tabs in the current
window), an actions toolbar, the windows table, and a details pane for the selected
window.

- **Actions toolbar** (`#actions-toolbar`, above the windows list): Export Windows Data,
  Import Windows Data, Minimize All Windows, Unload All Tabs, Refresh Window Titles.
  Every one of these operates on "every window as it is right now", so they are all
  disabled for the duration of an import.
- **Windows table** — sortable by title, tabs or status. Titles are editable inline from
  the table. Per-window row actions: new tab, switch to window, unload all tabs, reload
  all tabs, close window.
- **Filter box** (`#window-filter`, above the table) — matches window titles, tab titles
  and tab URLs. A window listed only because of its contents carries an "N matching
  tabs" badge and has its matching tab rows highlighted in the details pane; the stats
  line reads "12 of 218" while a filter is active. Filtering is a synchronous re-render
  from the snapshot the last refresh computed (`renderWindowsList()`), so it costs no
  browser round trips.
- **Details pane** — a tab table for the selected window. Per-tab actions: pin, mute,
  switch to, unload, move to new window, move to an existing window (a dropdown),
  duplicate, reload, close. Checkboxes drive a bulk bar with "Close selected" and a
  move-to-window picker.
- **Refreshes** — every browser event that could change the window or tab list
  (`tabs.onUpdated/onCreated/onRemoved/onActivated/onMoved`,
  `windows.onCreated/onRemoved/onFocusChanged`) is funnelled through
  `scheduleRefresh()`, a debounce around `populateWindowsList()` whose interval is the
  named constant `REFRESH_DEBOUNCE_MS` (500ms). A refresh is suppressed outright while an
  import is running (an import fires `tabs.onCreated` once per tab) and while an inline
  title edit is open (a refresh calls `replaceChildren()` on the table body, which would
  tear out the edit along with whatever had been typed). `populateWindowsList()` reads
  every window's stored title with `Promise.all`, not in sequence, and the move-to
  dropdown reuses that snapshot rather than running a second `windows.getAll()`.
- Destructive actions (closing a window, unloading tabs, importing, bulk close) confirm
  first via `confirm()`.

## Data flow

Setting a title: popup form submit → `saveTitleForWindow(windowId, title)` →
`refreshAppearanceForWindow(windowId)` → `browser.windows.update` sets the titlePreface →
popup closes. The manager's inline title editing follows the same two-call sequence.

## Storage strategy

Titles live in `browser.sessions` window values, not `browser.storage`. That ties a title
to a specific window and lets it survive both a browser restart and a window
close-and-restore, without leaving orphaned records behind when a window is closed for
good. The tradeoff is that window IDs are not stable across sessions and a title is only
readable once the session data for that window has loaded — hence the second refresh on
`tabs.onActivated` in `background.js`.

## Export and import format

`kitsune-windows-<timestamp>.json`:
`{timestamp, windows: [{id, title, tabs: [{title, url}]}]}`. A window with no stored
title is exported with a `Window <id>` placeholder.

Import reopens each window with its tab URLs and restores the stored title, skipping
`Window <id>` placeholders. Specifics worth knowing before changing it:

- **Only URLs are captured** — not navigation history, scroll position, or form state,
  and that is a hard limit: Firefox exposes no extension API to restore a tab with its
  history intact. Don't scope work that assumes otherwise. (A sleep/wake feature was
  removed for this reason; tab unloading covers the resource-usage goal it was meant to
  serve.)
- **Older exports are accepted.** `windowsFromImportData()` falls back to the pre-removal
  `{openWindows, sleepingWindows}` shape and merges both arrays; the per-window and
  per-tab fields it reads are identical across the two shapes.
- **Tabs are created unloaded.** `tabs.create({discarded: true, title})` keeps a large
  import from loading thousands of pages at once — Firefox accepts `title` only
  alongside `discarded`. The one tab per window that cannot avoid loading is the seed tab
  `windows.create` opens. A URL that refuses to be created discarded is retried as a
  normal tab, and `LOADED_FALLBACK_LIMIT` (20) aborts the whole import if that keeps
  happening, rather than quietly loading everything.
- **Privileged URLs are skipped and counted**, not treated as errors: `chrome:`,
  `javascript:`, `data:`, `file:`, and every `about:` page except `about:blank`. Real
  exports are full of them (`about:home`, `about:newtab`). A window with nothing
  restorable is still created, so its title survives.
- **Import reports progress** on a status line and is non-re-entrant (`importing`), since
  two concurrent imports would interleave and the first to finish would clear the flag
  out from under the other. One window failing does not abandon the rest.

## Browser APIs used

- `browser.sessions` — per-window value storage (`getWindowValue` / `setWindowValue`)
- `browser.windows` — enumerate, focus, minimize, create, remove, and set `titlePreface`
- `browser.tabs` — enumerate, create, update (pin/mute/activate), move, duplicate,
  reload, discard, remove
- `browser.runtime.getURL` — in the snippet `tools/merge_titles.py` generates, not in the
  extension itself

## Permissions

Declared in `manifest.json`:

- `tabs` — tab titles/URLs and tab manipulation from the manager
- `sessions` — per-window persistent storage
- `activeTab` — access to the current tab. Nothing in the code needs it beyond what
  `tabs` already grants; `notes/todo.md` has dropping it as a hygiene item.
- `storage` — declared, but no code calls `browser.storage`; titles go to
  `browser.sessions` instead (see *Storage strategy*).

`browser_specific_settings.gecko` also declares `data_collection_permissions.required:
["none"]`, which AMO requires.
