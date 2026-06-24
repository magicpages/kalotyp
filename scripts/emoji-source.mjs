/**
 * Shared emoji source for the build scripts.
 *
 * Joins two MIT/permissive data sources at build time:
 *   - `unicode-emoji-json` (MIT) — the curated emoji list, names, and groups.
 *   - `openmoji` (CC-BY-SA-4.0) — the colour SVG artwork, keyed by codepoint.
 *
 * Every emoji is resolved to its OpenMoji filename stem (`key`), trying the
 * full codepoint sequence first and then a FE0F-stripped variant (OpenMoji
 * drops the emoji-presentation selector from most filenames). This reaches
 * 100% coverage of the unicode-emoji-json set.
 *
 * Both `gen-emoji-data.mjs` (emits the TS catalogue) and `copy-emoji-svgs.mjs`
 * (copies the artwork into dist) consume this, so the char→key mapping has a
 * single source of truth.
 */

import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);

/** Codepoint sequence as uppercase hex, each padded to 4, hyphen-joined. */
function hex(ch) {
  return Array.from(ch)
    .map((c) => c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'))
    .join('-');
}

/** Absolute path to OpenMoji's colour SVG directory. */
export function openmojiSvgDir() {
  return resolve(dirname(require.resolve('openmoji/package.json')), 'color/svg');
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolve an emoji character to its OpenMoji filename stem, or `null` if absent. */
export async function resolveKey(ch, svgDir) {
  const full = hex(ch);
  const noFE0F = full
    .split('-')
    .filter((s) => s !== 'FE0F')
    .join('-');
  for (const candidate of full === noFE0F ? [full] : [full, noFE0F]) {
    if (await exists(resolve(svgDir, `${candidate}.svg`))) return candidate;
  }
  return null;
}

/**
 * The full catalogue: groups of `{ char, name, key }`, plus any chars with no
 * OpenMoji artwork (so callers can fail loudly rather than ship gaps).
 */
export async function getEmojiCatalogue() {
  const byGroupPath = require.resolve('unicode-emoji-json/data-by-group.json');
  const groups = JSON.parse(await readFile(byGroupPath, 'utf8'));
  const svgDir = openmojiSvgDir();
  const out = [];
  const missing = [];
  for (const group of groups) {
    const emojis = [];
    for (const entry of group.emojis) {
      const key = await resolveKey(entry.emoji, svgDir);
      if (!key) {
        missing.push(entry.emoji);
        continue;
      }
      emojis.push({ char: entry.emoji, name: entry.name, key });
    }
    out.push({ id: group.slug, label: group.name, emojis });
  }
  return { groups: out, missing, svgDir };
}
