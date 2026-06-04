# Security Policy

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue.

- Use GitHub's [private vulnerability reporting](https://github.com/magicpages/kalotyp/security/advisories/new) for this repository, **or**
- Email **jannis@magicpages.co** with the details.

We'll acknowledge your report within a few business days and keep you updated on
the fix. Once a fix is released we're happy to credit you, unless you'd prefer
to stay anonymous.

## Scope

Kalotyp runs entirely client-side in the browser and ships with **zero runtime
dependencies** in the published bundle. The most relevant classes of issue:

- DOM-based XSS through image metadata, filenames, or editor option values.
- Anything that lets a crafted image or option escape the editor's sandbox or
  exfiltrate data (the editor makes no network requests of its own).

Dependency-scanner alerts on the repo's **dev/build** tooling (Vite, Vitest,
Playwright, etc.) do not affect the shipped bundle, since none of it is included
in `kalotyp.js` / `kalotyp.css`. They're still kept current via Dependabot.

## Supported versions

The latest published release is supported. Fixes are released forward; we don't
backport to older minor versions.
