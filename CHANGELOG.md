# Changelog

All notable changes to Kitsune are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

Windows and tabs can come back in as well as go out: the manager grows an import,
and then grows up enough to survive one. The work is aimed at the size the
extension is actually used at — a few hundred windows and a few thousand tabs —
where a filter box is the only way to find anything and a refresh that costs one
session read per window is the thing making the page feel broken.

### Added

- **Import Windows Data** (#18). The manager reads a Kitsune export file back and
  reopens every window in it with its tabs and its stored title, so an export is
  now a backup rather than a one-way record. It confirms first with a count of
  windows and tabs, skips `Window <id>` fallback titles, and reports progress on a
  status line, because restoring a large file is a minutes-long operation. Only
  URLs are restored — not navigation history, scroll position or form state, which
  no Firefox extension API exposes.
- **A filter box over windows and tabs** (#18). Matches window titles, tab titles
  and tab URLs, so finding one window among hundreds no longer means scrolling a
  table. A window listed only because of what it contains carries an "N matching
  tabs" badge and has its matching rows highlighted in the details pane; the stats
  line reads "12 of 218" while a filter is active, Escape clears the box without
  closing the open details pane, and an empty state says so when nothing matches.
- **Move a tab to an already-open window** (#18). Each tab row gets a compact
  "Move to..." dropdown listing the other open windows; picking one moves the tab
  immediately. Hidden when only one window is open. Previously a tab could only be
  moved out to a brand-new window.
- **This changelog** (#19), with the four tagged releases reconstructed from their
  release notes and the git history.
- **`CLAUDE.md` describes the extension as it is**, rather than as it was around
  v0.1, and `notes/` records what is in scope for 1.0 and what has been deferred
  past it (#18).

### Changed

- **Import opens tabs unloaded** (#18). Tabs are created discarded, so restoring a
  218-window, 3,220-tab backup leaves one loaded page per window instead of
  opening 3,220 at once. Tab titles survive the wait, and URLs Firefox refuses to
  open in an extension-created tab (`chrome:`, `javascript:`, `data:`, `file:` and
  every `about:` page but `about:blank`) are now identified up front, skipped and
  counted rather than aborting the run; a window left with nothing restorable is
  still created so its title comes back.
- **The manager's action buttons are disabled while an import runs** (#18).
  Minimize All, Unload All, Export and Import itself all act on "every window as
  it is right now", which is not a stable idea while windows are being created —
  Unload All's confirmation dialog stalled the import outright, and a second
  import interleaved with the first. The per-window and per-tab buttons stay
  live: the table is frozen during an import, so every row it shows is a window
  that still exists.
- **The Actions row sits above the Windows list** (#18), so selecting a window
  with many tabs no longer pushes the action buttons down the page.

### Fixed

- **Exports made before v0.3 can be imported** (#18). Those files split windows
  into `openWindows` and `sleepingWindows` rather than a single `windows` array,
  and import rejected them. Both shapes are now read, with the two arrays merged.
- **The manager stays responsive with hundreds of windows open** (#18). A refresh
  read one session value per window in sequence, and selecting a window did it
  again to label the move-to dropdown — roughly 2N round trips, repeated on every
  tab event. Titles are now fetched in parallel and the dropdown reuses the
  snapshot the list just built.
- **An in-progress inline title edit is no longer thrown away** (#18) by a
  background refresh redrawing the table under it.
- **The published extension reports the version it was released as** (#17).
  `manifest.json` still said `0.3` when `v0.4` was tagged. `build.sh` and
  `sign.sh` now refuse to run unless the current commit carries a tag matching
  the manifest version, so the two cannot drift again.

## [v0.4] - 2026-04-21

A visual pass over both surfaces. The popup and the manager get a shared navy
palette and the fox logo, window titles become editable where they are listed, and
the state of a window or tab is readable at a glance instead of spelled out in a
cell.

### Added

- **Window titles are editable from the manager's table.** Click a title to edit
  it in place; Enter saves, Escape cancels, and a faint edit icon appears on row
  hover so the affordance is findable. Setting a title no longer means opening the
  popup in that window.
- **A white toolbar icon for dark themes**, so the browser action is visible
  against a dark toolbar.
- **A close button and Escape to dismiss the window details pane**, plus a
  placeholder in its place when no window is selected.

### Changed

- **The popup and manager share one design** (#16): dark navy header bar carrying
  the fox logo, a serif brand name, and consistently styled tables, buttons and
  detail panels. Page titles lost the "pop-up page" artifact.
- **Window and tab state reads as badges rather than text.** Current/Open status
  badges, a pill badge for the tab count, and a green/grey dot for whether a tab
  is loaded. An unloaded tab's title and URL are dimmed while its action buttons
  stay at full strength, so the row is still usable.
- **The browser action's tooltip says "Open Manager"**, and its icon is a
  window-select glyph rather than a settings gear.

### Fixed

- **The switch-to-window and switch-to-tab buttons show their icons** (#14).
  Their icon was excluded from the packaged extension, so in v0.3 both buttons
  shipped blank. The logo art is now packaged too.

## [v0.3] - 2026-04-20

Manifest v3, and the manager turns into somewhere to act from rather than just
look at: nearly every window and tab operation Firefox exposes is now a button in
the table, the page keeps itself up to date as the browser changes, and window
titles survive a session restore.

### Added

- **Per-window actions in the manager table** (#11): switch to the window, open a
  new tab in it, unload all its tabs, reload all its tabs, and close it.
- **Per-tab actions in the window details pane** (#11): switch to the tab,
  pin/unpin, mute/unmute, move to a new window, duplicate (placed next to the
  original), unload, reload and close.
- **Bulk close and move for selected tabs** (#12). Checkboxes on the tab rows
  drive a bar that closes the selection or moves it into another window; closing
  confirms first.
- **The manager refreshes itself when the browser changes** (#11), debounced, so
  it no longer shows a stale picture after windows and tabs are opened or closed
  elsewhere.
- **A "Refresh Window Titles" button**, which reapplies every stored title to its
  window.
- **Tab favicons, a highlight on the selected window's row, and the details pane
  scrolling itself into view** when a window is selected (#11).

### Changed

- **Upgraded to manifest v3** (#10). The extension now registers a background
  script module rather than a service worker, which is what Firefox supports.
- **The export file holds a single `windows` array.** It previously had separate
  `openWindows` and `sleepingWindows` keys. Files written by v0.1 and v0.2 are in
  the older shape; nothing in v0.3 or v0.4 reads them back.

### Fixed

- **Window titles come back after a browser or session restore** (#10). The title
  is reapplied when a window is created and again when one of its tabs is
  activated, because a restored window's stored session values are frequently not
  readable yet at creation time.
- **A window with an empty or whitespace-only title no longer gets a bare `[] `
  prefix** in the OS title bar.

## [v0.2] - 2026-04-11

The manager becomes a table, with a detail pane per window and a row per tab —
and, since the whole point of seeing a thousand tabs is doing something about
them, the ability to unload them one at a time, a window at a time, or all at
once.

### Added

- **A sortable windows table** (#3) in place of the manager's window list, with
  title, tab count and status columns, and a detail pane that opens on a row
  click.
- **A tab table in the window details pane** (#6, #7), one row per tab, showing
  whether each tab is still loaded.
- **Unloading tabs** (#6, #7): per tab, all of a window's background tabs, or
  every background tab in every window.
- **A new SVG extension icon with a dark-mode variant** (#5).
- **Distribution through addons.mozilla.org.** `sign.sh` builds and submits the
  extension to AMO, which is how it reaches users.
- **A migration script for webextension-window-titler users** (#4):
  `tools/merge_titles.py` carries window titles over from that extension.

### Fixed

- **The tabs table lays out correctly** — long URLs wrap and the columns are
  sized to their contents.
- **Action buttons in the windows table no longer stack vertically.**

## [v0.1] - 2026-04-09

First release: name your windows so you can tell them apart, and see all of them
in one place.

### Added

- **A browser action popup that names the current window.** The name shows up in
  the OS window title bar as a `[name] ` prefix, which makes a dozen open windows
  distinguishable in the taskbar, the window list and the alt-tab switcher.
- **A window manager page** listing every open window with its tab count, plus a
  details readout for a selected window.
- **A "Minimize All Windows" button.**
- **Export to JSON** — every open window with its title and its tabs' titles and
  URLs, downloaded as `kitsune-windows-<timestamp>.json`.
- **Titles persist across a browser restart.** They are stored as per-window
  values in `browser.sessions`, which ties a title to its window and leaves
  nothing behind when the window is closed for good.

[Unreleased]: https://github.com/izrik/kitsune/compare/v0.4...HEAD
[v0.4]: https://github.com/izrik/kitsune/compare/v0.3...v0.4
[v0.3]: https://github.com/izrik/kitsune/compare/v0.2...v0.3
[v0.2]: https://github.com/izrik/kitsune/compare/v0.1...v0.2
[v0.1]: https://github.com/izrik/kitsune/releases/tag/v0.1
