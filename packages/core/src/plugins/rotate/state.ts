/**
 * Independent quarter-turns (lossless 90° CW) and free angle (±45°).
 * Bake applies `quarterTurns * 90° + freeAngle` so a press of "rotate 90°"
 * doesn't reset a straighten correction and vice versa.
 */
export interface RotateState {
  readonly quarterTurns: 0 | 1 | 2 | 3;
  /** Free-angle offset in degrees. Range: [-45, 45]. */
  readonly freeAngle: number;
}

export const FREE_ANGLE_MIN = -45;
export const FREE_ANGLE_MAX = 45;
export const FREE_ANGLE_STEP = 0.1;

export function initialRotateState(): RotateState {
  return { quarterTurns: 0, freeAngle: 0 };
}

export function rotateClockwise(state: RotateState): RotateState {
  return { ...state, quarterTurns: ((state.quarterTurns + 1) % 4) as 0 | 1 | 2 | 3 };
}

export function rotateCounterClockwise(state: RotateState): RotateState {
  return { ...state, quarterTurns: ((state.quarterTurns + 3) % 4) as 0 | 1 | 2 | 3 };
}

export function setFreeAngle(state: RotateState, angleDeg: number): RotateState {
  const clamped = clamp(angleDeg, FREE_ANGLE_MIN, FREE_ANGLE_MAX);
  // Snap to 0.1° to match the slider step and avoid sub-step float noise.
  const snapped = Math.round(clamped * 10) / 10;
  return { ...state, freeAngle: snapped };
}

export function isRotateNoOp(state: RotateState): boolean {
  return state.quarterTurns === 0 && Math.abs(state.freeAngle) < 1e-6;
}

/** Effective rotation applied during bake, in degrees clockwise. */
export function effectiveAngleDeg(state: RotateState): number {
  return state.quarterTurns * 90 + state.freeAngle;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
