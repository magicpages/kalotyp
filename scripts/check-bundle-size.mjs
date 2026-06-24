#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';

// `import.meta.dirname` needs Node >=20.11; this works on the repo's >=20.10 floor.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(repoRoot, 'packages/ghost/dist');

const BUDGET_GZIP_KB = 300;

const targets = [
  { file: 'kalotyp.js', label: 'JS bundle' },
  { file: 'kalotyp.css', label: 'CSS bundle' },
];

let combinedGzip = 0;
const rows = [];
let missing = false;

for (const target of targets) {
  const path = resolve(distDir, target.file);
  try {
    await stat(path);
  } catch {
    rows.push({ label: target.label, missing: true });
    missing = true;
    continue;
  }
  const buf = await readFile(path);
  const gzip = gzipSync(buf, { level: 9 }).byteLength;
  const brotli = brotliCompressSync(buf).byteLength;
  combinedGzip += gzip;
  rows.push({
    label: target.label,
    file: target.file,
    raw: buf.byteLength,
    gzip,
    brotli,
  });
}

const fmt = (bytes) => `${(bytes / 1024).toFixed(2)} KB`;

console.log('Bundle size report');
console.log('──────────────────');
for (const row of rows) {
  if (row.missing) {
    console.log(`  ${row.label.padEnd(12)} — NOT FOUND (run \`pnpm build\` first)`);
    continue;
  }
  console.log(
    `  ${row.label.padEnd(12)} ${row.file.padEnd(14)} raw ${fmt(row.raw).padStart(10)}  gzip ${fmt(
      row.gzip,
    ).padStart(10)}  brotli ${fmt(row.brotli).padStart(10)}`,
  );
}
console.log('──────────────────');
console.log(`  Combined gzip: ${fmt(combinedGzip)}  (budget ${BUDGET_GZIP_KB} KB)`);

if (missing) {
  console.error('\nFAIL: one or more bundle outputs are missing.');
  process.exit(1);
}
if (combinedGzip > BUDGET_GZIP_KB * 1024) {
  const over = combinedGzip - BUDGET_GZIP_KB * 1024;
  console.error(`\nFAIL: combined gzip is over budget by ${fmt(over)}.`);
  process.exit(1);
}
console.log('\nOK: under budget.');
