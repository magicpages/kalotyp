/**
 * Public entry point for `@magicpages/kalotyp-core` — the package's
 * published API surface. Internal barrel files are forbidden (see
 * AGENTS.md); this root entry IS the published interface and is the
 * one intentional exception. Vite's library build tree-shakes through it.
 */
export { EventBus } from './events/event-bus.js';
export type { EventListener, Unsubscribe as EventUnsubscribe } from './events/event-bus.js';

export { loadImage, type LoadedImage } from './canvas/load-image.js';
export {
  computeViewport,
  IDENTITY_VIEWPORT_TRANSFORM,
  pointDisplayToImage,
  pointImageToDisplay,
  rectDisplayToImage,
  rectImageToDisplay,
  type StageDimensions,
  type Viewport,
  type ViewportTransform,
} from './canvas/viewport.js';
export {
  MAX_ZOOM,
  MIN_ZOOM,
  ViewportController,
  type ViewportControllerListener,
  type ViewportControllerSnapshot,
} from './canvas/viewport-controller.js';
export {
  bakeCanvasToBlob,
  canEncodeMime,
  createBakeCanvas,
  getBakeContext2D,
  type BakeCanvas,
} from './canvas/bake-canvas.js';

export {
  clampRectInside,
  pointInRect,
  rectBottom,
  rectCenter,
  rectFromPoints,
  rectRight,
  rectsEqual,
  roundRect,
  translateClampedRect,
  type Point,
  type Rect,
  type Size,
} from './geometry/rect.js';

export { createStore, type Store, type StoreListener } from './state/store.js';

export {
  History,
  HISTORY_MAX_ENTRIES,
  type SessionSnapshot,
  type UndoResult,
} from './history/history.js';

export type {
  EditorEvents,
  SourceImage,
  UtilityContext,
  UtilityHandle,
  UtilityId,
  UtilityPlugin,
} from './plugins/utility.js';

export {
  applyAspectRatio,
  fitRectToBoundsWithRatio,
  type AspectAnchor,
} from './plugins/crop/aspect-ratio.js';
export {
  resizeRectFromHandle,
  type CornerHandle,
  type EdgeHandle,
  type HandleDirection,
  type ResizeOptions,
} from './plugins/crop/resize.js';
export {
  filterPresets,
  isPresetVisible,
  type CropPreset,
  type CropPresetFilter,
} from './plugins/crop/preset-filter.js';
export {
  applyPresetByIndex,
  initialCropState,
  type CropState,
  type InitialCropStateInput,
} from './plugins/crop/state.js';
export { bakeCrop, type CropBakeInput } from './plugins/crop/bake.js';

export {
  deriveOutputName,
  encodeSourceImage,
  resolveOutputMime,
  type EncodeOptions,
} from './pipeline/encode.js';
export {
  clampQuality,
  DEFAULT_OUTPUT_STATE,
  ENCODABLE_MIMES,
  type OutputMimeChoice,
  type OutputState,
  setOutputMime,
  setOutputQuality,
  setStripMetadata,
} from './output/state.js';
export { copyJpegExif } from './pipeline/exif.js';
export { runUtilityChain, type ChainLink } from './pipeline/run-chain.js';

export {
  initialFlipState,
  isFlipNoOp,
  toggleFlip,
  type FlipState,
} from './plugins/flip/state.js';
export { bakeFlip } from './plugins/flip/bake.js';

export {
  effectiveAngleDeg,
  FREE_ANGLE_MAX,
  FREE_ANGLE_MIN,
  FREE_ANGLE_STEP,
  initialRotateState,
  isRotateNoOp,
  rotateClockwise,
  rotateCounterClockwise,
  setFreeAngle,
  type RotateState,
} from './plugins/rotate/state.js';
export { bakeRotate } from './plugins/rotate/bake.js';
export { largestInscribedRect } from './plugins/rotate/inscribe.js';

export {
  effectivePercent,
  initialResizeState,
  isResizeNoOp,
  MAX_DIMENSION as RESIZE_MAX_DIMENSION,
  MIN_DIMENSION as RESIZE_MIN_DIMENSION,
  resolveOutputSize,
  setHeightPx,
  setLockAspect,
  setPercent,
  setWidthPx,
  type ResizeState,
} from './plugins/resize/state.js';
export { bakeResize } from './plugins/resize/bake.js';

export {
  DEFAULT_FINETUNE_STATE,
  FINETUNE_ADJUSTMENTS,
  FINETUNE_MAX,
  FINETUNE_MIN,
  FINETUNE_STEP,
  type FinetuneKey,
  type FinetuneState,
  initialFinetuneState,
  isFinetuneNoOp,
  resetAllFinetune,
  resetFinetune,
  setFinetune,
} from './plugins/finetune/state.js';
export {
  applyClarity,
  applyFinetuneLutAndSaturation,
  applyFinetuneToImageData,
  boxBlur3x3,
  buildFinetuneLut,
  type RasterImage,
} from './plugins/finetune/math.js';
export { bakeFinetune } from './plugins/finetune/bake.js';

export {
  FILTER_PRESETS,
  type FilterPreset,
  type FilterPresetId,
  findActivePreset,
  finetuneStatesEqual,
} from './plugins/filter/presets.js';

export {
  type AnnotateState,
  type AnnotateTool,
  type ArrowShape,
  type CreateCenteredShapeContext,
  type EllipseShape,
  type FreehandShape,
  type HighlightShape,
  type KeyboardPlaceableKind,
  type KeyboardPlaceableShape,
  type RectShape,
  type Shape,
  type ShapeKind,
  type StylePalette,
  type TextShape,
  addShape,
  assertNever,
  createCenteredShape,
  defaultStylePalette,
  deleteShape,
  DEFAULT_PALETTE_COLOR,
  DEFAULT_STROKE_WIDTH,
  findShape,
  FREEHAND_DEFAULT_STROKE,
  HIGHLIGHT_DEFAULT_COLOR,
  HIGHLIGHT_DEFAULT_STROKE,
  initialAnnotateState,
  isKeyboardPlaceableKind,
  KEYBOARD_PLACEABLE_KINDS,
  mintShapeId,
  mirrorShape,
  normaliseRectExtent,
  replaceShape,
  rotateShape,
  selectShape,
  setActiveTool,
  setStyle,
  TEXT_DEFAULT_FONT_SIZE,
  transformShapes,
  translateShape,
} from './plugins/annotate/state.js';
export {
  ALL_SELECTION_HANDLES,
  alignToOrigin,
  boundingBoxOf,
  estimateTextSize,
  rectFromHandleDrag,
  selectionHandlePositions,
  type SelectionHandle,
} from './plugins/annotate/geometry.js';
export {
  hitTest,
  pickShape,
  PICK_TOLERANCE,
} from './plugins/annotate/hit-test.js';
export {
  decimatePoints,
  MIN_SAMPLE_DISTANCE,
  tracePath,
} from './plugins/annotate/smooth.js';
export {
  bakeAnnotate,
  paintShape,
  SYSTEM_FONT_STACK,
  type AnnotateBakeInput,
} from './plugins/annotate/bake.js';

export {
  type CreateCenteredRegionContext as CreateCenteredRedactRegionContext,
  DEFAULT_REDACT_COLOR,
  DEFAULT_REDACT_MODE,
  type InitialRedactStateInput,
  REDACT_MODES,
  type RedactMode,
  type RedactRegion,
  type RedactState,
  addRegion,
  createCenteredRegion as createCenteredRedactRegion,
  deleteRegion as deleteRedactRegion,
  findRegion as findRedactRegion,
  initialRedactState,
  mintRegionId,
  mirrorRegions as mirrorRedactRegions,
  normaliseRegionExtent as normaliseRedactExtent,
  regionBoundingBox,
  replaceRegion as replaceRedactRegion,
  revalidateAgainstBounds as revalidateRedactAgainstBounds,
  rotateRegions as rotateRedactRegions,
  selectRegion as selectRedactRegion,
  selectedRegionOf as selectedRedactRegionOf,
  setCurrentColor as setRedactCurrentColor,
  setCurrentMode as setRedactCurrentMode,
  setRegionColor as setRedactRegionColor,
  setRegionMode as setRedactRegionMode,
  translateRegions as translateRedactRegions,
} from './plugins/redact/state.js';
export {
  bakeRedact,
  paintRegion as paintRedactRegion,
  type RedactBakeInput,
} from './plugins/redact/bake.js';

export {
  DEFAULT_FRAME_STATE,
  FRAME_PRESETS,
  FRAME_PRESET_IDS,
  type FramePreset,
  type FramePresetId,
  type FrameState,
  findFramePreset,
  initialFrameState,
  isFrameNoOp,
  setFrameColor,
  setFramePreset,
} from './plugins/frame/state.js';
export { bakeFrame, frameOutputSize, paintInsideFrame } from './plugins/frame/bake.js';
