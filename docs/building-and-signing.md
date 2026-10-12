# Building and signing

Read this when cutting a release or changing what ends up in the packaged add-on. Day-to-day
development needs none of it — load the extension from `about:debugging` instead (see
[`CLAUDE.md`](../CLAUDE.md)).

## The two scripts

- `./build.sh` — `web-ext build`, producing `web-ext-artifacts/kitsune-<version>.zip`.
- `./sign.sh` — `web-ext sign`, submitting to AMO on the **unlisted** channel.

Both need `web-ext` and `jq` on the path. `sign.sh` also needs `AMO_JWT_ISSUER` and
`AMO_JWT_SECRET` in the environment.

## The tag check

Both scripts **require the current commit to carry a tag whose name matches
`manifest.json`'s version** — `v0.4` for version `0.4` — and exit with an error
otherwise. They read the tag with `git describe --exact-match --tags` and compare it to
`jq -r .version manifest.json`.

So a release is:

1. Bump `version` in `manifest.json`
2. Commit
3. `git tag vX.Y`
4. `./build.sh` and/or `./sign.sh`

There is no way to build an untagged working tree, which is also why the build is not
something a routine change can smoke-test.

## What is excluded from the package

Both scripts pass the same `-i` exclusion list to `web-ext`:

```
CLAUDE.md AGENTS.md docs kitsune-windows*.json *.sh *.py instance notes
tools package.json package-lock.json
icons/bolt.png icons/sunny.png icons/kitsune.svg
LICENSE README.md .gitignore
```

That is: the agent docs (`CLAUDE.md`, the `AGENTS.md` symlink, `docs/`), planning notes,
local scripts, exported JSON, unused icons, and repo metadata. Keep the two lists in step
— anything added to one belongs in the other. Several of the entries (`instance/`,
`*.py` scratch files, exported JSON) are untracked working files kept deliberately out of
git as well as out of the package.
