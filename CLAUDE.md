# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kitsune** is a Firefox extension (manifest v3) for managing tabs and windows. It gives a
window a name, stored per-window in `browser.sessions` and shown in the OS title bar as a
`[name] ` prefix so that many open windows stay distinguishable in the taskbar and
alt-tab switcher. Its two surfaces are a **browser action popup** for naming the current
window and a **manager page** (a full tab) listing every open window and its tabs, with
per-window and per-tab actions, a filter box, and JSON export/import. Vanilla JS, ES
modules, no framework and no build step for the extension code. Published at
https://addons.mozilla.org/en-US/firefox/addon/kitsune2/

## Commands

**Load the extension:** `about:debugging` → "This Firefox" → "Load Temporary Add-on" →
select `manifest.json`. Reload from the same page after changes; the background script and
the manager page each have their own console. There is no dev server.

**Test:** manual only — there is no test suite and no lint config. Exercise changes with
several windows open, at least one of them titled, and check that titles survive a browser
restart.

**Lint:** `web-ext lint --source-dir .` — validates `manifest.json` and the extension's
JavaScript against the rules AMO applies. Needs no tag and no credentials, unlike
`build.sh`/`sign.sh`. This is what CI runs on every pull request; see *Continuous
integration* below.

**Build:** `./build.sh` (zip into `web-ext-artifacts/`) and `./sign.sh` (submit to AMO,
unlisted channel). Both refuse to run unless the current commit carries a tag matching
`manifest.json`'s version, so neither is usable as a routine check — see
[`docs/building-and-signing.md`](docs/building-and-signing.md).

## Architecture at a glance

```
  popup/        ──┐                            ┌── browser.sessions  (per-window title)
  (name a window) │                            │
                  ├──▶ datastore.js ──────────▶┤
  manager/      ──┤    getDataStore()          └── browser.windows   (titlePreface)
  (list, act,     │
   export/import) │
                  │
  background.js ──┘  refreshes titles on windows.onCreated / tabs.onActivated
```

`datastore.js` is the only thing that touches storage; `popup/` and `manager/` both go
through its `getDataStore()` singleton. `manager/manager.js` is where nearly all the
feature work lives. See **Further documentation** below for the full breakdown.

## Conventions

- Vanilla JS, ES modules, no framework, no bundler, no build step for the extension code.
- DOM is built imperatively with `createElement` / `textContent` / `replaceChildren`.
  Avoid `innerHTML` — tab titles and URLs are untrusted input.
- Imports and shared asset paths are root-absolute (`/datastore.js`, `/icons/close.png`,
  `/logo/logo.png`), so they resolve the same from the popup and the manager; a page's own
  script is the exception (`<script src="manager.js">`).
- Liberal `console.debug` tracing, typically naming the function and its arguments.
- Icons are Material Symbols PNGs in `icons/`; the extension's own logo is
  `icons/kitsune_thick.svg` (plus a white variant for dark themes).
- Destructive actions (closing a window, unloading tabs, importing, bulk close) confirm
  first via `confirm()`.

## Branch naming

Hyphens, no slashes. Issue-driven work is prefixed with the issue number
(`19-add-a-changelog`); other branches are named for the change
(`fix-release-number`, `bulk-tab-operations`).

## Development workflow

1. **Branch.** One branch per change, off `master` (see *Branch naming* above).
2. **Implement.** Follow *Conventions* above.
3. **Test.** Load the extension in `about:debugging` and exercise the change by hand;
   there is nothing automated to run.
4. **Commit.** Before committing, add an entry to the `## [Unreleased]` section of
   [`CHANGELOG.md`](CHANGELOG.md) for anything a user would notice — a new button or
   page, a changed default, a renamed action, a changed export or import format, a fixed
   bug. Write it from the reader's side ("exports made before v0.3 can be imported
   again"), not the committer's ("refactored `windowsFromImportData`"), and cite the
   issue or PR number. An internal refactor with no outward effect needs no entry. Don't
   add a version heading or a date — tagging a release is a separate, deliberate step.
5. **Open a PR.** Push the branch and open a pull request (`gh pr create`) against
   `master` describing the change and how it was tested. Every change in this repo's
   history landed as a merged PR.
6. **Handle feedback.** Push follow-up commits to the same branch rather than opening a
   new PR.

## Continuous integration

Pull requests are gated by [`.github/workflows/ci.yml`](.github/workflows/ci.yml), which
runs on every PR and on pushes to `master`. It installs `web-ext` and runs the one check
this repo has:

```sh
npm install --global web-ext   # or use a web-ext you already have
web-ext lint --source-dir .
```

The lint fails on errors only; the warnings it reports about `build.sh`, `sign.sh` and
`tools/*.py` are pre-existing and concern files that `build.sh` excludes from the packaged
add-on anyway. Run it before pushing and the check will be green.

Nothing else runs in CI: there is no test suite (see issue #24), and `build.sh`/`sign.sh`
need a matching git tag — and, for signing, AMO credentials — so neither can run on a pull
request.

## Security

[`SECURITY.md`](SECURITY.md) is where a vulnerability report goes — GitHub's private
vulnerability reporting, not a public issue, since this repository is public. It also sets
out what is in scope (this repository's code and the signed add-on) and what isn't
(Firefox itself, build-time tools). Dependabot watches the GitHub Actions in
`.github/workflows/`, which are the only versioned dependencies the repository declares;
the extension bundles no libraries and there is no `package.json` in git, so there is no
dependency manifest for an audit tool to read.

Don't paste a credential anywhere in the tree, not even an expired one: `sign.sh` reads
AMO credentials from `$AMO_JWT_ISSUER` and `$AMO_JWT_SECRET` and nothing else should hold
them.

## Project ecosystem

Kitsune is one of several related projects. Its page in
[izrik/lorto-ecosystem](https://github.com/izrik/lorto-ecosystem) —
[`projects/kitsune.md`](https://github.com/izrik/lorto-ecosystem/blob/master/projects/kitsune.md)
— is the place to learn how it relates to the others.

## Further documentation

This file is the entry point and stays short on purpose — it's loaded on every session
regardless of task. These live in `docs/` and are worth reading when the task actually
touches that area:

- [`docs/architecture.md`](docs/architecture.md) — the file-by-file map, what the manager
  page is made of, the `browser.sessions` storage strategy and why, the export/import
  format and its hard limits, the browser APIs used, and the manifest permissions.
- [`docs/building-and-signing.md`](docs/building-and-signing.md) — `build.sh`/`sign.sh`,
  the tag-matches-manifest-version rule, what is excluded from the packaged add-on, and
  the AMO credentials.

`notes/` holds planning docs (`v1-features.md` for 1.0 scope, `todo.md` for deferred
work); GitHub issues are the live record of what's open.
