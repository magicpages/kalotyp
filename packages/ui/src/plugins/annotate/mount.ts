/**
 * Mount the annotation plugin's stage UI and wire up:
 *   - the three layered canvases (image / shapes / live);
 *   - the bottom panel (tool toolbar + style controls);
 *   - pointer dispatch (drawing tools vs select tool);
 *   - selection handles + per-handle resize gestures;
 *   - the inline text editor;
 *   - keyboard shortcuts (Delete/Backspace to remove the selected
 *     shape; Esc to deselect).
 *
 * The mount keeps two pieces of derived state at module scope:
 *
 *   - `viewport` — the current letterbox of the upstream-baked source
 *     into the stage. Recomputed on every stage resize.
 *   - `liveShape` — the in-progress shape during a draw or move
 *     gesture. `null` when no gesture is active.
 */

import {
  type AnnotateState,
  type AnnotateTool,
  addShape,
  boundingBoxOf,
  computeViewport,
  createCenteredShape,
  deleteShape,
  isKeyboardPlaceableKind,
  mintShapeId,
  type Point,
  pickShape,
  pointDisplayToImage,
  replaceShape,
  type Shape,
  type SourceImage,
  type Store,
  selectShape,
  setActiveTool,
  setStyle,
  TEXT_DEFAULT_FONT_SIZE,
  type TextShape,
  translateShape,
  type Viewport,
  type ViewportController,
} from '@magicpages/kalotyp-core';
import { buildCoordInputs } from './coord-inputs.js';
import { ensureAnnotateFontsLoaded } from './fonts-loader.js';
import { type AnnotatePanel, buildAnnotatePanel } from './panel.js';
import { attachPointerDrag, clientToElement, type DragHandlers } from './pointer-drag.js';
import { paintImageLayer, paintLiveLayer, paintMarqueeLayer, paintShapesLayer } from './render.js';
import { buildSelectionLayer, selectedShapeOf } from './selection.js';
import { buildAnnotateStage } from './stage.js';
import { buildTextEditor } from './text-editor.js';
import {
  startArrowGesture,
  startBodyMoveGesture,
  startEllipseGesture,
  startFreehandGesture,
  startRectGesture,
  type ToolGestureContext,
} from './tools.js';

const STAGE_PADDING_PX = 32;

export interface MountAnnotateOptions {
  readonly stageHost: HTMLElement;
  readonly utilHost: HTMLElement;
  readonly source: SourceImage;
  readonly store: Store<AnnotateState>;
  /** Editor-level zoom + pan controller. Optional in jsdom tests. */
  readonly viewport?: ViewportController;
  /** Called after each user-meaningful annotation mutation. */
  readonly onCommit?: () => void;
  /**
   * Optional live-region announcer. The annotate plugin
   * uses it for state changes that don't move keyboard focus —
   * notably Esc-deselect, where the screen reader would otherwise
   * have no cue that the selection went away.
   */
  readonly onAnnounce?: (message: string) => void;
}

export interface MountAnnotateHandle {
  destroy(): void;
}

export function mountAnnotateUtility(options: MountAnnotateOptions): MountAnnotateHandle {
  const { stageHost, utilHost, source, store, viewport: controller } = options;
  const commit = options.onCommit ?? (() => {});
  const announce = options.onAnnounce ?? (() => {});

  const stage = buildAnnotateStage();
  stageHost.appendChild(stage.container);

  let viewport: Viewport = computeViewport(
    { width: 1, height: 1, padding: STAGE_PADDING_PX },
    { width: source.width, height: source.height },
  );
  let liveShape: Shape | null = null;
  let liveMarquee: { x: number; y: number; width: number; height: number } | null = null;

  function recomputeViewport(): void {
    const rect = stage.container.getBoundingClientRect();
    const stageDims = { width: rect.width, height: rect.height, padding: STAGE_PADDING_PX };
    const imageSize = { width: source.width, height: source.height };
    viewport = controller
      ? controller.computeViewport(stageDims, imageSize)
      : computeViewport(stageDims, imageSize);
  }

  function paintAll(): void {
    const rect = stage.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    paintImageLayer(stage.imageCanvas, source, rect.width, rect.height, viewport);
    paintShapesLayer(stage.shapesCanvas, store.get().shapes, rect.width, rect.height, viewport);
    paintLiveLayer(stage.liveCanvas, liveShape, rect.width, rect.height, viewport);
    selectionLayer.update(shapeForHandles(store.get()), viewport);
    repositionOpenEditor();
  }

  /**
   * Keep the open text editor's overlay aligned with the SAME `viewport` the
   * canvas just painted with. Activating the text tool grows the panel (the
   * font/size/style row), which shrinks the stage and recomputes the viewport
   * scale; without this, the editor would keep the scale captured at open time
   * while the canvas repaints at the new scale — the caret and the painted
   * glyphs would drift apart.
   */
  function repositionOpenEditor(): void {
    if (editingTextId === null) return;
    const editing = store.get().shapes.find((s) => s.id === editingTextId);
    if (editing?.kind === 'text') textEditor.restyle(editing, viewport);
  }

  /**
   * The selected shape to draw handles for, or `null` while the text editor is
   * open — the editing text shows its own glyphs on the canvas (the editor
   * overlay is transparent), and we don't want a handle frame around it.
   */
  function shapeForHandles(state: AnnotateState): Shape | null {
    if (editingTextId !== null) return null;
    return selectedShapeOf(state);
  }

  function paintShapes(): void {
    const rect = stage.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    paintShapesLayer(stage.shapesCanvas, store.get().shapes, rect.width, rect.height, viewport);
  }

  function paintLive(): void {
    const rect = stage.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    if (liveMarquee !== null) {
      paintMarqueeLayer(stage.liveCanvas, liveMarquee, rect.width, rect.height, viewport);
    } else {
      paintLiveLayer(stage.liveCanvas, liveShape, rect.width, rect.height, viewport);
    }
  }

  function setLiveShape(shape: Shape | null): void {
    liveShape = shape;
    liveMarquee = null;
    paintLive();
  }

  function setLiveMarquee(
    rect: { x: number; y: number; width: number; height: number } | null,
  ): void {
    liveMarquee = rect;
    liveShape = null;
    paintLive();
  }

  // Project a raw client-space pointer to the upstream-baked source's
  // image-space pixels. Used by every gesture factory.
  function toImageSpace(point: { clientX: number; clientY: number }): Point {
    const stagePoint = clientToElement(stage.container, point.clientX, point.clientY);
    return pointDisplayToImage(stagePoint, viewport);
  }

  const toolContext: ToolGestureContext = {
    store,
    toImageSpace,
    setLiveShape,
    commit,
  };

  // ----- Selection layer (handles + per-handle resize) -----
  const selectionLayer = buildSelectionLayer({
    host: stage.handlesLayer,
    stageElement: stage.container,
    toolContext,
    getViewport: () => viewport,
  });

  // ----- Inline text editor -----
  // Id of the text shape currently open in the inline editor, or null. While
  // editing, that shape is NOT painted on the shapes canvas and its selection
  // handles are suppressed — so the only thing the user sees is the editor
  // itself (one box, WYSIWYG), not the editor stacked over the painted text.
  let editingTextId: string | null = null;
  const textEditor = buildTextEditor({
    host: stage.textOverlay,
    onInput: (text) => {
      const selected = selectedShapeOf(store.get());
      if (selected?.kind !== 'text') return;
      store.update((current) => replaceShape(current, { ...selected, text }));
    },
    onCommit: () => {
      const selected = selectedShapeOf(store.get());
      editingTextId = null;
      textEditor.close();
      // Drop the text shape entirely if the user committed an empty
      // string — a blank text shape has no representation.
      if (selected?.kind === 'text' && selected.text.trim().length === 0) {
        store.update((current) => deleteShape(current, selected.id));
      }
      commit();
      // Switch back to select so subsequent clicks pick existing
      // shapes rather than spawning a fresh empty text.
      store.update((current) => setActiveTool(current, 'select'));
    },
    onCancel: () => {
      const selected = selectedShapeOf(store.get());
      editingTextId = null;
      textEditor.close();
      // If the user cancelled an empty text (the click that created
      // it), drop the shape so we don't pollute the list.
      if (selected?.kind === 'text' && selected.text.length === 0) {
        store.update((current) => deleteShape(current, selected.id));
      }
      store.update((current) => setActiveTool(current, 'select'));
    },
  });

  // ----- Pointer dispatch on the hit area -----
  const removeHitDrag = attachPointerDrag(stage.hitArea, (event) => {
    const state = store.get();
    switch (state.activeTool) {
      case 'select':
        return startSelectGesture(state, event);
      case 'rect':
        return startRectGesture(toolContext, event);
      case 'ellipse':
        return startEllipseGesture(toolContext, event);
      case 'arrow':
        return startArrowGesture(toolContext, event);
      case 'freehand':
        return startFreehandGesture(toolContext, event, { kind: 'freehand' });
      case 'highlight':
        return startFreehandGesture(toolContext, event, { kind: 'highlight' });
      case 'text': {
        // Text doesn't use the drag pipeline — handle it inline.
        startTextGesture(event);
        return null;
      }
      default:
        return null;
    }
  });

  function startSelectGesture(state: AnnotateState, event: PointerEvent): DragHandlers | null {
    const image = toImageSpace(event);
    const picked = pickShape(state.shapes, image);
    if (!picked) {
      // Empty space → start a marquee. The marquee renders as a
      // dashed rectangle on the live canvas; on commit, it picks
      // the topmost shape whose bounding box intersects the
      // marquee. A no-move tap (start === end) deselects.
      return startMarqueeGesture(event);
    }
    // If the picked shape is already selected, drag it. Otherwise
    // select it first; the same drag continues through the move. The select
    // tool only selects/moves — it never enters text edit. Re-editing a text
    // shape is done with the Text tool (click it to reopen the editor).
    if (state.selectedId !== picked.id) {
      store.update((current) => selectShape(current, picked.id));
    }
    return startBodyMoveGesture(toolContext, event, picked.id, picked, translateShape, (next) =>
      store.update((current) => replaceShape(current, next)),
    );
  }

  function startMarqueeGesture(event: PointerEvent): DragHandlers {
    const startImage = toImageSpace(event);
    let lastImage = startImage;
    return {
      onMove(point) {
        lastImage = toImageSpace(point);
        setLiveMarquee({
          x: startImage.x,
          y: startImage.y,
          width: lastImage.x - startImage.x,
          height: lastImage.y - startImage.y,
        });
      },
      onCommit() {
        setLiveMarquee(null);
        // No-move click: just deselect.
        const dx = lastImage.x - startImage.x;
        const dy = lastImage.y - startImage.y;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
          store.update((current) => selectShape(current, null));
          return;
        }
        const marquee = normaliseExtent({
          x: startImage.x,
          y: startImage.y,
          width: dx,
          height: dy,
        });
        const hit = topmostShapeIntersectingMarquee(store.get().shapes, marquee);
        store.update((current) => selectShape(current, hit?.id ?? null));
      },
      onCancel() {
        setLiveMarquee(null);
      },
    };
  }

  function startTextGesture(event: PointerEvent): void {
    const state = store.get();
    const image = toImageSpace(event);
    // Clicking an existing text box re-opens its editor instead of spawning a
    // new one — so the text tool both creates and edits, and a click never
    // stacks a second box on top of an existing one.
    const picked = pickShape(state.shapes, image);
    if (picked?.kind === 'text') {
      if (state.selectedId !== picked.id) {
        store.update((current) => selectShape(current, picked.id));
      }
      openTextEditor(picked);
      return;
    }
    const { id, nextShapeNumber } = mintShapeId(state);
    const shape: TextShape = {
      id,
      kind: 'text',
      x: image.x,
      y: image.y,
      text: '',
      fontSize: state.currentStyle.fontSize ?? TEXT_DEFAULT_FONT_SIZE,
      color: state.currentStyle.color,
      textAlign: state.currentStyle.textAlign,
      fontFamily: state.currentStyle.fontFamily,
      fontWeight: state.currentStyle.fontWeight,
      fontStyle: state.currentStyle.fontStyle,
    };
    store.update((current) => ({ ...addShape(current, shape), nextShapeNumber }));
    // The shape is selected by `addShape`; open the editor on it.
    openTextEditor(shape);
  }

  /**
   * Open the transparent input overlay on a text shape and suppress the
   * selection handles while editing. The shape keeps rendering on the canvas
   * (the overlay's own text is transparent), so the glyphs you edit are the
   * same ones that bake — no jump on commit.
   */
  function openTextEditor(shape: TextShape): void {
    editingTextId = shape.id;
    textEditor.open(shape, viewport, source);
    selectionLayer.update(null, viewport);
  }

  /**
   * Place the active drawing tool's default-sized shape at image
   * centre and select it. The keyboard-only equivalent of dragging a
   * shape onto the canvas. For the text tool
   * the inline editor opens immediately so the keyboard user can
   * type without further navigation; the text-overlay div is
   * already in the focus trap, so the editor receives focus
   * naturally. For rect / ellipse / arrow the shape is selected and
   * the coordinate inputs become available below the style row.
   */
  function insertDefaultAtCenter(): void {
    const state = store.get();
    const tool: AnnotateTool = state.activeTool;
    if (tool === 'select' || !isKeyboardPlaceableKind(tool)) return;
    const { id, nextShapeNumber } = mintShapeId(state);
    const shape = createCenteredShape(tool, {
      imageSize: { width: source.width, height: source.height },
      style: state.currentStyle,
      id,
    });
    store.update((current) => ({ ...addShape(current, shape), nextShapeNumber }));
    if (shape.kind === 'text') {
      // Open the inline editor immediately so the user can start
      // typing. Without this the user would have to find another
      // affordance to enter the text — defeats the point.
      openTextEditor(shape);
      announce('Text annotation placed at centre. Type to enter text.');
      return;
    }
    announce(
      `${labelForKind(shape.kind)} placed at centre. Use arrow keys to nudge, or edit coordinates below.`,
    );
    // Move keyboard focus straight into the first coordinate input
    // so a keyboard-only user doesn't have to hunt for the next
    // affordance after Insert. The store-subscription update has
    // already painted the inputs by the time the click handler
    // returns, but the layout pass may not be settled — defer one
    // animation frame so the input is hit-testable before we focus.
    requestAnimationFrame(() => {
      const firstInput = coordInputs.container.querySelector<HTMLInputElement>(
        '.kalotyp-annotate-coords-input',
      );
      firstInput?.focus();
      firstInput?.select();
    });
  }

  /** The selected shape if it's a text shape, else `undefined`. */
  function selectedTextShape(): TextShape | undefined {
    const selected = selectedShapeOf(store.get());
    return selected?.kind === 'text' ? selected : undefined;
  }

  /**
   * Show the text controls when the text tool is active or a text shape is
   * selected. When a text shape is selected, the controls reflect that shape's
   * attributes; otherwise they reflect the current style for new text.
   */
  function syncTextControls(state: AnnotateState): void {
    const selectedText = state.selectedId
      ? state.shapes.find((s) => s.id === state.selectedId && s.kind === 'text')
      : undefined;
    const showText = state.activeTool === 'text' || selectedText !== undefined;
    panel.setTextControlsVisible(showText);
    if (selectedText && selectedText.kind === 'text') {
      panel.setStyle({
        ...state.currentStyle,
        fontFamily: selectedText.fontFamily,
        fontSize: selectedText.fontSize,
        fontWeight: selectedText.fontWeight,
        fontStyle: selectedText.fontStyle,
        textAlign: selectedText.textAlign,
        color: selectedText.color,
      });
    } else {
      panel.setStyle(state.currentStyle);
    }
  }

  /**
   * Apply a text-attribute change to the panel's `currentStyle` (so the next
   * new text inherits it) and, if a text shape is selected, to that shape.
   * Mirrors the color/stroke flow.
   */
  function applyTextStyle(
    partial: Partial<
      Pick<TextShape, 'fontFamily' | 'fontSize' | 'fontWeight' | 'fontStyle' | 'textAlign'>
    >,
  ): void {
    store.update((current) => {
      let next = setStyle(current, partial);
      const selected = selectedShapeOf(current);
      if (selected?.kind === 'text') {
        next = replaceShape(next, { ...selected, ...partial });
      }
      return next;
    });
    // If we're editing this text, re-render the live editor with the new
    // style so the change shows immediately (and the editor keeps focus —
    // the panel click didn't commit, per the editor's outside-click filter).
    const editing = selectedTextShape();
    if (editingTextId !== null && editing && editing.id === editingTextId) {
      textEditor.restyle(editing, viewport);
    }
    commit();
  }

  // ----- Coordinate inputs (keyboard-only positioning) -----
  // Built first so the panel can host the row in its DOM rhythm. The
  // row is store-free; each typed value commit hands the new shape
  // back to the mount layer, which writes it via replaceShape and
  // emits a history-commit.
  const coordInputs = buildCoordInputs({
    onShapeChanged: (shape) => {
      store.update((current) => replaceShape(current, shape));
      commit();
    },
  });

  // ----- Panel -----
  const initialState = store.get();
  const panel: AnnotatePanel = buildAnnotatePanel({
    initialTool: initialState.activeTool,
    initialStyle: initialState.currentStyle,
    canDelete: initialState.selectedId !== null,
    coordInputs: coordInputs.container,
    onSelectTool: (tool) => store.update((current) => setActiveTool(current, tool)),
    onColorChange: (color) => {
      store.update((current) => {
        let next = setStyle(current, { color });
        const selected = selectedShapeOf(current);
        if (selected) next = replaceShape(next, applyColorToShape(selected, color));
        return next;
      });
      commit();
    },
    onStrokeWidthChange: (width) => {
      store.update((current) => {
        let next = setStyle(current, { strokeWidth: width });
        const selected = selectedShapeOf(current);
        if (selected) next = replaceShape(next, applyStrokeWidthToShape(selected, width));
        return next;
      });
      commit();
    },
    onFontFamilyChange: (fontFamily) => applyTextStyle({ fontFamily }),
    onFontSizeChange: (fontSize) => applyTextStyle({ fontSize }),
    onToggleBold: () => {
      const current = selectedTextShape() ?? null;
      const base = current ? current.fontWeight : store.get().currentStyle.fontWeight;
      applyTextStyle({ fontWeight: base === 'bold' ? 'normal' : 'bold' });
    },
    onToggleItalic: () => {
      const current = selectedTextShape() ?? null;
      const base = current ? current.fontStyle : store.get().currentStyle.fontStyle;
      applyTextStyle({ fontStyle: base === 'italic' ? 'normal' : 'italic' });
    },
    onAlignChange: (textAlign) => applyTextStyle({ textAlign }),
    onDeleteSelected: () => {
      const id = store.get().selectedId;
      if (!id) return;
      store.update((current) => deleteShape(current, id));
      commit();
    },
    onInsertAtCenter: () => insertDefaultAtCenter(),
  });
  utilHost.appendChild(panel.container);
  // Load the annotation web fonts (idempotent; Ghost may have them already) and
  // repaint when faces arrive — a web font swaps in async with different
  // metrics, so without this the committed text renders with a fallback face
  // and only corrects (appears to "jump") on the next interaction.
  const stopFontWatch = ensureAnnotateFontsLoaded(() => paintShapes());
  // Reflect the initial tool/selection in the text-control visibility.
  syncTextControls(initialState);
  // Seed the per-tool hit-area cursor (see annotate.css).
  stage.container.dataset.tool = initialState.activeTool;

  // ----- Initial paint + observers -----
  recomputeViewport();
  paintAll();

  const resizeObserver = new ResizeObserver(() => {
    recomputeViewport();
    paintAll();
  });
  resizeObserver.observe(stage.container);

  // Repaint everything on viewport change. Selection handles +
  // text-editor position read from the same viewport so they pick up
  // zoom/pan automatically. RAF-coalesce a burst of emissions into one
  // paint per frame.
  let viewportRafScheduled = false;
  const unsubscribeViewport = controller?.subscribe(() => {
    if (viewportRafScheduled) return;
    viewportRafScheduled = true;
    requestAnimationFrame(() => {
      viewportRafScheduled = false;
      recomputeViewport();
      paintAll();
    });
  });

  // Repaint shapes + handles on store changes; keep panel in sync;
  // open/close the text editor when the selected text shape changes.
  let lastShapes = store.get().shapes;
  let lastSelected = store.get().selectedId;
  let lastTool = store.get().activeTool;
  let lastStyle = store.get().currentStyle;

  const unsubscribe = store.subscribe((next) => {
    const shapesChanged = next.shapes !== lastShapes;
    const selectionChanged = next.selectedId !== lastSelected;
    const toolChanged = next.activeTool !== lastTool;
    if (shapesChanged) {
      lastShapes = next.shapes;
      paintShapes();
    }
    if (selectionChanged) {
      lastSelected = next.selectedId;
      panel.setCanDelete(next.selectedId !== null);
    }
    if (toolChanged) {
      lastTool = next.activeTool;
      panel.setActiveTool(next.activeTool);
      // Drives the per-tool hit-area cursor (see annotate.css): `select` →
      // default arrow, `text` → I-beam, others → crosshair.
      stage.container.dataset.tool = next.activeTool;
    }
    if (next.currentStyle !== lastStyle) {
      lastStyle = next.currentStyle;
      panel.setStyle(next.currentStyle);
    }
    if (selectionChanged || toolChanged) {
      syncTextControls(next);
    }
    selectionLayer.update(shapeForHandles(next), viewport);
    // Keep the per-selection coordinate inputs in sync.
    // We update on either selection or geometry change so a pointer
    // drag updates the typed values too — the keyboard and pointer
    // paths see the same source of truth, in both directions.
    if (selectionChanged || shapesChanged) {
      coordInputs.updateForShape(selectedShapeOf(next));
    }
  });

  // Delete + Esc + arrow-key keyboard handling. Lives on `document`
  // while the plugin is mounted; the editor's broader undo/redo
  // handler already filters out editable targets, so we follow the
  // same rule.
  const onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as Element | null;
    if (isEditableTarget(target)) return;
    const state = store.get();
    if (event.key === 'Escape') {
      // While an annotation is selected, Esc deselects (and stops the
      // editor-level Esc-to-close handler from firing on top).
      // Without a selection Esc falls through to the editor.
      if (state.selectedId !== null) {
        event.preventDefault();
        event.stopPropagation();
        store.update((current) => selectShape(current, null));
        // Announce the deselection — focus doesn't move,
        // so without this a screen reader user has no cue that
        // anything changed.
        announce('Selection cleared.');
      }
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (state.selectedId === null) return;
      event.preventDefault();
      const id = state.selectedId;
      store.update((current) => deleteShape(current, id));
      commit();
      return;
    }
    // Arrow-key shape nudging. With a shape
    // selected, the four arrow keys translate it by 1px in image
    // space. Holding Shift snaps to a 10× step the way professional
    // editors handle nudge, so a keyboard-only user can travel
    // distance quickly without losing precision. The keys only fire
    // when no input/textarea/contenteditable is focused, so the
    // user is free to step through coordinate inputs without the
    // arrow keys hijacking input-internal cursor movement.
    if (
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight'
    ) {
      const selected = selectedShapeOf(state);
      if (!selected) return;
      // Don't nudge when modifier keys other than Shift are held —
      // OS-level shortcuts (Ctrl/Alt/Meta + Arrow) shouldn't be
      // consumed by the editor.
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const step = event.shiftKey ? 10 : 1;
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      event.preventDefault();
      const moved = translateShape(selected, dx, dy);
      store.update((current) => replaceShape(current, moved));
      commit();
    }
  };
  // Capture-phase so the plugin sees Esc / Delete before the editor's
  // document-level shortcut handler. The plugin only consumes the
  // event (with stopPropagation) when it actually acts on it; events
  // it ignores fall through to the editor.
  document.addEventListener('keydown', onKeyDown, true);

  return {
    destroy() {
      document.removeEventListener('keydown', onKeyDown, true);
      stopFontWatch();
      removeHitDrag();
      unsubscribe();
      unsubscribeViewport?.();
      resizeObserver.disconnect();
      textEditor.destroy();
      selectionLayer.destroy();
      stage.container.remove();
      panel.container.remove();
    },
  };
}

/**
 * Apply a colour change to an existing shape. Each shape kind has its
 * own colour-bearing field — text uses `color`, rect/ellipse use
 * `strokeColor` (and never overwrite `fillColor` from the style row),
 * arrow/freehand/highlight use `color`. This is the small price the
 * discriminated union charges us for cross-cutting style edits.
 */
function applyColorToShape(shape: Shape, color: string): Shape {
  switch (shape.kind) {
    case 'text':
      return { ...shape, color };
    case 'rect':
    case 'ellipse':
      return { ...shape, strokeColor: color };
    case 'arrow':
    case 'freehand':
    case 'highlight':
      return { ...shape, color };
  }
}

function applyStrokeWidthToShape(shape: Shape, strokeWidth: number): Shape {
  switch (shape.kind) {
    case 'text':
      // Text has no stroke width; its size is the font-size stepper in the
      // text controls. The Width slider is hidden when text is in play, so
      // this branch is unreachable in practice — leave the shape untouched.
      return shape;
    case 'rect':
    case 'ellipse':
    case 'arrow':
    case 'freehand':
    case 'highlight':
      return { ...shape, strokeWidth };
  }
}

function normaliseExtent(extent: { x: number; y: number; width: number; height: number }): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let { x, y, width, height } = extent;
  if (width < 0) {
    x += width;
    width = -width;
  }
  if (height < 0) {
    y += height;
    height = -height;
  }
  return { x, y, width, height };
}

/**
 * Topmost (last drawn) shape whose bounding box intersects the
 * marquee rectangle. Returns `undefined` when nothing intersects.
 * Multi-select is out of scope for v1 (per Phase 3 brief), so
 * marquee resolves to a single selection.
 */
function topmostShapeIntersectingMarquee(
  shapes: ReadonlyArray<Shape>,
  marquee: { x: number; y: number; width: number; height: number },
): Shape | undefined {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (!shape) continue;
    const bbox = boundingBoxOf(shape);
    if (rectsIntersect(bbox, marquee)) return shape;
  }
  return undefined;
}

function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

function isEditableTarget(target: Element | null): boolean {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return (target as HTMLElement).isContentEditable === true;
}

/**
 * Human-readable label for the keyboard-placement live-region
 * announcement. Each kind reads as a noun in the announcement
 * sentence — "Rectangle placed at centre. Use arrow keys…".
 */
function labelForKind(kind: 'rect' | 'ellipse' | 'arrow' | 'text'): string {
  switch (kind) {
    case 'rect':
      return 'Rectangle';
    case 'ellipse':
      return 'Ellipse';
    case 'arrow':
      return 'Arrow';
    case 'text':
      return 'Text annotation';
  }
}
