/**
 * Font catalogue for the text annotation tool. The set mirrors the fonts
 * Ghost's own admin offers (loaded from fonts.bunny.net by Ghost's
 * `admin-x-design-system`), so annotations can match a site's typography.
 * The UI loads the same families from Bunny at runtime; this module is the
 * single source for the CSS family stacks and the `font` shorthand used by
 * the inline editor, the canvas preview, and the bake — keeping all three
 * byte-identical (WYSIWYG).
 */

import type { TextShape } from './state.js';

/**
 * System stack — the default, always available with no web font. Resolves to
 * platform UI fonts.
 */
export const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export interface FontDef {
  /** Stable key stored on the shape; resolved to a CSS stack via `fontStackFor`. */
  readonly key: string;
  /** Human label shown in the picker. */
  readonly label: string;
  /** CSS font-family stack, including a generic fallback. */
  readonly stack: string;
  /**
   * fonts.bunny.net family slug, or `null` for the system default (no web
   * font to request). The UI builds one combined Bunny request from these.
   */
  readonly bunnyName: string | null;
  /** Generic CSS fallback class, used to build the stack and as a hint. */
  readonly generic: 'sans-serif' | 'serif' | 'monospace';
}

/**
 * The catalogue. The first entry (`system`) is the default. The rest mirror
 * Ghost's curated Bunny set; their family names match Bunny's font CSS so the
 * loaded `@font-face` families resolve.
 */
export const TEXT_FONTS: readonly FontDef[] = [
  {
    key: 'system',
    label: 'System',
    stack: SYSTEM_FONT_STACK,
    bunnyName: null,
    generic: 'sans-serif',
  },
  {
    key: 'inter',
    label: 'Inter',
    stack: '"Inter", sans-serif',
    bunnyName: 'inter',
    generic: 'sans-serif',
  },
  {
    key: 'roboto',
    label: 'Roboto',
    stack: '"Roboto", sans-serif',
    bunnyName: 'roboto',
    generic: 'sans-serif',
  },
  {
    key: 'manrope',
    label: 'Manrope',
    stack: '"Manrope", sans-serif',
    bunnyName: 'manrope',
    generic: 'sans-serif',
  },
  {
    key: 'poppins',
    label: 'Poppins',
    stack: '"Poppins", sans-serif',
    bunnyName: 'poppins',
    generic: 'sans-serif',
  },
  {
    key: 'nunito',
    label: 'Nunito',
    stack: '"Nunito", sans-serif',
    bunnyName: 'nunito',
    generic: 'sans-serif',
  },
  {
    key: 'fira-sans',
    label: 'Fira Sans',
    stack: '"Fira Sans", sans-serif',
    bunnyName: 'fira-sans',
    generic: 'sans-serif',
  },
  {
    key: 'noto-sans',
    label: 'Noto Sans',
    stack: '"Noto Sans", sans-serif',
    bunnyName: 'noto-sans',
    generic: 'sans-serif',
  },
  {
    key: 'tenor-sans',
    label: 'Tenor Sans',
    stack: '"Tenor Sans", sans-serif',
    bunnyName: 'tenor-sans',
    generic: 'sans-serif',
  },
  {
    key: 'space-grotesk',
    label: 'Space Grotesk',
    stack: '"Space Grotesk", sans-serif',
    bunnyName: 'space-grotesk',
    generic: 'sans-serif',
  },
  {
    key: 'chakra-petch',
    label: 'Chakra Petch',
    stack: '"Chakra Petch", sans-serif',
    bunnyName: 'chakra-petch',
    generic: 'sans-serif',
  },
  { key: 'lora', label: 'Lora', stack: '"Lora", serif', bunnyName: 'lora', generic: 'serif' },
  {
    key: 'merriweather',
    label: 'Merriweather',
    stack: '"Merriweather", serif',
    bunnyName: 'merriweather',
    generic: 'serif',
  },
  {
    key: 'noto-serif',
    label: 'Noto Serif',
    stack: '"Noto Serif", serif',
    bunnyName: 'noto-serif',
    generic: 'serif',
  },
  {
    key: 'ibm-plex-serif',
    label: 'IBM Plex Serif',
    stack: '"IBM Plex Serif", serif',
    bunnyName: 'ibm-plex-serif',
    generic: 'serif',
  },
  { key: 'cardo', label: 'Cardo', stack: '"Cardo", serif', bunnyName: 'cardo', generic: 'serif' },
  {
    key: 'old-standard-tt',
    label: 'Old Standard TT',
    stack: '"Old Standard TT", serif',
    bunnyName: 'old-standard-tt',
    generic: 'serif',
  },
  { key: 'prata', label: 'Prata', stack: '"Prata", serif', bunnyName: 'prata', generic: 'serif' },
  {
    key: 'rufina',
    label: 'Rufina',
    stack: '"Rufina", serif',
    bunnyName: 'rufina',
    generic: 'serif',
  },
  {
    key: 'jetbrains-mono',
    label: 'JetBrains Mono',
    stack: '"JetBrains Mono", monospace',
    bunnyName: 'jetbrains-mono',
    generic: 'monospace',
  },
  {
    key: 'fira-mono',
    label: 'Fira Mono',
    stack: '"Fira Mono", monospace',
    bunnyName: 'fira-mono',
    generic: 'monospace',
  },
  {
    key: 'space-mono',
    label: 'Space Mono',
    stack: '"Space Mono", monospace',
    bunnyName: 'space-mono',
    generic: 'monospace',
  },
];

const FONT_BY_KEY = new Map<string, FontDef>(TEXT_FONTS.map((f) => [f.key, f]));

/** Resolve a font key to its CSS family stack, falling back to the system stack. */
export function fontStackFor(key: string): string {
  return FONT_BY_KEY.get(key)?.stack ?? SYSTEM_FONT_STACK;
}

/** Look up a font definition by key, or the default if unknown. */
export function fontDefFor(key: string): FontDef {
  return FONT_BY_KEY.get(key) ?? TEXT_FONTS[0];
}

/**
 * Build the CSS `font` shorthand for a text shape:
 * `"<style> <weight> <fontSize>px <stack>"`. The single source consumed by
 * the inline editor, canvas preview, bake, and `document.fonts.load`.
 * `scale` lets the editor render at the on-screen (zoomed) size.
 */
export function cssFontString(shape: TextShape, scale = 1): string {
  const style = shape.fontStyle === 'italic' ? 'italic ' : '';
  const weight = shape.fontWeight === 'bold' ? 'bold ' : '';
  const size = shape.fontSize * scale;
  return `${style}${weight}${size}px ${fontStackFor(shape.fontFamily)}`;
}
