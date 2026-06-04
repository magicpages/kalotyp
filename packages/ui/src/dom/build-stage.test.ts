import { describe, expect, it } from 'vitest';
import { buildStageElements } from './build-stage.js';

describe('buildStageElements', () => {
  it('creates one image canvas and one overlay canvas, in that z-order', () => {
    const stage = buildStageElements();
    const canvases = stage.container.querySelectorAll('canvas');
    expect(canvases).toHaveLength(2);
    expect(canvases[0]).toBe(stage.imageCanvas);
    expect(canvases[1]).toBe(stage.overlayCanvas);
  });

  it('renders eight crop-handle buttons', () => {
    const stage = buildStageElements();
    const buttons = stage.container.querySelectorAll('button.kalotyp-handle');
    expect(buttons).toHaveLength(8);
  });

  it('marks the four corner handles with data-shape="circle"', () => {
    const stage = buildStageElements();
    for (const direction of ['tl', 'tr', 'bl', 'br'] as const) {
      expect(stage.handles[direction].dataset.shape).toBe('circle');
      expect(stage.handles[direction].dataset.direction).toBe(direction);
    }
  });

  it('marks the four edge handles with data-shape="edge"', () => {
    const stage = buildStageElements();
    for (const direction of ['t', 'r', 'b', 'l'] as const) {
      expect(stage.handles[direction].dataset.shape).toBe('edge');
      expect(stage.handles[direction].dataset.direction).toBe(direction);
    }
  });

  it('tags handles with data-shape + data-direction attributes', () => {
    const stage = buildStageElements();
    expect(stage.container.querySelectorAll('.kalotyp-handle[data-shape~=circle]')).toHaveLength(4);
    expect(stage.container.querySelectorAll('.kalotyp-handle[data-shape=edge]')).toHaveLength(4);
    expect(stage.container.querySelector('.kalotyp-handle[data-direction=tr]')).not.toBeNull();
    expect(stage.container.querySelector('.kalotyp-handle[data-direction=bl]')).not.toBeNull();
    expect(stage.container.querySelector('.kalotyp-handle[data-direction=br]')).not.toBeNull();
  });

  it('gives every handle an accessible name', () => {
    const stage = buildStageElements();
    for (const button of Object.values(stage.handles)) {
      expect(button.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('wraps each corner button in a kalotyp-corner-anchor positioning context', () => {
    // Corner buttons are absolutely positioned with negative left/top offsets
    // relative to a per-corner anchor. Without the wrapper those offsets resolve
    // against the whole stage and three of the four corners get pushed off-screen.
    const stage = buildStageElements();
    expect(stage.container.querySelectorAll('.kalotyp-corner-anchor')).toHaveLength(4);
    for (const direction of ['tl', 'tr', 'bl', 'br'] as const) {
      const anchor = stage.cornerAnchors[direction];
      expect(anchor.dataset.direction).toBe(direction);
      expect(anchor.contains(stage.handles[direction])).toBe(true);
    }
  });
});
