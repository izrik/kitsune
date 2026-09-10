# v1.0 features

Scope for the 1.0 release. Everything in this file is a blocker; anything that can
ship later lives in `todo.md`.

The premise of 1.0 is not new surface area — it is that the manager actually works at
the size it is used at. The most recent export in `instance/` holds **201 windows and
3,190 tabs**, and `tools/import.js` restores **189 window titles** by hand. Features
that are fine with five windows fall over at two hundred.

## 1. Import cannot read older export files

The importer added in `69dea40` requires a top-level `windows` array:

```js
if (!Array.isArray(data.windows)) {
    alert('Invalid import file: missing windows array.');
```

Every export currently saved in `instance/` uses the older shape instead —
`{timestamp, openWindows, sleepingWindows}` — from when the sleep/wake feature still
existed. So all existing backups fail to import.

**Fix:** accept the old keys as a fallback, merging `openWindows` and
`sleepingWindows` (the sleep/wake distinction is dead, but the window data under it is
still worth recovering). Per-window and per-tab fields are unchanged between formats:
windows carry `{id, title, state, tabs}`, tabs carry `{title, url}`.

**Done when:** every file in `instance/` imports without an error, and a current-format
export still imports.

## 2. Import does not survive a large file

`importWindowsData()` creates every window and every tab eagerly and serially:

```js
const newWindow = await browser.windows.create({url: urls[0]});
for (let i = 1; i < urls.length; i++) {
    await browser.tabs.create({windowId: newWindow.id, url: urls[i]});
}
```

Importing the 201-window backup means opening 3,190 live pages at once.

**Fix:** create tabs lazily so they start discarded rather than loading. Verify what
Firefox actually supports on `tabs.create` (`discarded`, and whether `title` must be
supplied alongside it) before settling on an approach — if lazy creation is not
available, fall back to batching with a progress indicator.

**Done when:** the 201-window backup imports without saturating the browser, and the
confirm dialog warns when the file is large.

## 3. The manager's refresh does not scale

`populateWindowsList()` awaits one `sessions.getWindowValue` per window, in sequence:

```js
for (const window of windows) {
    const storedTitle = await dataStore.getTitleForWindow(window.id);
```

That is 201 sequential round trips per refresh. The refresh is bound to
`tabs.onUpdated`, `onCreated`, `onRemoved`, `onActivated` and `onMoved` plus three
window events, behind a 200ms debounce — and with 3,190 tabs open those events fire
more or less continuously. Selecting a window makes it worse: `showWindowInfo()` runs
another `windows.getAll()` plus a title lookup per window to build the move-to
dropdown.

**Fix:** parallelize the title reads with `Promise.all`, raise the debounce, and cache
the move-to dropdown options rather than rebuilding them on every refresh.

**Done when:** the manager stays responsive with a few hundred windows open.

## 4. No way to find a window

There is no search or filter. 201 windows render into a table capped at
`max-height: 260px`, so finding one means scrolling a very small viewport.

The titles in `tools/import.js` show this being worked around by hand already — the
`0 ` and `lab1 - ` prefixes are manual grouping standing in for a filter.

**Fix:** a filter box above the windows table matching on window title, and ideally on
tab titles and URLs within each window.

**Done when:** typing narrows the table live, and matching a tab reveals the window
that holds it.
