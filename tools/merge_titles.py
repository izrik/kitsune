#!/usr/bin/env python3
"""
Merge window titles from webextension-window-titler into Kitsune.

STEP 1 — Extract titles from window-titler:
  Open about:debugging, find webextension-window-titler, click Inspect.
  Paste this into its console and save the output as titler.json:

    (async () => {
        const windows = await browser.windows.getAll({populate: true});
        const out = [];
        for (const win of windows) {
            const title = await browser.sessions.getWindowValue(win.id, 'userWindowTitle') || '';
            out.push({ title, tabs: win.tabs.map(t => t.url) });
        }
        copy(JSON.stringify(out, null, 2));
    })();

STEP 2 — Export from Kitsune:
  Open the Kitsune manager page and click "Export Windows Data".
  Save the file as kitsune.json.

STEP 3 — Run this script:
  python merge_titles.py titler.json kitsune.json

  This prints a summary and a JS snippet to stdout.

STEP 4 — Apply the titles:
  Open about:debugging, find Kitsune, click Inspect.
  Paste the generated JS snippet into its console and run it.
"""

import json
import sys


def overlap(urls_a, urls_b):
    return len(set(urls_a) & set(urls_b))


def find_best_match(titler_tabs, candidates):
    best, best_score = None, 0
    for win in candidates:
        score = overlap(titler_tabs, [t['url'] for t in win.get('tabs', [])])
        if score > best_score:
            best_score = score
            best = win
    return best, best_score


def js_escape(s):
    return s.replace('\\', '\\\\').replace("'", "\\'")


def main():
    if len(sys.argv) != 3:
        print(f'Usage: {sys.argv[0]} <titler.json> <kitsune_export.json>')
        sys.exit(1)

    with open(sys.argv[1]) as f:
        titler_data = json.load(f)

    with open(sys.argv[2]) as f:
        kitsune_data = json.load(f)

    kitsune_windows = kitsune_data.get('openWindows', [])

    matched = []       # list of {windowId, title, score, totalTabs}
    unmatched = []     # titler windows we couldn't place
    used_ids = set()

    for titler_win in titler_data:
        title = titler_win.get('title', '').strip()
        if not title:
            continue

        tabs = titler_win.get('tabs', [])
        best, score = find_best_match(tabs, kitsune_windows)

        if best is None or score == 0:
            unmatched.append(titler_win)
            continue

        win_id = best['id']
        if win_id in used_ids:
            unmatched.append(titler_win)
            continue

        used_ids.add(win_id)
        matched.append({
            'windowId': win_id,
            'title': title,
            'score': score,
            'totalTabs': len(tabs),
        })

    # Summary
    print(f'Matched:   {len(matched)}')
    print(f'Unmatched: {len(unmatched)}')

    if unmatched:
        print('\nCould not match the following titled windows (no overlapping tabs found):')
        for w in unmatched:
            print(f"  {w.get('title')!r}  ({len(w.get('tabs', []))} tabs)")

    if not matched:
        print('\nNothing to apply.')
        return

    print('\nMatches:')
    for m in matched:
        print(f"  window {m['windowId']:>4}  {m['score']}/{m['totalTabs']} tabs  {m['title']!r}")

    # JS snippet
    lines = [
        '',
        '// ---- Paste into Kitsune background page console (about:debugging) ----',
        '(async () => {',
        '    const mod = await import("/datastore.js");',
        '    const store = mod.getDataStore();',
    ]
    for m in matched:
        lines.append(f"    await store.saveTitleForWindow({m['windowId']}, '{js_escape(m['title'])}');")
        lines.append(f"    await store.refreshAppearanceForWindow({m['windowId']});")
    lines += [
        f"    console.log('Done: applied {len(matched)} title(s).');",
        '})();',
        '// -----------------------------------------------------------------------',
    ]
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
