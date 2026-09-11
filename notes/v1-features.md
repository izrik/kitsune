# v1.0 features

Scope for the 1.0 release. Everything in this file is a blocker; anything that can
ship later lives in `todo.md`.

**Status:** all four are done. What remains before tagging 1.0 is a version bump
and the release chores in `todo.md`.

The premise of 1.0 is not new surface area — it is that the manager actually works at
the size it is used at. The most recent export in `instance/` holds **201 windows and
3,190 tabs**, and `tools/import.js` restores **189 window titles** by hand. Features
that are fine with five windows fall over at two hundred.

## 1. Import cannot read older export files — DONE (`d86f0e8`)

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

**Outcome:** `windowsFromImportData()` falls back to the legacy keys, merging both
arrays. Verified against all four files on disk (2, 2, 218 and 201 windows). One of
them holds a sleeping window that an `openWindows`-only fallback would have dropped.

## 2. Import does not survive a large file — DONE (`93f48df`)

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

**Outcome:** tabs are created with `discarded: true` (Firefox allows `title` only
alongside it, which keeps the tab strip readable), so only one tab per window loads —
`windows.create` always loads what it opens, so that is the floor. A safety valve
aborts if discarding fails repeatedly, rather than falling back to loading everything.

Two things turned up that were not in the original plan. Firefox rejects privileged
URLs — `chrome:`, `javascript:`, `data:`, `file:`, and every `about:` page except
`about:blank` — and the first tab of a window goes through `windows.create`, so a
window starting on `about:home` aborted the whole import. Those URLs are now
classified up front, skipped, and counted; 485 of the 3,220 tabs in the largest backup
are unrestorable, and 36 windows have nothing restorable at all (they are still
created, so their titles survive). Separately, the action buttons are disabled during
an import and re-entry is blocked, because two concurrent imports would interleave and
the first to finish would clear the `importing` flag out from under the other.

Confirmed working on a real import of the large file.

## 3. The manager's refresh does not scale — DONE (`3aa2605`)

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

**Outcome:** titles are fetched with `Promise.all`, the move-to dropdown reuses the
snapshot the list just computed rather than running a second `windows.getAll()` plus a
read per window, and the debounce is a named 500ms constant. A refresh with a window
selected goes from roughly 2N sequential IPC calls to N concurrent ones.

This also turned up a bug the old refresh rate was aggravating rather than causing: a
refresh calls `replaceChildren()` on the table body, which tore out an in-progress
inline title edit and silently dropped what had been typed. Refreshes are now
suppressed while an edit is open.

## 4. No way to find a window — DONE

There is no search or filter. 201 windows render into a table capped at
`max-height: 260px`, so finding one means scrolling a very small viewport.

The titles in `tools/import.js` show this being worked around by hand already — the
`0 ` and `lab1 - ` prefixes are manual grouping standing in for a filter.

**Fix:** a filter box above the windows table matching on window title, and ideally on
tab titles and URLs within each window.

**Done when:** typing narrows the table live, and matching a tab reveals the window
that holds it.

**Outcome:** `populateWindowsList()` is split into a fetching half and a synchronous
`renderWindowsList()` that works from the cached snapshot, so filtering re-renders
without a single browser round trip. Matching is on window title, tab title and tab
URL; a window listed only because of its contents carries a "3 matching tabs" badge and
its matching tab rows are highlighted in the details pane.

Against the largest backup: `lab1` matches 10 of 218 windows (all by title),
`metaindu` 39 (24 of them by tab contents only), and `kubernetes` 11 — of which only
one is named for it, so ten were previously unfindable.

Not yet exercised in the browser.
