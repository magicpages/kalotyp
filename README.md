# Kalotyp

> An open-source image editor for Ghost.
> *From Greek* kalos *(beautiful) +* typos *(impression). Pronounced* /kaˈloʊ.tɪp/

Kalotyp is a focused, MIT-licensed image editor that drops into Ghost CMS.
Self-hosted Ghost users can install it through **Settings → Integrations → Pintura** by uploading the Kalotyp JS and CSS files — no changes to Ghost itself.

## Install

In Ghost admin, go to **Settings → Integrations → Pintura** and toggle the
integration on. You can either **upload** the two build files, or **point Ghost
at a CDN URL** — Ghost stores whatever URL you give it.

> "Pintura" here is the name of Ghost's built-in image-editor integration slot,
> not a reference to any particular editor. Kalotyp is an independent project and
> is not affiliated with or endorsed by that editor; it simply implements the
> integration interface Ghost exposes under this name.

### Option A — CDN (no download)

Paste these into the JS URL and CSS URL fields. Every published release is served
automatically from [jsDelivr](https://www.jsdelivr.com/), a free, GDPR-compliant,
multi-CDN that doesn't log personal data:

```
JS:  https://cdn.jsdelivr.net/npm/@magicpages/kalotyp/dist/kalotyp.js
CSS: https://cdn.jsdelivr.net/npm/@magicpages/kalotyp/dist/kalotyp.css
```

These always serve the latest published release. Pin an exact version (e.g.
`@magicpages/kalotyp@0.1.1/dist/kalotyp.js`) if you'd rather upgrade deliberately.
The same files are mirrored on [unpkg](https://unpkg.com/) at
`https://unpkg.com/@magicpages/kalotyp/dist/kalotyp.js` if you prefer.

### Option B — Upload the files

Download `kalotyp.js` and `kalotyp.css` from the
[latest release](https://github.com/magicpages/kalotyp/releases/latest) (or build
them locally with `pnpm build`) and upload both in the integration settings.
That's the entire setup — no changes to Ghost itself.

## Repository layout

```
kalotyp/
├── packages/
│   ├── core/    # framework-agnostic editor engine
│   ├── ui/      # default UI
│   └── ghost/   # Ghost adapter — produces dist/kalotyp.js + kalotyp.css
└── apps/
    ├── playground/   # standalone dev harness (no Ghost needed)
    └── ghost-test/   # docker-compose Ghost + Playwright E2E
```

## Local development

```bash
pnpm install
pnpm dev       # starts the playground at http://localhost:5173
pnpm build     # produces packages/ghost/dist/kalotyp.{js,css}
pnpm test
pnpm typecheck
pnpm lint
pnpm size      # checks the gzipped bundle stays under 300KB
```

## Contributing

Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening a pull
request. Kalotyp is built clean-room — that section in particular is
non-negotiable.

## License

MIT. See [`LICENSE`](./LICENSE).
