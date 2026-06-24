#!/usr/bin/env node
/**
 * Generate the emoji catalogue used by the annotate emoji picker.
 *
 * Joins `unicode-emoji-json` (MIT — list/names/groups) with `openmoji`
 * (CC-BY-SA-4.0 — colour SVG artwork) via scripts/emoji-source.mjs, and emits a
 * compact, typed module at `packages/ui/src/plugins/annotate/emoji-data.ts`.
 *
 * Each entry carries `{ char, name, key }` where `key` is the OpenMoji filename
 * stem; the runtime builds the SVG URL as `<assetBase>/<key>.svg`. The artwork
 * itself ships as static files (see copy-emoji-svgs.mjs) — never inlined here —
 * so the loaded bundle stays small.
 *
 * Regenerate with: pnpm gen:emoji
 */
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEmojiCatalogue } from './emoji-source.mjs';

// `import.meta.dirname` needs Node >=20.11; this works on the repo's >=20.10 floor.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = resolve(repoRoot, 'packages/ui/src/plugins/annotate/emoji-data.ts');

const { groups, missing } = await getEmojiCatalogue();
if (missing.length > 0) {
  console.warn(`WARNING: ${missing.length} emoji had no OpenMoji artwork and were dropped.`);
}

const total = groups.reduce((sum, g) => sum + g.emojis.length, 0);

// One JSON line per group keeps the committed file small (a handful of lines)
// and keeps `tsc` from inferring ~1900 literal types (the explicit annotation
// widens it to the shared interface instead).
const groupLines = groups.map((g) => `  ${JSON.stringify(g)},`).join('\n');

const header = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Emoji catalogue for the annotate emoji picker. List/names from
 * unicode-emoji-json (MIT); \`key\` is the OpenMoji (CC-BY-SA-4.0) artwork
 * filename stem, resolved at generation time. Regenerate with \`pnpm gen:emoji\`
 * — see scripts/gen-emoji-data.mjs.
 *
 * ${total} emojis across ${groups.length} groups.
 */

export interface EmojiEntry {
  /** The emoji character (used for search context and the placed shape). */
  readonly char: string;
  /** CLDR name, used as the search corpus and the picker button's accessible label. */
  readonly name: string;
  /** OpenMoji artwork filename stem; the SVG URL is \`<assetBase>/<key>.svg\`. */
  readonly key: string;
}

export interface EmojiGroup {
  /** Stable group key (the Unicode group slug). */
  readonly id: string;
  /** Human-readable group label for the category tab. */
  readonly label: string;
  readonly emojis: ReadonlyArray<EmojiEntry>;
}
`;

const body = `\nexport const EMOJI_GROUPS: ReadonlyArray<EmojiGroup> = [\n${groupLines}\n];\n`;

await writeFile(outPath, header + body, 'utf8');
console.log(`Wrote ${outPath}\n  ${total} emojis across ${groups.length} groups.`);
