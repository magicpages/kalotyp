#!/usr/bin/env node
/**
 * Copy the OpenMoji colour SVGs used by the emoji picker into a dist `emoji/`
 * directory, so the artwork ships as static same-origin assets alongside the
 * bundle (never inlined into the JS — that keeps the loaded bundle small).
 *
 * The runtime loads `<assetBase>/<key>.svg` on demand and caches it. Only the
 * emoji a user actually browses or places are ever fetched.
 *
 * Usage: node scripts/copy-emoji-svgs.mjs [targetDir]
 * Default target: packages/ghost/dist/emoji
 */
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getEmojiCatalogue } from './emoji-source.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const target = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(repoRoot, 'packages/ghost/dist/emoji');

const { groups, svgDir } = await getEmojiCatalogue();
const keys = new Set();
for (const group of groups) {
  for (const entry of group.emojis) keys.add(entry.key);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

let copied = 0;
for (const key of keys) {
  await copyFile(resolve(svgDir, `${key}.svg`), resolve(target, `${key}.svg`));
  copied += 1;
}

console.log(`Copied ${copied} emoji SVGs → ${target}`);
