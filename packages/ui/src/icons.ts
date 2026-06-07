/**
 * Icon library sourced from Lucide (ISC). Each icon is a named import so the
 * bundler tree-shakes unused glyphs. We stringify nodes ourselves rather than
 * use Lucide's `createElement` to avoid pulling its DOM runtime into the bundle.
 */

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowRight,
  Bold as BoldIcon,
  Check as CheckIcon,
  ChevronDown,
  Circle as CircleIcon,
  X as CloseIcon,
  FlipHorizontal2,
  FlipVertical2,
  Highlighter,
  Italic as ItalicIcon,
  Keyboard as KeyboardIcon,
  Link2,
  Link2Off,
  MousePointer2,
  Pencil,
  Plus as PlusIcon,
  Redo2,
  Settings as SettingsIcon,
  Square,
  Trash2,
  Type as TypeIcon,
  Undo2,
} from 'lucide';

type IconNode = ReadonlyArray<readonly [string, Record<string, string | number>]>;

const DEFAULT_SVG_ATTRS: Record<string, string | number> = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
};

/** Stringify a Lucide icon node to inline SVG markup. */
export function iconHtml(node: IconNode, attrs: Record<string, string | number> = {}): string {
  const merged = { ...DEFAULT_SVG_ATTRS, ...attrs };
  const svgAttrs = Object.entries(merged)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  const children = node
    .map(([tag, a]) => {
      const childAttrs = Object.entries(a)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      return `<${tag} ${childAttrs} />`;
    })
    .join('');
  return `<svg ${svgAttrs}>${children}</svg>`;
}

export type IconName =
  | 'select'
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'freehand'
  | 'highlight'
  | 'undo'
  | 'redo'
  | 'close'
  | 'delete'
  | 'check'
  | 'lockClosed'
  | 'lockOpen'
  | 'plus'
  | 'flipHorizontal'
  | 'flipVertical'
  | 'chevronDown'
  | 'settings'
  | 'keyboard'
  | 'bold'
  | 'italic'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight';

function resolve(name: IconName): IconNode {
  switch (name) {
    case 'select':
      return MousePointer2 as IconNode;
    case 'text':
      return TypeIcon as IconNode;
    case 'rect':
      return Square as IconNode;
    case 'ellipse':
      return CircleIcon as IconNode;
    case 'arrow':
      return ArrowRight as IconNode;
    case 'freehand':
      return Pencil as IconNode;
    case 'highlight':
      return Highlighter as IconNode;
    case 'undo':
      return Undo2 as IconNode;
    case 'redo':
      return Redo2 as IconNode;
    case 'close':
      return CloseIcon as IconNode;
    case 'delete':
      return Trash2 as IconNode;
    case 'check':
      return CheckIcon as IconNode;
    case 'lockClosed':
      return Link2 as IconNode;
    case 'lockOpen':
      return Link2Off as IconNode;
    case 'plus':
      return PlusIcon as IconNode;
    case 'flipHorizontal':
      return FlipHorizontal2 as IconNode;
    case 'flipVertical':
      return FlipVertical2 as IconNode;
    case 'chevronDown':
      return ChevronDown as IconNode;
    case 'settings':
      return SettingsIcon as IconNode;
    case 'keyboard':
      return KeyboardIcon as IconNode;
    case 'bold':
      return BoldIcon as IconNode;
    case 'italic':
      return ItalicIcon as IconNode;
    case 'alignLeft':
      return AlignLeft as IconNode;
    case 'alignCenter':
      return AlignCenter as IconNode;
    case 'alignRight':
      return AlignRight as IconNode;
  }
}

/** Render an icon by name. */
export function icon(name: IconName, attrs?: Record<string, string | number>): string {
  return iconHtml(resolve(name), attrs);
}
