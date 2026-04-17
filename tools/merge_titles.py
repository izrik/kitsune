#!/usr/bin/env python3
"""
Merge window titles from webextension-window-titler into Kitsune.

STEP 1 — Extract titles from window-titler:
  Open about:debugging, find webextension-window-titler, click Inspect.
  Paste this into its console and save the output as titler.json:

    (async () => {
        const windows = await browser.windows.getAll();
        const out = [];
        for (const win of windows) {
            const title = await browser.sessions.getWindowValue(win.id, 'userWindowTitle') || '';
            out.push({ windowId: win.id, title });
        }
        copy(JSON.stringify(out, null, 2));
    })();

STEP 2 — Run this script:
  python merge_titles.py titler.json

  This prints a summary and a JS snippet to stdout.

STEP 3 — Apply the titles:
  Open about:debugging, find Kitsune, click Inspect.
  Paste the generated JS snippet into its console and run it.

  NOTE: Steps 1 and 3 must be done in the same browser session with the
  same windows open, since window IDs change between sessions.
"""

import json
import sys


def js_escape(s):
    return s.replace('\\', '\\\\').replace("'", "\\'")


def main():
    if len(sys.argv) != 2:
        print(f'Usage: {sys.argv[0]} <titler.json>')
        sys.exit(1)

    with open(sys.argv[1]) as f:
        titler_data = json.load(f)

    titled = [w for w in titler_data if w.get('title', '').strip()]
    skipped = len(titler_data) - len(titled)

    print(f'Titled windows:   {len(titled)}')
    print(f'Untitled skipped: {skipped}')

    if not titled:
        print('\nNothing to apply.')
        return

    print('\nWindows to apply:')
    for w in titled:
        print(f"  window {w['windowId']:>4}  {w['title']!r}")

    lines = [
        '',
        '// ---- Paste into Kitsune background page console (about:debugging) ----',
        '(async () => {',
        '    const mod = await import(browser.runtime.getURL("datastore.js"));',
        '    const store = mod.getDataStore();',
    ]
    for w in titled:
        lines.append(f"    await store.saveTitleForWindow({w['windowId']}, '{js_escape(w['title'])}');")
        lines.append(f"    await store.refreshAppearanceForWindow({w['windowId']});")
    lines += [
        f"    console.log('Done: applied {len(titled)} title(s).');",
        '})();',
        '// -----------------------------------------------------------------------',
    ]
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
