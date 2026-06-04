import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REDACT_COLOR,
  DEFAULT_REDACT_MODE,
  REDACT_MODES,
  type RedactRegion,
  addRegion,
  createCenteredRegion,
  deleteRegion,
  findRegion,
  initialRedactState,
  mintRegionId,
  mirrorRegions,
  normaliseRegionExtent,
  replaceRegion,
  revalidateAgainstBounds,
  rotateRegions,
  selectRegion,
  selectedRegionOf,
  setCurrentColor,
  setCurrentMode,
  setRegionColor,
  setRegionMode,
  translateRegions,
} from './state.js';

const IMAGE = { width: 800, height: 600 } as const;

function makeRegion(overrides: Partial<RedactRegion> = {}): RedactRegion {
  return {
    id: 'r_1',
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    mode: DEFAULT_REDACT_MODE,
    color: DEFAULT_REDACT_COLOR,
    ...overrides,
  };
}

describe('redact state', () => {
  it('initial state has no regions and the default mode/colour', () => {
    const state = initialRedactState({ imageSize: IMAGE });
    expect(state.regions).toEqual([]);
    expect(state.selectedId).toBeNull();
    expect(state.currentMode).toBe(DEFAULT_REDACT_MODE);
    expect(state.currentColor).toBe(DEFAULT_REDACT_COLOR);
    expect(state.imageSize).toEqual(IMAGE);
    expect(state.nextRegionNumber).toBe(1);
  });

  it('mintRegionId yields unique base-36 ids and increments the counter', () => {
    let state = initialRedactState({ imageSize: IMAGE });
    const a = mintRegionId(state);
    state = { ...state, nextRegionNumber: a.nextRegionNumber };
    const b = mintRegionId(state);
    expect(a.id).toBe('r_1');
    expect(b.id).toBe('r_2');
    expect(b.nextRegionNumber).toBe(3);
  });

  it('addRegion appends the region and selects it', () => {
    const state = initialRedactState({ imageSize: IMAGE });
    const region = makeRegion();
    const next = addRegion(state, region);
    expect(next.regions).toEqual([region]);
    expect(next.selectedId).toBe(region.id);
  });

  it('replaceRegion swaps an existing region in place; missing ids no-op', () => {
    const a = makeRegion();
    let state = addRegion(initialRedactState({ imageSize: IMAGE }), a);
    const updated = { ...a, x: 50 };
    state = replaceRegion(state, updated);
    expect(state.regions[0]?.x).toBe(50);
    const noop = replaceRegion(state, makeRegion({ id: 'r_unknown' }));
    expect(noop).toBe(state);
  });

  it('deleteRegion removes the region and clears selection if it pointed at the gone region', () => {
    const a = makeRegion({ id: 'r_1' });
    const b = makeRegion({ id: 'r_2' });
    let state = addRegion(initialRedactState({ imageSize: IMAGE }), a);
    state = addRegion(state, b);
    state = selectRegion(state, 'r_1');
    state = deleteRegion(state, 'r_1');
    expect(state.regions.map((r) => r.id)).toEqual(['r_2']);
    expect(state.selectedId).toBeNull();
  });

  it('setCurrentMode and setCurrentColor are no-ops when value matches', () => {
    const state = initialRedactState({ imageSize: IMAGE });
    expect(setCurrentMode(state, state.currentMode)).toBe(state);
    expect(setCurrentColor(state, state.currentColor)).toBe(state);
    const updated = setCurrentMode(state, 'solid');
    expect(updated.currentMode).toBe('solid');
  });

  it('setRegionMode updates the matched region; unknown id no-ops', () => {
    const region = makeRegion({ mode: 'pixelate' });
    let state = addRegion(initialRedactState({ imageSize: IMAGE }), region);
    state = setRegionMode(state, region.id, 'solid');
    expect(state.regions[0]?.mode).toBe('solid');
    const noop = setRegionMode(state, 'r_unknown', 'blur');
    expect(noop).toBe(state);
    const same = setRegionMode(state, region.id, 'solid');
    expect(same).toBe(state);
  });

  it('setRegionColor updates the matched region', () => {
    const region = makeRegion({ color: '#000000' });
    let state = addRegion(initialRedactState({ imageSize: IMAGE }), region);
    state = setRegionColor(state, region.id, '#ffffff');
    expect(state.regions[0]?.color).toBe('#ffffff');
  });

  it('findRegion / selectedRegionOf return undefined / null when nothing is selected', () => {
    const state = initialRedactState({ imageSize: IMAGE });
    expect(findRegion(state, null)).toBeUndefined();
    expect(selectedRegionOf(state)).toBeNull();
  });

  it('normaliseRegionExtent flips negative-extent rects', () => {
    expect(normaliseRegionExtent({ x: 100, y: 100, width: -50, height: -40 })).toEqual({
      x: 50,
      y: 60,
      width: 50,
      height: 40,
    });
    expect(normaliseRegionExtent({ x: 0, y: 0, width: 10, height: 10 })).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
  });

  it('createCenteredRegion picks a 25%-of-shorter-edge box centred on the image', () => {
    const region = createCenteredRegion({
      imageSize: IMAGE,
      mode: 'pixelate',
      color: '#000000',
      id: 'r_1',
    });
    expect(region.width).toBe(150);
    expect(region.height).toBe(150);
    expect(region.x).toBe(325);
    expect(region.y).toBe(225);
    expect(region.mode).toBe('pixelate');
  });

  it('createCenteredRegion floors at 80px on tiny images', () => {
    const region = createCenteredRegion({
      imageSize: { width: 200, height: 200 },
      mode: 'pixelate',
      color: '#000000',
      id: 'r_1',
    });
    expect(region.width).toBe(80);
    expect(region.height).toBe(80);
  });

  it('REDACT_MODES enumerates exactly the three modes', () => {
    expect([...REDACT_MODES]).toEqual(['pixelate', 'blur', 'solid']);
  });

  describe('revalidateAgainstBounds', () => {
    it('drops regions whose box is entirely outside the new bounds', () => {
      const offscreen = makeRegion({ id: 'r_1', x: 1000, y: 1000, width: 100, height: 100 });
      const inside = makeRegion({ id: 'r_2', x: 50, y: 50, width: 100, height: 100 });
      let state = addRegion(initialRedactState({ imageSize: IMAGE }), offscreen);
      state = addRegion(state, inside);
      const next = revalidateAgainstBounds(state, { width: 500, height: 500 });
      expect(next.regions.map((r) => r.id)).toEqual(['r_2']);
      expect(next.imageSize).toEqual({ width: 500, height: 500 });
    });

    it('clamps regions that overlap the new bounds partially', () => {
      const region = makeRegion({ x: 400, y: 400, width: 200, height: 200 });
      let state = addRegion(initialRedactState({ imageSize: IMAGE }), region);
      state = revalidateAgainstBounds(state, { width: 500, height: 500 });
      const out = state.regions[0];
      expect(out).toBeDefined();
      expect(out?.x).toBe(400);
      expect(out?.y).toBe(400);
      expect(out?.width).toBe(100);
      expect(out?.height).toBe(100);
    });

    it('clears selectedId if the selected region was dropped', () => {
      const offscreen = makeRegion({ id: 'r_off', x: 1000, y: 1000, width: 50, height: 50 });
      let state = addRegion(initialRedactState({ imageSize: IMAGE }), offscreen);
      state = selectRegion(state, 'r_off');
      const next = revalidateAgainstBounds(state, { width: 500, height: 500 });
      expect(next.selectedId).toBeNull();
    });

    it('returns the same state when nothing changed', () => {
      const state = initialRedactState({ imageSize: IMAGE });
      const next = revalidateAgainstBounds(state, IMAGE);
      expect(next).toBe(state);
    });
  });

  describe('upstream cascade helpers', () => {
    it('mirrorRegions horizontally flips each region around the image centre', () => {
      let state = initialRedactState({ imageSize: IMAGE });
      state = addRegion(state, makeRegion({ id: 'r_a', x: 100, y: 50, width: 200, height: 100 }));
      const next = mirrorRegions(state, 'horizontal', IMAGE);
      const region = next.regions[0];
      expect(region?.x).toBe(800 - 100 - 200);
      expect(region?.y).toBe(50);
      expect(region?.width).toBe(200);
      expect(region?.height).toBe(100);
    });

    it('mirrorRegions vertically flips each region around the image centre', () => {
      let state = initialRedactState({ imageSize: IMAGE });
      state = addRegion(state, makeRegion({ id: 'r_a', x: 100, y: 50, width: 200, height: 100 }));
      const next = mirrorRegions(state, 'vertical', IMAGE);
      const region = next.regions[0];
      expect(region?.x).toBe(100);
      expect(region?.y).toBe(600 - 50 - 100);
    });

    it('mirrorRegions is a no-op when there are no regions', () => {
      const state = initialRedactState({ imageSize: IMAGE });
      const next = mirrorRegions(state, 'horizontal', IMAGE);
      expect(next.regions).toBe(state.regions);
    });

    it('translateRegions shifts every region by (dx, dy)', () => {
      let state = initialRedactState({ imageSize: IMAGE });
      state = addRegion(state, makeRegion({ id: 'r_a', x: 100, y: 100, width: 200, height: 150 }));
      const next = translateRegions(state, -30, 10, { width: 770, height: 610 });
      expect(next.regions[0]?.x).toBe(70);
      expect(next.regions[0]?.y).toBe(110);
      expect(next.imageSize).toEqual({ width: 770, height: 610 });
    });

    it('rotateRegions 90° CW remaps coords and swaps width/height', () => {
      let state = initialRedactState({ imageSize: IMAGE });
      state = addRegion(state, makeRegion({ id: 'r_a', x: 100, y: 50, width: 200, height: 100 }));
      const next = rotateRegions(state, 1, { width: 600, height: 800 });
      const r = next.regions[0];
      expect(r?.x).toBe(450);
      expect(r?.y).toBe(100);
      expect(r?.width).toBe(100);
      expect(r?.height).toBe(200);
      expect(next.imageSize).toEqual({ width: 600, height: 800 });
    });

    it('rotateRegions 180° flips both axes', () => {
      let state = initialRedactState({ imageSize: IMAGE });
      state = addRegion(state, makeRegion({ id: 'r_a', x: 100, y: 50, width: 200, height: 100 }));
      const next = rotateRegions(state, 2, IMAGE);
      const r = next.regions[0];
      expect(r?.x).toBe(800 - 100 - 200);
      expect(r?.y).toBe(600 - 50 - 100);
      expect(r?.width).toBe(200);
      expect(r?.height).toBe(100);
    });

    it('rotateRegions 0 turns is a no-op for coords (only updates imageSize)', () => {
      let state = initialRedactState({ imageSize: IMAGE });
      state = addRegion(state, makeRegion({ id: 'r_a' }));
      const next = rotateRegions(state, 0, IMAGE);
      expect(next.regions).toBe(state.regions);
    });
  });
});
