/**
 * Crop plugin under viewport zoom: at 0.5× / 1× / 2× / 4×, a pointer drag
 * on a handle yields the image-space rect equal to (on-screen distance) / scale.
 */

import {
  ViewportController,
  computeViewport,
  createStore,
  initialCropState,
  pointImageToDisplay,
} from '@magicpages/kalotyp-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountCropUtility } from './mount.js';

// jsdom lacks ResizeObserver and pointer-capture; stub both.
class StubResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { ResizeObserver: typeof StubResizeObserver }).ResizeObserver ??=
  StubResizeObserver;

const proto = HTMLElement.prototype as unknown as Record<string, () => void>;
if (typeof proto.setPointerCapture !== 'function') {
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
}

const SOURCE = {
  width: 4000,
  height: 3000,
  bitmap: undefined as unknown as CanvasImageSource,
  mimeType: 'image/png',
} as const;

const STAGE_BOUNDS = { width: 1280, height: 800 };
const STAGE_PADDING = 32;

function withStubbedBoundingRect<T>(width: number, height: number, body: () => T): T {
  // jsdom returns 0x0 from getBoundingClientRect by default — patch it for this scope.
  const original = HTMLElement.prototype.getBoundingClientRect;
  const stubRect: DOMRect = {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  };
  HTMLElement.prototype.getBoundingClientRect = () => stubRect;
  try {
    return body();
  } finally {
    HTMLElement.prototype.getBoundingClientRect = original;
  }
}

function dispatchPointer(
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientX: number,
  clientY: number,
  pointerId = 1,
): void {
  // jsdom's PointerEvent support is partial — MouseEvent + pointerId is enough for our handler.
  const evt = new MouseEvent(type, {
    clientX,
    clientY,
    button: 0,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(evt, 'pointerId', { value: pointerId });
  target.dispatchEvent(evt);
}

describe('crop plugin under viewport zoom', () => {
  let stageHost: HTMLElement;
  let utilHost: HTMLElement;

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

  for (const zoom of [0.5, 1, 2, 4]) {
    it(`a body translate at zoom ${zoom}× shifts the crop rect by (drag CSS px) ÷ scale image px`, () => {
      withStubbedBoundingRect(STAGE_BOUNDS.width, STAGE_BOUNDS.height, () => {
        const controller = new ViewportController({ zoom, panX: 0, panY: 0 });
        const initial = initialCropState({
          imageSize: { width: SOURCE.width, height: SOURCE.height },
          presets: [[undefined, 'Free'] as const],
          filter: undefined,
        });
        // Shrink to the central quarter so translate has room without hitting the image-bounds clamp.
        const store = createStore({
          ...initial,
          rect: {
            x: SOURCE.width / 4,
            y: SOURCE.height / 4,
            width: SOURCE.width / 2,
            height: SOURCE.height / 2,
          },
        });
        const handle = mountCropUtility({
          stageHost,
          utilHost,
          source: SOURCE as never,
          presets: [[undefined, 'Free'] as const],
          presetFilter: undefined,
          store,
          viewport: controller,
        });

        const bodyHitArea = stageHost.querySelector<HTMLElement>('.kalotyp-stage-body');
        expect(bodyHitArea).toBeTruthy();
        const target = bodyHitArea as HTMLElement;

        // 100px-right drag at the body's visible center; image-space delta should be 100 / scale.
        const initialRect = store.get().rect;
        const v = controller.computeViewport(
          { width: STAGE_BOUNDS.width, height: STAGE_BOUNDS.height, padding: STAGE_PADDING },
          { width: SOURCE.width, height: SOURCE.height },
        );
        const visibleCenter = pointImageToDisplay(
          { x: initialRect.x + initialRect.width / 2, y: initialRect.y + initialRect.height / 2 },
          v,
        );

        dispatchPointer(target, 'pointerdown', visibleCenter.x, visibleCenter.y);
        dispatchPointer(target, 'pointermove', visibleCenter.x + 100, visibleCenter.y);
        dispatchPointer(target, 'pointerup', visibleCenter.x + 100, visibleCenter.y);

        // pointerup drains the pendingPoint, so the rect is already settled here.
        const after = store.get().rect;

        const expectedDx = 100 / v.scale;
        expect(after.x - initialRect.x).toBeCloseTo(expectedDx, 1);
        expect(after.y - initialRect.y).toBeCloseTo(0, 5);

        handle.destroy();
      });
    });
  }

  it('the same on-screen drag produces 8× more image-space movement at zoom 0.5× than at zoom 4× — the visible benefit of zoom', () => {
    withStubbedBoundingRect(STAGE_BOUNDS.width, STAGE_BOUNDS.height, () => {
      const stage = {
        width: STAGE_BOUNDS.width,
        height: STAGE_BOUNDS.height,
        padding: STAGE_PADDING,
      };
      const image = { width: SOURCE.width, height: SOURCE.height };
      const v05 = computeViewport(stage, image, { zoom: 0.5, panX: 0, panY: 0 });
      const v4 = computeViewport(stage, image, { zoom: 4, panX: 0, panY: 0 });
      const dxAt05 = 100 / v05.scale;
      const dxAt4 = 100 / v4.scale;
      expect(dxAt05).toBeCloseTo(dxAt4 * 8);
    });
  });
});
