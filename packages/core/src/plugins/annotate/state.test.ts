import { describe, expect, it } from 'vitest';
import {
  type ArrowShape,
  addShape,
  createCenteredShape,
  DEFAULT_EMOJI,
  defaultEmojiSize,
  defaultStylePalette,
  deleteShape,
  type EllipseShape,
  EMOJI_MIN_SIZE,
  type EmojiShape,
  findShape,
  initialAnnotateState,
  isKeyboardPlaceableKind,
  KEYBOARD_PLACEABLE_KINDS,
  mintShapeId,
  mirrorShape,
  normaliseRectExtent,
  normalizeTextShape,
  type RectShape,
  replaceShape,
  rotateShape,
  type Shape,
  selectShape,
  setActiveTool,
  setStyle,
  type TextShape,
  translateShape,
} from './state.js';

function makeEmoji(
  id: string,
  x = 100,
  y = 100,
  size = 80,
  emoji = '😀',
  rotation = 0,
): EmojiShape {
  return { id, kind: 'emoji', x, y, emoji, size, rotation };
}

const baseInit = { imageSize: { width: 1000, height: 800 } };

function makeRect(id: string, x = 100, y = 100, w = 50, h = 30): RectShape {
  return {
    id,
    kind: 'rect',
    x,
    y,
    width: w,
    height: h,
    strokeColor: '#000',
    strokeWidth: 2,
    fillColor: null,
  };
}

describe('annotate state', () => {
  it('initialises with empty shapes, no selection, select tool, default palette', () => {
    const state = initialAnnotateState(baseInit);
    expect(state.shapes).toEqual([]);
    expect(state.selectedId).toBeNull();
    expect(state.activeTool).toBe('select');
    expect(state.currentStyle).toEqual(defaultStylePalette());
    expect(state.imageSize).toEqual(baseInit.imageSize);
  });

  it('mintShapeId returns base36 ids and a fresh nextShapeNumber', () => {
    const state = initialAnnotateState(baseInit);
    const a = mintShapeId(state);
    expect(a.id).toBe('s_1');
    expect(a.nextShapeNumber).toBe(2);
    const next = mintShapeId({ ...state, nextShapeNumber: a.nextShapeNumber });
    expect(next.id).toBe('s_2');
  });

  it('addShape selects the added shape', () => {
    const state = initialAnnotateState(baseInit);
    const next = addShape(state, makeRect('s_1'));
    expect(next.shapes).toHaveLength(1);
    expect(next.selectedId).toBe('s_1');
  });

  it('deleteShape clears the selection if the deleted shape was selected', () => {
    let state = initialAnnotateState(baseInit);
    state = addShape(state, makeRect('s_1'));
    state = deleteShape(state, 's_1');
    expect(state.shapes).toEqual([]);
    expect(state.selectedId).toBeNull();
  });

  it('deleteShape leaves selection alone if a different shape is deleted', () => {
    let state = initialAnnotateState(baseInit);
    state = addShape(state, makeRect('s_1'));
    state = addShape(state, makeRect('s_2'));
    state = selectShape(state, 's_2');
    state = deleteShape(state, 's_1');
    expect(state.shapes.map((s) => s.id)).toEqual(['s_2']);
    expect(state.selectedId).toBe('s_2');
  });

  it('replaceShape leaves order intact and skips when id is unknown', () => {
    let state = initialAnnotateState(baseInit);
    state = addShape(state, makeRect('s_1', 0, 0));
    state = addShape(state, makeRect('s_2', 0, 0));
    state = replaceShape(state, makeRect('s_1', 50, 50));
    expect(state.shapes[0]).toMatchObject({ id: 's_1', x: 50, y: 50 });
    expect(state.shapes[1]?.id).toBe('s_2');

    const unchanged = replaceShape(state, makeRect('s_99', 99, 99));
    expect(unchanged).toBe(state);
  });

  it('findShape returns undefined for null and unknown ids', () => {
    let state = initialAnnotateState(baseInit);
    state = addShape(state, makeRect('s_1'));
    expect(findShape(state, null)).toBeUndefined();
    expect(findShape(state, 's_99')).toBeUndefined();
    expect(findShape(state, 's_1')?.id).toBe('s_1');
  });

  it('setActiveTool deselects when switching to a drawing tool', () => {
    let state = initialAnnotateState(baseInit);
    state = addShape(state, makeRect('s_1'));
    state = setActiveTool(state, 'rect');
    expect(state.activeTool).toBe('rect');
    expect(state.selectedId).toBeNull();
  });

  it('setActiveTool keeps selection when switching to select', () => {
    let state = initialAnnotateState(baseInit);
    state = addShape(state, makeRect('s_1'));
    state = setActiveTool(state, 'select');
    expect(state.selectedId).toBe('s_1');
  });

  it('setStyle merges into currentStyle', () => {
    const state = initialAnnotateState(baseInit);
    const next = setStyle(state, { color: '#ff0', strokeWidth: 8 });
    expect(next.currentStyle.color).toBe('#ff0');
    expect(next.currentStyle.strokeWidth).toBe(8);
    expect(next.currentStyle.fontSize).toBe(state.currentStyle.fontSize);
  });

  it('normaliseRectExtent flips negatives so width/height are non-negative', () => {
    expect(normaliseRectExtent({ x: 100, y: 100, width: -40, height: -30 })).toEqual({
      x: 60,
      y: 70,
      width: 40,
      height: 30,
    });
    expect(normaliseRectExtent({ x: 0, y: 0, width: 10, height: 10 })).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
  });

  it('translateShape moves text/rect/ellipse/arrow/freehand/highlight by dx/dy', () => {
    const text: Shape = {
      id: 't',
      kind: 'text',
      x: 10,
      y: 20,
      text: 'hi',
      fontSize: 24,
      color: '#000',
      textAlign: 'left',
      fontFamily: 'system',
      fontWeight: 'normal',
      fontStyle: 'normal',
    };
    const arrow: Shape = {
      id: 'a',
      kind: 'arrow',
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 100,
      color: '#000',
      strokeWidth: 4,
    };
    const free: Shape = {
      id: 'f',
      kind: 'freehand',
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
      color: '#000',
      strokeWidth: 4,
    };
    expect(translateShape(text, 5, 7)).toMatchObject({ x: 15, y: 27 });
    expect(translateShape(arrow, 1, 2)).toMatchObject({ x1: 1, y1: 2, x2: 101, y2: 102 });
    expect((translateShape(free, 1, 1) as typeof free).points).toEqual([
      { x: 1, y: 1 },
      { x: 6, y: 6 },
    ]);
  });

  describe('createCenteredShape (keyboard placement)', () => {
    const style = defaultStylePalette();

    it('lists the keyboard-placeable kinds and excludes freehand/highlight', () => {
      expect([...KEYBOARD_PLACEABLE_KINDS].sort()).toEqual(
        ['arrow', 'ellipse', 'emoji', 'rect', 'text'].sort(),
      );
      expect(isKeyboardPlaceableKind('rect')).toBe(true);
      expect(isKeyboardPlaceableKind('text')).toBe(true);
      expect(isKeyboardPlaceableKind('emoji')).toBe(true);
      expect(isKeyboardPlaceableKind('freehand')).toBe(false);
      expect(isKeyboardPlaceableKind('highlight')).toBe(false);
    });

    it('places a rect centred in image space, sized to ~25% of the shorter edge', () => {
      const shape = createCenteredShape('rect', {
        imageSize: { width: 1000, height: 800 },
        style,
        id: 's_1',
      }) as RectShape;
      expect(shape.kind).toBe('rect');
      expect(shape).toMatchObject({ x: 400, y: 300, width: 200, height: 200 });
      expect(shape.strokeColor).toBe(style.color);
      expect(shape.strokeWidth).toBe(style.strokeWidth);
    });

    it('places an ellipse with the same bbox geometry as the rect default', () => {
      const shape = createCenteredShape('ellipse', {
        imageSize: { width: 1000, height: 800 },
        style,
        id: 's_2',
      }) as EllipseShape;
      expect(shape).toMatchObject({ x: 400, y: 300, width: 200, height: 200, kind: 'ellipse' });
    });

    it('places a horizontal arrow centred on the image', () => {
      const shape = createCenteredShape('arrow', {
        imageSize: { width: 1000, height: 800 },
        style,
        id: 's_3',
      }) as ArrowShape;
      expect(shape.kind).toBe('arrow');
      expect(shape.y1).toBe(shape.y2);
      expect(shape.x2 - shape.x1).toBe(240);
      expect(shape.x1).toBe(380);
      expect(shape.x2).toBe(620);
      expect(shape.y1).toBe(400);
    });

    it('places an empty text anchor at image centre with the palette style', () => {
      const shape = createCenteredShape('text', {
        imageSize: { width: 1000, height: 800 },
        style,
        id: 's_4',
      }) as TextShape;
      expect(shape.kind).toBe('text');
      expect(shape.text).toBe('');
      expect(shape.fontSize).toBe(style.fontSize);
      expect(shape.textAlign).toBe(style.textAlign);
      expect(shape.fontFamily).toBe(style.fontFamily);
      expect(shape.fontWeight).toBe(style.fontWeight);
      expect(shape.fontStyle).toBe(style.fontStyle);
      expect(shape.x).toBe(500);
      expect(shape.y).toBe(400 - Math.round(style.fontSize / 2));
    });

    it('floors the default size on tiny images so the shape stays usable', () => {
      const shape = createCenteredShape('rect', {
        imageSize: { width: 100, height: 80 },
        style,
        id: 's_t',
      }) as RectShape;
      expect(shape.width).toBe(80);
      expect(shape.height).toBe(80);
    });

    it('places the armed emoji as a centred square sized to ~20% of the shorter edge', () => {
      const shape = createCenteredShape('emoji', {
        imageSize: { width: 1000, height: 800 },
        style: { ...style, emoji: '🚀' },
        id: 's_5',
      }) as EmojiShape;
      expect(shape.kind).toBe('emoji');
      expect(shape.emoji).toBe('🚀');
      // 20% of the 800px short edge = 160.
      expect(shape.size).toBe(160);
      expect(shape.x).toBe(Math.round(500 - 160 / 2));
      expect(shape.y).toBe(Math.round(400 - 160 / 2));
      expect(shape.rotation).toBe(0);
    });

    it('defaultEmojiSize floors at 64px on tiny images', () => {
      expect(defaultEmojiSize({ width: 1000, height: 800 })).toBe(160);
      expect(defaultEmojiSize({ width: 100, height: 80 })).toBe(64);
    });
  });

  describe('emoji shape', () => {
    it('seeds the default emoji in the style palette', () => {
      expect(defaultStylePalette().emoji).toBe(DEFAULT_EMOJI);
    });

    it('translateShape moves an emoji by dx/dy', () => {
      expect(translateShape(makeEmoji('e', 100, 100, 80), 5, 7)).toMatchObject({
        x: 105,
        y: 107,
        size: 80,
      });
    });

    it('mirrors an emoji box so it straddles the same pixels (glyph not flipped)', () => {
      const dims = { width: 1000, height: 800 };
      const h = mirrorShape(
        makeEmoji('e', 100, 50, 80, '😀', 90),
        'horizontal',
        dims,
      ) as EmojiShape;
      // Reflection negates the spin direction; box repositions.
      expect(h).toMatchObject({ x: 1000 - 100 - 80, y: 50, size: 80, emoji: '😀', rotation: 270 });
      const v = mirrorShape(makeEmoji('e', 100, 50, 80, '😀', 90), 'vertical', dims) as EmojiShape;
      expect(v).toMatchObject({ x: 100, y: 800 - 50 - 80, size: 80, rotation: 90 });
    });

    it('rotates an emoji 90° CW keeping it square, advancing its angle', () => {
      const oldDims = { width: 1000, height: 800 };
      const next = rotateShape(makeEmoji('e', 100, 50, 80, '😀', 30), 1, oldDims) as EmojiShape;
      expect(next.size).toBe(80);
      // 90° CW maps the box corners (100,50)/(180,130) to a square; the new
      // top-left is the min of the rotated corners.
      expect(next.x).toBe(800 - 130);
      expect(next.y).toBe(100);
      // The glyph's own rotation advances with the image (30 + 90).
      expect(next.rotation).toBe(120);
    });

    it('exposes a non-zero minimum emoji size', () => {
      expect(EMOJI_MIN_SIZE).toBeGreaterThan(0);
    });
  });

  describe('mirrorShape', () => {
    const dims = { width: 1000, height: 800 };

    it('mirrors a rect horizontally across the image centre', () => {
      const rect = makeRect('r_1', 100, 50, 200, 100);
      const next = mirrorShape(rect, 'horizontal', dims) as RectShape;
      expect(next.x).toBe(1000 - 100 - 200);
      expect(next.y).toBe(50);
      expect(next.width).toBe(200);
      expect(next.height).toBe(100);
    });

    it('mirrors an arrow vertically point-by-point', () => {
      const arrow: ArrowShape = {
        id: 'a_1',
        kind: 'arrow',
        x1: 100,
        y1: 200,
        x2: 400,
        y2: 50,
        color: '#000',
        strokeWidth: 2,
      };
      const next = mirrorShape(arrow, 'vertical', dims) as ArrowShape;
      expect(next.x1).toBe(100);
      expect(next.y1).toBe(800 - 200);
      expect(next.x2).toBe(400);
      expect(next.y2).toBe(800 - 50);
    });

    it('mirrors freehand points across the requested axis', () => {
      const shape: Shape = {
        id: 'f_1',
        kind: 'freehand',
        color: '#000',
        strokeWidth: 2,
        points: [
          { x: 100, y: 200 },
          { x: 110, y: 210 },
        ],
      };
      const next = mirrorShape(shape, 'horizontal', dims);
      if (next.kind !== 'freehand') throw new Error('expected freehand');
      expect(next.points[0]).toEqual({ x: 900, y: 200 });
      expect(next.points[1]).toEqual({ x: 890, y: 210 });
    });
  });

  describe('rotateShape', () => {
    const oldDims = { width: 1000, height: 800 };

    it('rotates a rect 90° CW, swapping width and height', () => {
      const rect = makeRect('r_1', 100, 50, 200, 100);
      const next = rotateShape(rect, 1, oldDims) as RectShape;
      expect(next.x).toBe(650);
      expect(next.y).toBe(100);
      expect(next.width).toBe(100);
      expect(next.height).toBe(200);
    });

    it('rotates an arrow 180°', () => {
      const arrow: ArrowShape = {
        id: 'a_1',
        kind: 'arrow',
        x1: 100,
        y1: 200,
        x2: 400,
        y2: 50,
        color: '#000',
        strokeWidth: 2,
      };
      const next = rotateShape(arrow, 2, oldDims) as ArrowShape;
      expect(next.x1).toBe(900);
      expect(next.y1).toBe(600);
      expect(next.x2).toBe(600);
      expect(next.y2).toBe(750);
    });

    it('rotates 0 turns is identity', () => {
      const rect = makeRect('r_1', 100, 50, 200, 100);
      const next = rotateShape(rect, 0, oldDims);
      expect(next).toBe(rect);
    });
  });
});

describe('normalizeTextShape', () => {
  const complete: TextShape = {
    id: 't',
    kind: 'text',
    x: 0,
    y: 0,
    text: 'hi',
    fontSize: 20,
    color: '#000',
    textAlign: 'left',
    fontFamily: 'inter',
    fontWeight: 'bold',
    fontStyle: 'italic',
  };

  it('returns a complete shape unchanged (same reference)', () => {
    expect(normalizeTextShape(complete)).toBe(complete);
  });

  it('fills missing font fields with defaults', () => {
    // Simulate a stale shape lacking the new fields.
    const stale = {
      id: 't',
      kind: 'text',
      x: 0,
      y: 0,
      text: 'hi',
      fontSize: 20,
      color: '#000',
      textAlign: 'left',
    } as unknown as TextShape;
    const fixed = normalizeTextShape(stale);
    expect(fixed.fontFamily).toBe('system');
    expect(fixed.fontWeight).toBe('normal');
    expect(fixed.fontStyle).toBe('normal');
  });
});
