/**
 * Emoji artwork loader for the annotate emoji sticker tool.
 *
 * Emoji stickers render as OpenMoji SVGs (crisp at any size) rather than the
 * platform's bitmap emoji font (which blurs when enlarged). The SVGs ship as
 * static same-origin assets next to the bundle; this module resolves their URL,
 * loads them on demand into an `<img>` cache, and hands the decoded image to the
 * shared `paintShape` so the on-screen preview and the bake draw the same pixels.
 *
 * Nothing is fetched until an emoji is actually browsed or placed, and each
 * glyph is loaded once and cached. Until an image is ready (or if the asset is
 * unavailable) `paintShape` falls back to the OS emoji font, so the feature
 * degrades gracefully and never blocks.
 */

import type { Shape } from '@magicpages/kalotyp-core';
import { EMOJI_GROUPS } from './emoji-data.js';

const KEY_BY_CHAR = new Map<string, string>();
for (const group of EMOJI_GROUPS) {
  for (const entry of group.emojis) KEY_BY_CHAR.set(entry.char, entry.key);
}

/** The OpenMoji artwork key for an emoji character, or `undefined` if unknown. */
export function emojiKeyFor(char: string): string | undefined {
  return KEY_BY_CHAR.get(char);
}

let assetBaseOverride: string | null = null;

/**
 * Override where emoji SVGs are loaded from. The host (e.g. the Ghost loader)
 * calls this when the assets aren't served at the default `/emoji/` path. A
 * trailing slash is enforced.
 *
 * Best set before the first emoji is used, but a later change is honoured:
 * already-cached images were loaded from the old base, so changing it drops the
 * cache and the next paint reloads from the new base.
 */
export function setEmojiAssetBase(url: string): void {
  const next = url.endsWith('/') ? url : `${url}/`;
  if (next === assetBaseOverride) return;
  assetBaseOverride = next;
  // Invalidate images keyed to the previous base; a repaint reloads them.
  cache.clear();
  notifyLoaded();
}

function withSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function assetBase(): string {
  if (assetBaseOverride) return assetBaseOverride;
  const fromGlobal =
    typeof window !== 'undefined'
      ? (window as { __KALOTYP_EMOJI_BASE__?: unknown }).__KALOTYP_EMOJI_BASE__
      : undefined;
  if (typeof fromGlobal === 'string' && fromGlobal.length > 0) return withSlash(fromGlobal);
  return '/emoji/';
}

/** The same-origin SVG URL for an OpenMoji artwork key. */
export function emojiSvgUrlForKey(key: string): string {
  return `${assetBase()}${key}.svg`;
}

/** The same-origin SVG URL for an emoji character, or `null` if it has no artwork. */
export function emojiSvgUrl(char: string): string | null {
  const key = KEY_BY_CHAR.get(char);
  return key ? emojiSvgUrlForKey(key) : null;
}

interface CacheEntry {
  readonly image: HTMLImageElement;
  loaded: boolean;
  failed: boolean;
}

const cache = new Map<string, CacheEntry>();
const loadListeners = new Set<() => void>();

/** Register a callback fired whenever an emoji image finishes loading (for repaint). */
export function onEmojiImageLoad(callback: () => void): () => void {
  loadListeners.add(callback);
  return () => {
    loadListeners.delete(callback);
  };
}

function notifyLoaded(): void {
  for (const callback of loadListeners) callback();
}

function ensureEntry(key: string): CacheEntry {
  const existing = cache.get(key);
  if (existing) return existing;
  const image = new Image();
  const entry: CacheEntry = { image, loaded: false, failed: false };
  cache.set(key, entry);
  image.addEventListener('load', () => {
    entry.loaded = true;
    notifyLoaded();
  });
  image.addEventListener('error', () => {
    entry.failed = true;
  });
  // Same-origin SVG → the bake canvas stays untainted, so Save can still export.
  image.src = `${assetBase()}${key}.svg`;
  return entry;
}

/**
 * Synchronous resolver consumed by `paintShape`: returns the decoded image if
 * it's ready, otherwise `null` (and kicks off the load so a later repaint — via
 * `onEmojiImageLoad` — can draw it). `null` makes `paintShape` fall back to the
 * OS emoji font.
 */
export function resolveEmojiImage(char: string): CanvasImageSource | null {
  const key = KEY_BY_CHAR.get(char);
  if (!key) return null;
  const entry = ensureEntry(key);
  return entry.loaded ? entry.image : null;
}

/** Cap on how long the bake waits for emoji artwork; on timeout it bakes the font fallback. */
const PRELOAD_TIMEOUT_MS = 1500;

/**
 * Load the artwork for every emoji shape and await it (for the bake, so the
 * saved image gets the crisp SVG rather than the fallback). Bounded by a
 * timeout — a slow or blocked asset must never wedge Save.
 */
export async function ensureEmojiImagesLoaded(shapes: ReadonlyArray<Shape>): Promise<void> {
  const keys = new Set<string>();
  for (const shape of shapes) {
    if (shape.kind !== 'emoji') continue;
    const key = KEY_BY_CHAR.get(shape.emoji);
    if (key) keys.add(key);
  }
  if (keys.size === 0) return;
  const waits = [...keys].map((key) => {
    const entry = ensureEntry(key);
    if (entry.loaded || entry.failed) return Promise.resolve();
    return new Promise<void>((res) => {
      entry.image.addEventListener('load', () => res(), { once: true });
      entry.image.addEventListener('error', () => res(), { once: true });
    });
  });
  const timeout = new Promise<void>((res) => setTimeout(res, PRELOAD_TIMEOUT_MS));
  await Promise.race([Promise.all(waits).then(() => undefined), timeout]);
}
