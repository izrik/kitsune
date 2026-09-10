# Todo

Not blocking 1.0. See `v1-features.md` for what is.

## Features, deferred

- **Keyboard shortcuts.** Add a `commands` entry to the manifest for opening the
  manager and for setting the current window's title. Today the popup is the only way
  in.
- **Options page.** The title format is hardcoded as `[title] ` in
  `DataStore.refreshAppearanceForWindow()`. An options page could make the delimiter
  configurable, and expose the debounce interval.
- **Richer export.** Export captures only `{title, url}` per tab. Pinned state, tab
  order and window geometry could travel too. Navigation history and scroll position
  cannot — Firefox exposes no API for it (this is what killed sleep/wake).
- **Recently-closed windows.** `browser.sessions.getRecentlyClosed()` could surface
  closed windows and their stored titles for restoring.
- **Import de-duplication.** Import always opens new windows; it never merges into, or
  skips, windows that are already open.
- **`_locales`.** No internationalization at all. Nice for AMO, not needed for 1.0.

## Release chores

- Issue #15 — clean up the AMO listing.
- Version bump and tag before the next release: `build.sh` and `sign.sh` both refuse to
  run unless the current commit carries a tag matching `manifest.json`'s version.
- `v1-features` has never been pushed; decide whether it merges to `master` or goes up
  as a PR.

## Repo hygiene

- Drop `activeTab` from the manifest — the `tabs` permission already covers what the
  popup and manager do, and fewer permissions is an easier AMO review.
- Untracked scratch in the working tree: `1.py` (an unrelated Ollama script, nothing to
  do with Kitsune), `get_version.sh` (an abandoned versioning scheme, superseded by the
  tag check now in `build.sh`/`sign.sh`), `instance/`, `tools/import.js`.
- Two stale stashes: `stash@{0}` is icon assets on the long-merged `ui-improvements`,
  `stash@{1}` is 15 lines in `kitsune.js` from before that file was gutted. Both look
  droppable.
