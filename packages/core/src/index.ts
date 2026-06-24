/**
 * Public entry point for `@magicpages/kalotyp-core` — the package's
 * published API surface. Internal barrel files are forbidden (see
 * AGENTS.md); this root entry IS the published interface and is the
 * one intentional exception. Vite's library build tree-shakes through it.
 */

export {
  type BakeCanvas,
  bakeCanvasToBlob,
  canEncodeMime,
  createBakeCanvas,
  getBakeContext2D,
} from './canvas/bake-canvas.js';
export { type LoadedImage, loadImage } from './canvas/load-image.js';
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
export type { EventListener, Unsubscribe as EventUnsubscribe } from './events/event-bus.js';
export { EventBus } from './events/event-bus.js';

export {
  clampRectInside,
  type Point,
  pointInRect,
  type Rect,
  rectBottom,
  rectCenter,
  rectFromPoints,
  rectRight,
  rectsEqual,
  roundRect,
  type Size,
  translateClampedRect,
} from './geometry/rect.js';
export {
  HISTORY_MAX_ENTRIES,
  History,
  type SessionSnapshot,
  type UndoResult,
} from './history/history.js';
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
export {
  deriveOutputName,
  type EncodeOptions,
  encodeSourceImage,
  resolveOutputMime,
} from './pipeline/encode.js';
export { copyJpegExif } from './pipeline/exif.js';
export { type ChainLink, runUtilityChain } from './pipeline/run-chain.js';
export {
  type AnnotateBakeInput,
  bakeAnnotate,
  type PaintShapeOptions,
  paintShape,
  type ResolveEmojiImage,
} from './plugins/annotate/bake.js';
export {
  cssFontString,
  EMOJI_FONT_STACK,
  type FontDef,
  fontDefFor,
  fontStackFor,
  SYSTEM_FONT_STACK,
  TEXT_FONTS,
} from './plugins/annotate/fonts.js';
export {
  ALL_SELECTION_HANDLES,
  boundingBoxOf,
  rectFromHandleDrag,
  type SelectionHandle,
  selectionHandlePositions,
} from './plugins/annotate/geometry.js';
export {
  hitTest,
  PICK_TOLERANCE,
  pickShape,
} from './plugins/annotate/hit-test.js';
export {
  decimatePoints,
  MIN_SAMPLE_DISTANCE,
  tracePath,
} from './plugins/annotate/smooth.js';
export {
  type AnnotateState,
  type AnnotateTool,
  type ArrowShape,
  addShape,
  assertNever,
  type CreateCenteredShapeContext,
  createCenteredShape,
  DEFAULT_EMOJI,
  DEFAULT_FONT_KEY,
  DEFAULT_PALETTE_COLOR,
  DEFAULT_STROKE_WIDTH,
  defaultEmojiSize,
  defaultStylePalette,
  deleteShape,
  type EllipseShape,
  EMOJI_MIN_SIZE,
  type EmojiShape,
  FREEHAND_DEFAULT_STROKE,
  type FreehandShape,
  findShape,
  HIGHLIGHT_DEFAULT_COLOR,
  HIGHLIGHT_DEFAULT_STROKE,
  type HighlightShape,
  initialAnnotateState,
  isKeyboardPlaceableKind,
  KEYBOARD_PLACEABLE_KINDS,
  type KeyboardPlaceableKind,
  type KeyboardPlaceableShape,
  mintShapeId,
  mirrorShape,
  normaliseRectExtent,
  normalizeAngle,
  normalizeTextShape,
  type RectShape,
  replaceShape,
  rotateShape,
  type Shape,
  type ShapeKind,
  type StylePalette,
  selectShape,
  setActiveTool,
  setStyle,
  TEXT_DEFAULT_FONT_SIZE,
  type TextAlign,
  type TextFontStyle,
  type TextFontWeight,
  type TextShape,
  transformShapes,
  translateShape,
} from './plugins/annotate/state.js';
export {
  estimateLineWidth,
  layoutTextLines,
  lineOffset,
  type MeasureLine,
  TEXT_LINE_HEIGHT,
  type TextLayout,
  textLines,
} from './plugins/annotate/text-layout.js';
export {
  type AspectAnchor,
  applyAspectRatio,
  fitRectToBoundsWithRatio,
} from './plugins/crop/aspect-ratio.js';
export { bakeCrop, type CropBakeInput } from './plugins/crop/bake.js';
export {
  type CropPreset,
  type CropPresetFilter,
  filterPresets,
  isPresetVisible,
} from './plugins/crop/preset-filter.js';
export {
  type CornerHandle,
  type EdgeHandle,
  type HandleDirection,
  type ResizeOptions,
  resizeRectFromHandle,
} from './plugins/crop/resize.js';
export {
  applyPresetByIndex,
  type CropState,
  type InitialCropStateInput,
  initialCropState,
} from './plugins/crop/state.js';
export {
  FILTER_PRESETS,
  type FilterPreset,
  type FilterPresetId,
  findActivePreset,
  finetuneStatesEqual,
} from './plugins/filter/presets.js';
export { bakeFinetune } from './plugins/finetune/bake.js';
export {
  applyClarity,
  applyFinetuneLutAndSaturation,
  applyFinetuneToImageData,
  boxBlur3x3,
  buildFinetuneLut,
  type RasterImage,
} from './plugins/finetune/math.js';
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
export { bakeFlip } from './plugins/flip/bake.js';
export {
  type FlipState,
  initialFlipState,
  isFlipNoOp,
  toggleFlip,
} from './plugins/flip/state.js';
export { bakeFrame, frameOutputSize, paintInsideFrame } from './plugins/frame/bake.js';
export {
  DEFAULT_FRAME_STATE,
  FRAME_PRESET_IDS,
  FRAME_PRESETS,
  type FramePreset,
  type FramePresetId,
  type FrameState,
  findFramePreset,
  initialFrameState,
  isFrameNoOp,
  setFrameColor,
  setFramePreset,
} from './plugins/frame/state.js';
export {
  bakeRedact,
  paintRegion as paintRedactRegion,
  type RedactBakeInput,
} from './plugins/redact/bake.js';
export {
  addRegion,
  type CreateCenteredRegionContext as CreateCenteredRedactRegionContext,
  createCenteredRegion as createCenteredRedactRegion,
  DEFAULT_REDACT_COLOR,
  DEFAULT_REDACT_MODE,
  deleteRegion as deleteRedactRegion,
  findRegion as findRedactRegion,
  type InitialRedactStateInput,
  initialRedactState,
  mintRegionId,
  mirrorRegions as mirrorRedactRegions,
  normaliseRegionExtent as normaliseRedactExtent,
  REDACT_MODES,
  type RedactMode,
  type RedactRegion,
  type RedactState,
  regionBoundingBox,
  replaceRegion as replaceRedactRegion,
  revalidateAgainstBounds as revalidateRedactAgainstBounds,
  rotateRegions as rotateRedactRegions,
  selectedRegionOf as selectedRedactRegionOf,
  selectRegion as selectRedactRegion,
  setCurrentColor as setRedactCurrentColor,
  setCurrentMode as setRedactCurrentMode,
  setRegionColor as setRedactRegionColor,
  setRegionMode as setRedactRegionMode,
  translateRegions as translateRedactRegions,
} from './plugins/redact/state.js';
export { bakeResize } from './plugins/resize/bake.js';
export {
  effectivePercent,
  initialResizeState,
  isResizeNoOp,
  MAX_DIMENSION as RESIZE_MAX_DIMENSION,
  MIN_DIMENSION as RESIZE_MIN_DIMENSION,
  type ResizeState,
  resolveOutputSize,
  setHeightPx,
  setLockAspect,
  setPercent,
  setWidthPx,
} from './plugins/resize/state.js';
export { bakeRotate } from './plugins/rotate/bake.js';
export { largestInscribedRect } from './plugins/rotate/inscribe.js';
export {
  effectiveAngleDeg,
  FREE_ANGLE_MAX,
  FREE_ANGLE_MIN,
  FREE_ANGLE_STEP,
  initialRotateState,
  isRotateNoOp,
  type RotateState,
  rotateClockwise,
  rotateCounterClockwise,
  setFreeAngle,
} from './plugins/rotate/state.js';
export type {
  EditorEvents,
  SourceImage,
  UtilityContext,
  UtilityHandle,
  UtilityId,
  UtilityPlugin,
} from './plugins/utility.js';
export { createStore, type Store, type StoreListener } from './state/store.js';
