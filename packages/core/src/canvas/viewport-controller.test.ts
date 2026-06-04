import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM, ViewportController } from './viewport-controller.js';
import { IDENTITY_VIEWPORT_TRANSFORM } from './viewport.js';

describe('ViewportController', () => {
  it('initialises at identity', () => {
    const c = new ViewportController();
    expect(c.getTransform()).toEqual(IDENTITY_VIEWPORT_TRANSFORM);
    expect(c.getPinching()).toBe(false);
  });

  it('clamps an out-of-range initial zoom', () => {
    const tooHigh = new ViewportController({ zoom: 1000, panX: 0, panY: 0 });
    expect(tooHigh.getTransform().zoom).toBe(MAX_ZOOM);
    const tooLow = new ViewportController({ zoom: 0.001, panX: 0, panY: 0 });
    expect(tooLow.getTransform().zoom).toBe(MIN_ZOOM);
  });

  it('emits a change exactly once per setTransform call', () => {
    const c = new ViewportController();
    let calls = 0;
    c.subscribe(() => calls++);
    c.setTransform({ zoom: 2, panX: 0, panY: 0 });
    c.setTransform({ zoom: 2, panX: 0, panY: 0 }); // no-op
    c.setTransform({ zoom: 3, panX: 50, panY: -25 });
    expect(calls).toBe(2);
  });

  it('zoomAt anchors the pinch midpoint to the same image-space point', () => {
    const c = new ViewportController();
    const stageCenter = { x: 500, y: 500 };
    c.zoomAt(2, { x: 750, y: 500 }, stageCenter);
    const t = c.getTransform();
    expect(t.zoom).toBe(2);
    expect(t.panX).toBeCloseTo(-250);
    expect(t.panY).toBeCloseTo(0);
  });

  it('zoomAt at the zoom cap is a no-op', () => {
    const c = new ViewportController({ zoom: MAX_ZOOM, panX: 0, panY: 0 });
    let calls = 0;
    c.subscribe(() => calls++);
    c.zoomAt(2, { x: 100, y: 100 }, { x: 200, y: 200 });
    expect(calls).toBe(0);
    expect(c.getTransform().zoom).toBe(MAX_ZOOM);
  });

  it('zoomAt clamps below MIN_ZOOM on a wheel-zoom-out', () => {
    const c = new ViewportController({ zoom: 0.5, panX: 0, panY: 0 });
    c.zoomAt(0.1, { x: 0, y: 0 }, { x: 100, y: 100 });
    expect(c.getTransform().zoom).toBe(MIN_ZOOM);
  });

  it('panBy stores raw pan (clamping is at viewport-emission time)', () => {
    const c = new ViewportController({ zoom: 2, panX: 0, panY: 0 });
    c.panBy(1000, -2000);
    expect(c.getTransform().panX).toBe(1000);
    expect(c.getTransform().panY).toBe(-2000);
  });

  it('resetToFit returns to identity', () => {
    const c = new ViewportController({ zoom: 4, panX: 100, panY: 50 });
    c.resetToFit();
    expect(c.getTransform()).toEqual(IDENTITY_VIEWPORT_TRANSFORM);
  });

  it('resetPan clears pan but keeps zoom', () => {
    const c = new ViewportController({ zoom: 3, panX: 100, panY: 50 });
    c.resetPan();
    expect(c.getTransform()).toEqual({ zoom: 3, panX: 0, panY: 0 });
  });

  it('setPinching emits a change observable to subscribers', () => {
    const c = new ViewportController();
    let lastSnapshot = c.getSnapshot();
    c.subscribe((snapshot) => {
      lastSnapshot = snapshot;
    });
    c.setPinching(true);
    expect(lastSnapshot.pinching).toBe(true);
    c.setPinching(true); // no-op
    c.setPinching(false);
    expect(lastSnapshot.pinching).toBe(false);
  });

  it('subscribe returns an unsubscribe that drops the listener', () => {
    const c = new ViewportController();
    let calls = 0;
    const off = c.subscribe(() => calls++);
    c.setTransform({ zoom: 2, panX: 0, panY: 0 });
    off();
    c.setTransform({ zoom: 3, panX: 0, panY: 0 });
    expect(calls).toBe(1);
  });

  it('clear drops all listeners', () => {
    const c = new ViewportController();
    let calls = 0;
    c.subscribe(() => calls++);
    c.subscribe(() => calls++);
    c.clear();
    c.setTransform({ zoom: 2, panX: 0, panY: 0 });
    expect(calls).toBe(0);
  });

  it('computeViewport returns a viewport reflecting the current transform', () => {
    const c = new ViewportController();
    const stage = { width: 1000, height: 1000, padding: 0 };
    const image = { width: 1000, height: 1000 };
    const fit = c.computeViewport(stage, image);
    expect(fit.scale).toBeCloseTo(1);
    expect(fit.displayRect.x).toBeCloseTo(0);

    c.setTransform({ zoom: 2, panX: 0, panY: 0 });
    const zoomed = c.computeViewport(stage, image);
    expect(zoomed.scale).toBeCloseTo(2);
    expect(zoomed.displayRect.width).toBeCloseTo(2000);
  });
});
