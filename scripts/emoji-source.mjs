/**
 * Shared emoji source for the build scripts.
 *
 * Reads the curated emoji list, names, and groups from `unicode-emoji-json`
 * (MIT). Consumed by `gen-emoji-data.mjs` to emit the TS catalogue the picker
 * uses. Emoji render with the OS colour-emoji font at runtime — no artwork is
 * bundled or fetched — so only the character, name, and group are needed.
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** The full catalogue: groups of `{ char, name }` from unicode-emoji-json. */
export async function getEmojiCatalogue() {
  const byGroupPath = require.resolve('unicode-emoji-json/data-by-group.json');
  const groups = JSON.parse(await readFile(byGroupPath, 'utf8'));
  return {
    groups: groups.map((group) => ({
      id: group.slug,
      label: group.name,
      emojis: group.emojis.map((entry) => ({ char: entry.emoji, name: entry.name })),
    })),
  };
}
