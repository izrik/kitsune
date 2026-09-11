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
- **Cancelling an import.** A large import runs for minutes with no way to stop it
  short of closing the manager tab, which leaves the windows created so far in place.
  The progress line would be the natural place to put a cancel button.
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
- `instance/` is deliberately untracked and excluded from the build. It holds the
  exports the notes here cite as evidence, so it is not pending cleanup.
