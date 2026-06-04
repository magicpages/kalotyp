/** Two independent axis flips; their composition equals a 180° rotation. */
export interface FlipState {
  readonly horizontal: boolean;
  readonly vertical: boolean;
}

export function initialFlipState(): FlipState {
  return { horizontal: false, vertical: false };
}

export function toggleFlip(state: FlipState, axis: 'horizontal' | 'vertical'): FlipState {
  return axis === 'horizontal'
    ? { ...state, horizontal: !state.horizontal }
    : { ...state, vertical: !state.vertical };
}

export function isFlipNoOp(state: FlipState): boolean {
  return !state.horizontal && !state.vertical;
}
