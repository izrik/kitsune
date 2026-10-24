# Security Policy

Kitsune is a Firefox extension maintained by one person in his spare time. This file says
where to send a vulnerability report and what happens to it.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting:
[**Report a vulnerability**](https://github.com/izrik/kitsune/security/advisories/new)
(also reachable from the repository's *Security* tab). If that doesn't work for you, send
a direct message to [@izrik](https://github.com/izrik) instead.

**Please don't open a public issue for a security problem.** This repository is public, so
an issue describing an unfixed flaw tells everyone before there is anything to update to.

A useful report says what an attacker gains, and gives enough detail to reproduce it — the
affected file or UI surface, the steps, and the Firefox and Kitsune versions you saw it
on.

## Scope

In scope: the extension's own code in this repository — `background.js`, `datastore.js`,
`popup/`, `manager/`, `manifest.json` and the permissions it requests — and the signed
add-on published from it at
[addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/kitsune2/).

Out of scope:

- **Firefox itself and its extension APIs.** Report those to
  [Mozilla](https://www.mozilla.org/en-US/about/governance/policies/security-group/bugs/).
- **Third-party tools.** Kitsune ships no bundled libraries and declares no runtime
  dependencies; `web-ext` is a build-time tool, and flaws in it belong to
  [its own project](https://github.com/mozilla/web-ext).
- **Anything that needs an attacker to already control the browser profile**, since an
  extension's stored data is readable by anyone who has that.

## What to expect

- An acknowledgement that the report arrived and was read.
- A fix, where the finding is real and fixing it is within reach of one maintainer, landed
  on `master` and included in the next signed release.
- Credit in the changelog and the advisory, if you want it — say so in your report, and
  say how you'd like to be named.

There is no bounty, and no promised response time: a single unpaid maintainer can't
honestly commit to a clock. You will get a reply.

## Supported versions

Kitsune ships from `master` and tags releases; there are no maintained release branches.
Supported means **the latest release and the current `master`**. Fixes go to `master`, not
to older tags.
