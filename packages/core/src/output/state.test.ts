import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OUTPUT_STATE,
  ENCODABLE_MIMES,
  clampQuality,
  setOutputMime,
  setOutputQuality,
  setStripMetadata,
} from './state.js';

describe('OutputState mutators', () => {
  it('default state is auto-mime at 85% quality with metadata stripping on', () => {
    expect(DEFAULT_OUTPUT_STATE).toEqual({
      mimeChoice: 'auto',
      quality: 0.85,
      stripMetadata: true,
    });
  });

  it('setStripMetadata flips the flag and is a no-op when unchanged', () => {
    expect(setStripMetadata(DEFAULT_OUTPUT_STATE, true)).toBe(DEFAULT_OUTPUT_STATE);
    const next = setStripMetadata(DEFAULT_OUTPUT_STATE, false);
    expect(next.stripMetadata).toBe(false);
    expect(next.mimeChoice).toBe('auto');
    expect(next.quality).toBe(0.85);
  });

  it('lists the four concrete encodable mimes', () => {
    expect([...ENCODABLE_MIMES]).toEqual(['image/png', 'image/jpeg', 'image/webp', 'image/avif']);
  });

  it('clampQuality bounds within [0, 1] and replaces non-finite with default', () => {
    expect(clampQuality(0.5)).toBe(0.5);
    expect(clampQuality(-0.1)).toBe(0);
    expect(clampQuality(2)).toBe(1);
    expect(clampQuality(Number.NaN)).toBe(0.85);
    expect(clampQuality(Number.POSITIVE_INFINITY)).toBe(0.85);
  });

  it('setOutputMime is a no-op when the value matches', () => {
    expect(setOutputMime(DEFAULT_OUTPUT_STATE, 'auto')).toBe(DEFAULT_OUTPUT_STATE);
    const next = setOutputMime(DEFAULT_OUTPUT_STATE, 'image/webp');
    expect(next.mimeChoice).toBe('image/webp');
    expect(next.quality).toBe(0.85);
  });

  it('setOutputQuality clamps and is a no-op when the value matches', () => {
    expect(setOutputQuality(DEFAULT_OUTPUT_STATE, 0.85)).toBe(DEFAULT_OUTPUT_STATE);
    const next = setOutputQuality(DEFAULT_OUTPUT_STATE, 0.7);
    expect(next.quality).toBe(0.7);
    expect(next.mimeChoice).toBe('auto');
    const clamped = setOutputQuality(DEFAULT_OUTPUT_STATE, 1.5);
    expect(clamped.quality).toBe(1);
  });
});
