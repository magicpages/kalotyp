# Ghost integration contract

The integration surface a third-party image-editor module must satisfy to drop into Ghost CMS. Every statement below is a citation to Ghost's source under `TryGhost/Ghost`.

## Call site

Ghost's admin invokes the editor from exactly one component:

`ghost/admin/app/components/koenig-image-editor.js`

The React admin (`apps/admin-x-settings/`) duplicates the same shape for its own integrations panel; the contract below is identical.

## Loading the module

Ghost loads the editor as an ES module via dynamic `import()`:

```js
// koenig-image-editor.js
const importScriptPromise = import(jsUrl);
importScriptPromise.then(() => { this.scriptLoaded = true; });

// Module must populate window.pintura by the time the promise resolves.
if (window.pintura) {
  this.scriptLoaded = true;
  return;
}
```

The CSS loads in parallel via `<link rel="stylesheet" href="${cssUrl}">` appended to `document.head`.

Both URLs come from Ghost settings or the MySQL database.

## The function Ghost calls

Only one entry point on the module is invoked:

```js
const editor = window.pintura.openDefaultEditor(options);
editor.on('loaderror', () => { /* ... */ });
editor.on('process', (result) => { /* ... */ });
```

`openDefaultEditor(options)` returns an editor instance with an `on(name, handler)` subscription API and a dismissal flow for the Close button.

## The options object Ghost passes

From `koenig-image-editor.js` at the call site (lines 171–225):

```js
window.pintura.openDefaultEditor({
  src: imageSrc,                       // string URL
  enableTransparencyGrid: true,
  util: 'crop',
  utils: [
    'crop', 'filter', 'finetune', 'redact', 'annotate',
    'trim', 'frame', 'resize',
  ],
  frameOptions: [
    [undefined,    locale => locale.labelNone],
    ['solidSharp', locale => locale.frameLabelMatSharp],
    ['solidRound', locale => locale.frameLabelMatRound],
    ['lineSingle', locale => locale.frameLabelLineSingle],
    ['hook',       locale => locale.frameLabelCornerHooks],
    ['polaroid',   locale => locale.frameLabelPolaroid],
  ],
  cropSelectPresetFilter: 'landscape',
  cropSelectPresetOptions: [
    [undefined, 'Custom'],
    [1,         'Square'],
    [2/1,       '2:1'],
    [3/2,       '3:2'],
    [4/3,       '4:3'],
    [16/10,     '16:10'],
    [16/9,      '16:9'],
    [1/2,       '1:2'],
    [2/3,       '2:3'],
    [3/4,       '3:4'],
    [10/16,     '10:16'],
    [9/16,      '9:16'],
  ],
  locale: { labelButtonExport: 'Save and close' },
  willClose: this.willClose,
});
```

Notes on individual options:

- **`src`** — Ghost appends a `?v=<timestamp>` cache-buster before passing, so the URL the module receives can be an URL that is different from the canonical asset URL.
- **`util`** — initial tab to mount. Always `'crop'` in current Ghost.
- **`utils`** — set of utility tabs to expose. Ghost passes `'trim'` but, interestingly, never invokes the editor on a video source.
- **`frameOptions`** — `[id, localeFn]` pairs. `id` is the frame preset Ghost expects the module to honour. `localeFn(locale) → string` is called by the module with its own locale object; Ghost supplies the function so it controls the user-facing label without knowing the module's locale shape.
- **`cropSelectPresetFilter`** — `'landscape'` or `'portrait'`. The module filters `cropSelectPresetOptions` accordingly.
- **`cropSelectPresetOptions`** — `[ratio, label]` pairs. `ratio` is a Number (width / height) or `undefined` for "Custom". `label` is the exact string Ghost wants the module to display.
- **`willClose`** — called by the module before it dismisses itself. Returning `false` keeps the editor open. Ghost uses this to implement the Close-button click-capture handshake (see "Dismissal" below).

## Events the module emits

Ghost subscribes to two events on the returned instance:

| Event | Payload | Trigger |
| --- | --- | --- |
| `loaderror` | (none) | Source image failed to load |
| `process` | `result` with `result.dest: File` | User clicked the save button |

```js
editor.on('process', (result) => {
  if (this.args.saveImage) {
    this.args.saveImage(result.dest);    // feature-image flow
  }
  if (this.args.saveUrl) {
    uploader.setFiles([result.dest]);    // preview / staff / tag flow
  }
});
```

`result.dest` is a `File` (a `Blob` subclass with `name` and `type`). Ghost POSTs it to `/ghost/api/admin/images/upload`, which accepts any image MIME the Admin's policy allows.

## The expected global

After `import(jsUrl)` resolves, Ghost expects `window.pintura` to be the exported module, with `openDefaultEditor` on it (lines 73 and 171):

```js
if (window.pintura) {
  this.scriptLoaded = true;
  return;
}
// ...
const editor = window.pintura.openDefaultEditor({...});
```

The module is responsible for assigning itself to `window.pintura` on load. Ghost's `import()` resolution does not consume the module's default export.

## Dismissal

Ghost intercepts clicks on the editor's Close button:

```js
@action
handleCloseClick(event) {
  if (event.target.closest('.PinturaModal button[title="Close"]')) {
    this.allowClose = true;
  }
}
addCloseHandler() {
  window.addEventListener('click', this.handleCloseClick, { capture: true });
}
```

The module is therefore expected to render a button matching the selector `.PinturaModal button[title="Close"]` whose click event bubbles to `window`. `willClose` is then consulted: it returns `true` when `allowClose` was flipped by that click, and `false` otherwise (for example by pressing Escape, programmatic close, click-outside). Returning `false` is the module's signal to keep itself open.

## Class hooks the integration requires

Kalotyp applies exactly two `Pintura*` class tokens. Both are functionally required by Ghost at runtime:

| Class | Role | Cited from |
| --- | --- | --- |
| `.pintura-editor` | Host element. Ghost's `pintura.css` overrides four CSS custom properties (`--color-background`, `--color-foreground`, `--font-family`, `--editor-modal-border-radius`) at this scope. Without this class Kalotyp can't pick up Ghost's per-site theme. | `pintura.css:1` |
| `.PinturaModal` | Modal wrapper. Ghost's body-level click-capture handler selects `.PinturaModal button[title="Close"]` to detect explicit close-button clicks; without it `willClose()` stays `false` and Ghost won't dismiss the editor. | `koenig-image-editor.js:250` |

Every other layout container and control inside Kalotyp uses the `kalotyp-*` prefix. Ghost ships additional `Pintura*` rules in `pintura.css` (a `.PinturaRoot[data-env]` layout system, `.PinturaButtonExport` save-button overrides, `.PinturaRectManipulator` crop-handle brackets, etc.) — those rules became no-ops once Kalotyp stopped applying the matching class names, and Kalotyp now styles its own chrome through `kalotyp-*` selectors. The integration still works because the only `Pintura*` hooks Ghost's *JavaScript* runtime actually depends on are the two above.

The `data-env` attribute on the layout root remains part of the contract (Ghost's stylesheet uses `[data-env~=landscape]` and `[data-env~=has-navigation]` qualifiers); Kalotyp applies it to its own `.kalotyp-root` container so any per-site Ghost rules targeting `[data-env]` continue to apply.

Ghost overrides four CSS custom properties at the `.pintura-editor` scope:

```css
--color-background
--color-foreground
--font-family
--editor-modal-border-radius
```

Cited from `pintura.css:1–6`.

## Settings the admin reads

Three settings in the database control the integration:

| Setting key | Type | Purpose |
| --- | --- | --- |
| `pintura` | boolean | Master enable flag |
| `pinturaJsUrl` | string | URL to the module's JS bundle |
| `pinturaCssUrl` | string | URL to the module's CSS bundle |

The admin's Settings → Integrations → Pintura modal lets the user upload files; Ghost stores them on the configured storage adapter and writes the resolved URLs back into the settings table. The URLs fo these files can also be stored in the `settings` table of the MySQL database for programmatic setups.

The runtime config object (`this.config.pintura`) can override the JS and CSS URLs without touching the settings:

```js
get pinturaJsUrl() {
  if (!this.settings.pintura) { return; }
  return this.config.pintura?.js || this.settings.pinturaJsUrl;
}
```

## Source pin

This document was last updated against `TryGhost/Ghost` at commit `e21cd9f91b2b6420efcad2e6183876a2c10006c9` (`ghost-admin` `package.json` version `6.39.0`). Line numbers above are intended as orientation, not exact references.
