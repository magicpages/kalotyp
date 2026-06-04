import {
  type CropPreset,
  type Rect,
  createStore,
  initialCropState,
} from '@magicpages/kalotyp-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountCropUtility } from './mount.js';

// jsdom lacks ResizeObserver.
class StubResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { ResizeObserver: typeof StubResizeObserver }).ResizeObserver ??=
  StubResizeObserver;

const presets: readonly CropPreset[] = [
  [undefined, 'Custom'],
  [1, 'Square'],
];

function makeSource() {
  // A bare `<canvas>` stands in for a SourceImage — mount only reads width/height here.
  const bitmap = document.createElement('canvas');
  bitmap.width = 800;
  bitmap.height = 600;
  return { bitmap, width: 800, height: 600, mimeType: 'image/png' };
}

describe('crop dimensions inputs — keyboard alternative', () => {
  let stageHost: HTMLDivElement;
  let utilHost: HTMLDivElement;

  beforeEach(() => {
    stageHost = document.createElement('div');
    utilHost = document.createElement('div');
    document.body.appendChild(stageHost);
    document.body.appendChild(utilHost);
  });

  afterEach(() => {
    stageHost.remove();
    utilHost.remove();
  });

  it('renders four labelled inputs (Left/Top/Width/Height) inside a labelled group', () => {
    const source = makeSource();
    const store = createStore(initialCropState({ imageSize: source, presets, filter: undefined }));
    const handle = mountCropUtility({
      stageHost,
      utilHost,
      source,
      presets,
      presetFilter: undefined,
      store,
    });

    const group = utilHost.querySelector('.kalotyp-crop-dims');
    expect(group?.getAttribute('role')).toBe('group');
    expect(group?.getAttribute('aria-label')).toBe('Crop region dimensions');

    const inputs = utilHost.querySelectorAll<HTMLInputElement>('.kalotyp-crop-dims-input');
    expect(inputs.length).toBe(4);
    const labels = Array.from(inputs).map((i) => i.getAttribute('aria-label'));
    expect(labels).toEqual(['Left (pixels)', 'Top (pixels)', 'Width (pixels)', 'Height (pixels)']);
    expect(inputs[0]?.valueAsNumber).toBe(0);
    expect(inputs[1]?.valueAsNumber).toBe(0);
    expect(inputs[2]?.valueAsNumber).toBe(800);
    expect(inputs[3]?.valueAsNumber).toBe(600);

    handle.destroy();
  });

  it('updates the store rect when an input commits', () => {
    const source = makeSource();
    const store = createStore(initialCropState({ imageSize: source, presets, filter: undefined }));
    const handle = mountCropUtility({
      stageHost,
      utilHost,
      source,
      presets,
      presetFilter: undefined,
      store,
    });

    const inputs = utilHost.querySelectorAll<HTMLInputElement>('.kalotyp-crop-dims-input');
    const widthInput = inputs[2] as HTMLInputElement;
    widthInput.value = '400';
    widthInput.dispatchEvent(new Event('change'));

    const next: Rect = store.get().rect;
    expect(next.width).toBe(400);

    handle.destroy();
  });

  it('clamps out-of-bounds typed values to the image size', () => {
    const source = makeSource();
    const store = createStore(initialCropState({ imageSize: source, presets, filter: undefined }));
    const handle = mountCropUtility({
      stageHost,
      utilHost,
      source,
      presets,
      presetFilter: undefined,
      store,
    });

    const inputs = utilHost.querySelectorAll<HTMLInputElement>('.kalotyp-crop-dims-input');
    const widthInput = inputs[2] as HTMLInputElement;
    widthInput.value = '9999';
    widthInput.dispatchEvent(new Event('change'));

    expect(store.get().rect.width).toBeLessThanOrEqual(800);

    handle.destroy();
  });

  it('reflects pointer-driven rect changes back into the inputs', () => {
    const source = makeSource();
    const store = createStore(initialCropState({ imageSize: source, presets, filter: undefined }));
    const handle = mountCropUtility({
      stageHost,
      utilHost,
      source,
      presets,
      presetFilter: undefined,
      store,
    });

    store.set({ rect: { x: 100, y: 50, width: 400, height: 300 } });

    const inputs = utilHost.querySelectorAll<HTMLInputElement>('.kalotyp-crop-dims-input');
    expect(inputs[0]?.valueAsNumber).toBe(100);
    expect(inputs[1]?.valueAsNumber).toBe(50);
    expect(inputs[2]?.valueAsNumber).toBe(400);
    expect(inputs[3]?.valueAsNumber).toBe(300);

    handle.destroy();
  });
});
