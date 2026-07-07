#!/usr/bin/env node
/**
 * Generate the emoji catalogue used by the annotate emoji picker.
 *
 * Reads the list/names/groups from `unicode-emoji-json` (MIT) via
 * scripts/emoji-source.mjs and emits a compact, typed module at
 * `packages/ui/src/plugins/annotate/emoji-data.ts`.
 *
 * Each entry is `{ char, name }`. Emoji render with the OS colour-emoji font at
 * runtime — no artwork is bundled — so no image key is needed.
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

const { groups } = await getEmojiCatalogue();

const total = groups.reduce((sum, g) => sum + g.emojis.length, 0);

// One JSON line per group keeps the committed file small (a handful of lines)
// and keeps `tsc` from inferring ~1900 literal types (the explicit annotation
// widens it to the shared interface instead).
const groupLines = groups.map((g) => `  ${JSON.stringify(g)},`).join('\n');

const header = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Emoji catalogue for the annotate emoji picker. List/names/groups from
 * unicode-emoji-json (MIT). Emoji render with the OS colour-emoji font — no
 * artwork is bundled. Regenerate with \`pnpm gen:emoji\` — see
 * scripts/gen-emoji-data.mjs.
 *
 * ${total} emojis across ${groups.length} groups.
 */

export interface EmojiEntry {
  /** The emoji character (used for search context and the placed shape). */
  readonly char: string;
  /** CLDR name, used as the search corpus and the picker button's accessible label. */
  readonly name: string;
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
