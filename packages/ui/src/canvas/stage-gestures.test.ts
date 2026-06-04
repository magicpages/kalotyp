import { ViewportController } from '@magicpages/kalotyp-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { attachStageGestures } from './stage-gestures.js';

function stubStageRect(stage: HTMLElement, width: number, height: number): void {
  Object.defineProperty(stage, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON() {
        return {};
      },
    }),
  });
}

function dispatch(
  target: HTMLElement,
  type: string,
  init: {
    clientX?: number;
    clientY?: number;
    pointerId?: number;
    deltaY?: number;
    ctrlKey?: boolean;
  },
): void {
  const event =
    type === 'wheel'
      ? new WheelEvent(type, {
          clientX: init.clientX ?? 0,
          clientY: init.clientY ?? 0,
          deltaY: init.deltaY ?? 0,
          ctrlKey: init.ctrlKey ?? false,
          bubbles: true,
          cancelable: true,
        })
      : (() => {
          const e = new MouseEvent(type, {
            clientX: init.clientX ?? 0,
            clientY: init.clientY ?? 0,
            button: 0,
            bubbles: true,
            cancelable: true,
          });
          if (init.pointerId !== undefined) {
            Object.defineProperty(e, 'pointerId', { value: init.pointerId });
          }
          Object.defineProperty(e, 'pointerType', { value: 'touch' });
          return e;
        })();
  target.dispatchEvent(event);
}

describe('attachStageGestures', () => {
  let stage: HTMLElement;
  let controller: ViewportController;
  let cleanup: () => void;

  beforeEach(() => {
    stage = document.createElement('div');
    stubStageRect(stage, 1000, 800);
    document.body.appendChild(stage);
    controller = new ViewportController();
    cleanup = attachStageGestures(stage, controller);
  });

  afterEach(() => {
    cleanup();
    stage.remove();
  });

  it('a wheel-up event applies a small zoom-in centered on the cursor', () => {
    dispatch(stage, 'wheel', { clientX: 500, clientY: 400, deltaY: -100 });
    const t = controller.getTransform();
    expect(t.zoom).toBeGreaterThan(1);
    expect(t.panX).toBeCloseTo(0);
    expect(t.panY).toBeCloseTo(0);
  });

  it('a wheel-up event off-center anchors zoom to the cursor (introduces pan)', () => {
    dispatch(stage, 'wheel', { clientX: 800, clientY: 400, deltaY: -50 });
    const t = controller.getTransform();
    expect(t.zoom).toBeGreaterThan(1);
    expect(t.panX).toBeLessThan(0);
    expect(t.panY).toBeCloseTo(0);
  });

  it('a wheel-down event zooms out', () => {
    dispatch(stage, 'wheel', { clientX: 500, clientY: 400, deltaY: 100 });
    const t = controller.getTransform();
    expect(t.zoom).toBeLessThan(1);
  });

  it('two simultaneous pointerdown events flip pinching=true; one up clears it', () => {
    expect(controller.getPinching()).toBe(false);
    dispatch(stage, 'pointerdown', { clientX: 400, clientY: 400, pointerId: 1 });
    expect(controller.getPinching()).toBe(false);
    dispatch(stage, 'pointerdown', { clientX: 600, clientY: 400, pointerId: 2 });
    expect(controller.getPinching()).toBe(true);
    dispatch(stage, 'pointerup', { clientX: 600, clientY: 400, pointerId: 2 });
    expect(controller.getPinching()).toBe(false);
  });

  it('a two-finger pinch outward zooms in centered on the midpoint', () => {
    dispatch(stage, 'pointerdown', { clientX: 450, clientY: 400, pointerId: 1 });
    dispatch(stage, 'pointerdown', { clientX: 550, clientY: 400, pointerId: 2 });
    // Sequential per-pointer moves drift the midpoint slightly — assert dominant zoom + bounded pan.
    dispatch(stage, 'pointermove', { clientX: 400, clientY: 400, pointerId: 1 });
    dispatch(stage, 'pointermove', { clientX: 600, clientY: 400, pointerId: 2 });
    const t = controller.getTransform();
    expect(t.zoom).toBeCloseTo(2);
    expect(Math.abs(t.panX)).toBeLessThan(50);
    expect(Math.abs(t.panY)).toBeLessThan(50);
  });

  it('a two-finger pan (parallel motion) drives pan without changing zoom', () => {
    dispatch(stage, 'pointerdown', { clientX: 400, clientY: 400, pointerId: 1 });
    dispatch(stage, 'pointerdown', { clientX: 600, clientY: 400, pointerId: 2 });
    dispatch(stage, 'pointermove', { clientX: 450, clientY: 400, pointerId: 1 });
    dispatch(stage, 'pointermove', { clientX: 650, clientY: 400, pointerId: 2 });
    const t = controller.getTransform();
    expect(t.zoom).toBeCloseTo(1);
    expect(t.panX).toBeCloseTo(50);
    expect(t.panY).toBeCloseTo(0);
  });

  it('cleanup removes the listeners; subsequent events are ignored', () => {
    cleanup();
    dispatch(stage, 'wheel', { clientX: 500, clientY: 400, deltaY: -100 });
    expect(controller.getTransform().zoom).toBe(1);
  });
});
