import {
  type AnnotateState,
  type ChainLink,
  type CropPreset,
  type CropPresetFilter,
  type CropState,
  createStore,
  type EditorEvents,
  type EncodeOptions,
  EventBus,
  encodeSourceImage,
  FILTER_PRESETS,
  type FinetuneState,
  type FlipState,
  type FramePresetId,
  type FrameState,
  findActivePreset,
  History,
  isFinetuneNoOp,
  isFlipNoOp,
  isFrameNoOp,
  isResizeNoOp,
  isRotateNoOp,
  type LoadedImage,
  loadImage,
  type OutputState,
  type RedactState,
  type ResizeState,
  type RotateState,
  runUtilityChain,
  type SessionSnapshot,
  type SourceImage,
  type Store,
  type UndoResult,
  type UtilityHandle,
  type UtilityId,
  type UtilityPlugin,
  ViewportController,
} from '@magicpages/kalotyp-core';
import {
  attachStageGestures,
  buildUtilityNav,
  type CheatsheetHandle,
  createAnnotatePlugin,
  createCropPlugin,
  createFilterPlugin,
  createFinetunePlugin,
  createFlipPlugin,
  createFramePlugin,
  createRedactPlugin,
  createResizePlugin,
  createRotatePlugin,
  type FocusTrapHandle,
  getSiteScope,
  icon,
  installFocusTrap,
  type KalotypPreferences,
  loadPreferences,
  mountShell,
  type OutputPopoverHandle,
  openCheatsheet,
  openOutputPopover,
  openPreferencesModal,
  type PreferencesModalHandle,
  savePreferences,
  setActiveUtilityButton,
  type UtilityNavElements,
  type UtilityNavEntry,
} from '@magicpages/kalotyp-ui';
import type {
  EditorEventName,
  EditorEventPayloads,
  EditorInstance,
  EditorOptions,
  FrameOption,
} from './contract.js';
import { DEFAULT_CROP_PRESETS } from './default-presets.js';
import { sourceToFile } from './source-image.js';

type CropFactoryOptions = {
  presets: readonly CropPreset[];
  presetFilter: CropPresetFilter | undefined;
  panelHost: HTMLElement;
};

type FrameFactoryOptions = {
  panelHost: HTMLElement;
  labels?: Partial<Record<FramePresetId, string>> | undefined;
};

export interface EditorDependencies {
  sourceToFile(src: string | Blob | File): Promise<File>;
  loadImage(src: string | Blob | File): Promise<LoadedImage>;
  encodeSourceImage(source: SourceImage, options: EncodeOptions): Promise<File>;
  createCropPlugin(options: CropFactoryOptions): UtilityPlugin<CropState>;
  createRotatePlugin(options: { panelHost: HTMLElement }): UtilityPlugin<RotateState>;
  createFlipPlugin(options: { panelHost: HTMLElement }): UtilityPlugin<FlipState>;
  createFinetunePlugin(options: { panelHost: HTMLElement }): UtilityPlugin<FinetuneState>;
  createFilterPlugin(options: { panelHost: HTMLElement }): UtilityPlugin<FinetuneState>;
  createAnnotatePlugin(options: { panelHost: HTMLElement }): UtilityPlugin<AnnotateState>;
  createRedactPlugin(options: { panelHost: HTMLElement }): UtilityPlugin<RedactState>;
  createResizePlugin(options: { panelHost: HTMLElement }): UtilityPlugin<ResizeState>;
  createFramePlugin(options: FrameFactoryOptions): UtilityPlugin<FrameState>;
  runUtilityChain(links: readonly ChainLink[], source: SourceImage): Promise<SourceImage>;
}

const defaultDependencies: EditorDependencies = {
  sourceToFile,
  loadImage,
  encodeSourceImage,
  createCropPlugin,
  createRotatePlugin,
  createFlipPlugin,
  createFinetunePlugin,
  createFilterPlugin,
  createAnnotatePlugin,
  createRedactPlugin,
  createResizePlugin,
  createFramePlugin,
  runUtilityChain,
};

const NAV_ORDER: readonly UtilityNavEntry[] = [
  { id: 'crop', label: 'Crop' },
  { id: 'rotate', label: 'Rotate' },
  { id: 'flip', label: 'Flip' },
  { id: 'filter', label: 'Filter' },
  { id: 'finetune', label: 'Finetune' },
  { id: 'annotate', label: 'Annotate' },
  { id: 'redact', label: 'Redact' },
  { id: 'resize', label: 'Resize' },
  { id: 'frame', label: 'Frame' },
];

interface PluginSlot<TState extends object> {
  readonly id: UtilityId;
  readonly plugin: UtilityPlugin<TState>;
  readonly store: Store<TState>;
}

interface ChainEntry {
  readonly id: UtilityId;
  readonly state: object;
}

interface SessionState {
  slots: Map<UtilityId, PluginSlot<object>>;
  sourceImage: SourceImage | undefined;
  sourceName: string | undefined;
  /** Original source File retained for the encoder's EXIF preservation path. */
  sourceFile: File | undefined;
  active: { id: UtilityId; handle: UtilityHandle } | undefined;
  statusElement: HTMLElement | undefined;
  history: History | undefined;
  committedChain: ChainEntry[];
  workingImage: SourceImage | undefined;
}

export function openDefaultEditor(
  options: EditorOptions,
  dependencies: EditorDependencies = defaultDependencies,
): EditorInstance {
  const bus = new EventBus<EditorEventPayloads>();
  const editorBus = new EventBus<EditorEvents>();
  const viewportController = new ViewportController();
  const exportLabel = readExportLabel(options);

  const host = document.createElement('div');
  host.dataset.kalotypHost = '';
  document.body.appendChild(host);

  let exporting = false;
  let restoringFromHistory = false;

  const siteScope = getSiteScope(options.src);
  let preferences: KalotypPreferences = loadPreferences(siteScope);
  let prefsSaveTimer: ReturnType<typeof setTimeout> | undefined;
  function schedulePrefsSave(): void {
    if (prefsSaveTimer !== undefined) clearTimeout(prefsSaveTimer);
    prefsSaveTimer = setTimeout(() => {
      prefsSaveTimer = undefined;
      savePreferences(siteScope, preferences);
    }, 250);
  }
  function applyPrefsPatch(patch: Partial<KalotypPreferences>): void {
    preferences = { ...preferences, ...patch };
    schedulePrefsSave();
  }

  const outputStore = createStore<OutputState>({
    mimeChoice: preferences.outputMimeChoice,
    quality: preferences.outputQuality,
    stripMetadata: preferences.outputStripMetadata,
  });
  outputStore.subscribe((state) => {
    applyPrefsPatch({
      outputMimeChoice: state.mimeChoice,
      outputQuality: state.quality,
      outputStripMetadata: state.stripMetadata,
    });
  });
  let outputPopover: OutputPopoverHandle | null = null;
  let preferencesModal: PreferencesModalHandle | null = null;
  let cheatsheet: CheatsheetHandle | null = null;

  const session: SessionState = {
    slots: new Map(),
    sourceImage: undefined,
    sourceName: undefined,
    sourceFile: undefined,
    active: undefined,
    statusElement: undefined,
    history: undefined,
    committedChain: [],
    workingImage: undefined,
  };

  const shell = mountShell({
    host,
    exportLabel,
    onExportClick: () => {
      void handleExport();
    },
    onCloseClick: () => {
      attemptClose();
    },
    onOutputSettingsClick: () => {
      toggleOutputPopover();
    },
    onPrefsClick: () => {
      togglePreferencesModal();
    },
  });

  const initialActiveId: UtilityId = readInitialUtility(options);
  const nav = buildUtilityNav(
    NAV_ORDER,
    initialActiveId,
    (id) => {
      void switchActive(id);
    },
    { panelId: shell.utilMain.id },
  );
  for (const button of nav.buttons.values()) button.disabled = true;
  shell.navTools.appendChild(nav.container);

  const historyControls = buildHistoryControls({
    onUndo: () => doUndo(),
    onRedo: () => doRedo(),
  });
  historyControls.undoButton.disabled = true;
  historyControls.redoButton.disabled = true;
  shell.modal.appendChild(historyControls.container);

  shell.exportButton.disabled = true;
  showStatus(shell.stage, 'Loading image…', session);

  // Initial focus lands on the dialog root (tabindex=-1), not the close
  // button. Focusing an interactive button paints a visible focus ring on
  // every open, which sighted users mistake for hover state.
  const focusTrap: FocusTrapHandle = installFocusTrap({
    host: shell.editor,
    initialFocus: shell.editor,
  });
  shell.announce('Image editor opened. Use Tab to navigate.');

  void initialiseSession(
    shell,
    options,
    session,
    dependencies,
    nav,
    initialActiveId,
    editorBus,
    viewportController,
  ).then(
    () => {
      shell.exportButton.disabled = false;
      for (const button of nav.buttons.values()) button.disabled = false;
      removeStatus(session);
      refreshHistoryControls();
      seedPluginsFromPreferences(session, preferences, applyPrefsPatch);
      const w = session.sourceImage?.width ?? 0;
      const h = session.sourceImage?.height ?? 0;
      shell.announce(`Image loaded. ${w} by ${h} pixels.`);
    },
    (error) => {
      const message = error instanceof Error ? error.message : 'Failed to load image';
      bus.emit('loaderror', { message, cause: error });
      showStatus(shell.stage, message, session);
      shell.announce(`Failed to load image. ${message}`);
    },
  );

  // Restore-from-history triggers store writes that re-emit `commit`;
  // the flag suppresses those so an undo doesn't double-record itself.
  const unsubscribeCommit = editorBus.on('commit', () => {
    if (restoringFromHistory) return;
    if (!session.history) return;
    session.history.commit(captureSnapshot(session));
    refreshHistoryControls();
  });

  const unsubscribeAnnounce = editorBus.on('announce', ({ message }) => {
    shell.announce(message);
  });

  const removeKeyboard = installKeyboardShortcuts({
    onUndo: () => doUndo(),
    onRedo: () => doRedo(),
    onEscape: () => requestClose(),
    onCheatsheet: () => toggleCheatsheet(),
  });

  function requestClose(): void {
    if (destroyed) return;
    const hasChanges = session.history?.canUndo() ?? false;
    if (hasChanges) {
      const confirmed = window.confirm('You have unsaved changes. Discard them and close?');
      if (!confirmed) return;
    }
    attemptClose();
  }

  function attemptClose(): boolean {
    const willClose = options.willClose;
    const consent = willClose ? willClose() : true;
    if (!consent) return false;
    cleanup();
    return true;
  }

  async function switchActive(id: UtilityId): Promise<void> {
    if (!session.sourceImage) return;
    if (session.active?.id === id) return;
    const slot = session.slots.get(id);
    if (!slot) return;

    // Fast path: when the leaving plugin has no committable state, the
    // bake-on-switch is a no-op and we can complete the switch in a
    // single task. Awaiting the async helper would yield a microtask
    // even on its early-return path, which lets the browser paint
    // before the new tab's `aria-selected` flips — visible as a brief
    // moment where the old tab is still bold.
    const needsBake = activeHasCommittableState();
    if (needsBake) {
      await commitActiveIntoChain(session, editorBus, viewportController);
    }

    session.active?.handle.destroy();
    session.active = undefined;
    setActiveUtilityButton(nav, id, shell.utilMain);

    // Different plugins use different intrinsic image dimensions (e.g.
    // rotate uses the rotated bounding box), so a stale pan would point
    // at the wrong region on switch.
    viewportController.resetPan();

    const upstream = session.workingImage ?? session.sourceImage;
    const ctx = { source: upstream, bus: editorBus, viewport: viewportController };
    const handle = slot.plugin.mount(shell.stage, ctx, slot.store);
    session.active = { id, handle };

    if (session.history) {
      session.history.commit(captureSnapshot(session));
      refreshHistoryControls();
    }
  }

  function activeHasCommittableState(): boolean {
    if (!session.active) return false;
    const activeId = session.active.id;
    const commitId: UtilityId = activeId === 'filter' ? 'finetune' : activeId;
    const slot = session.slots.get(commitId);
    if (!slot) return false;
    return !pluginStateIsNoOp(commitId, slot.store.get());
  }

  function refreshHistoryControls(): void {
    historyControls.undoButton.disabled = !session.history?.canUndo();
    historyControls.redoButton.disabled = !session.history?.canRedo();
  }

  function doUndo(): void {
    if (!session.history) return;
    const result = session.history.undo(captureSnapshot(session));
    if (!result) return;
    void applyHistoryResult(result);
  }

  function doRedo(): void {
    if (!session.history) return;
    const result = session.history.redo(captureSnapshot(session));
    if (!result) return;
    void applyHistoryResult(result);
  }

  async function applyHistoryResult(result: UndoResult): Promise<void> {
    restoringFromHistory = true;
    try {
      // Rehydrate the chain first — it determines the working image dims
      // before plugins re-subscribe to fresh state on the new base.
      const restoredChain = result.snapshot.get(CHAIN_SNAPSHOT_KEY) as ChainEntry[] | undefined;
      if (restoredChain !== undefined) {
        session.committedChain = restoredChain.map((entry) => ({
          id: entry.id,
          state: entry.state,
        }));
        await recomputeWorkingImage(session, dependencies);
      }
      for (const [utility, value] of result.snapshot) {
        if (utility === CHAIN_SNAPSHOT_KEY) continue;
        const slot = session.slots.get(utility);
        if (!slot) continue;
        slot.store.update(() => value as object);
      }
    } finally {
      restoringFromHistory = false;
    }
    refreshHistoryControls();

    const activeId = session.active?.id;
    if (activeId) {
      const slot = session.slots.get(activeId);
      if (slot && session.workingImage) {
        session.active?.handle.destroy();
        const ctx = {
          source: session.workingImage,
          bus: editorBus,
          viewport: viewportController,
        };
        const handle = slot.plugin.mount(shell.stage, ctx, slot.store);
        session.active = { id: activeId, handle };
      }
    }

    if (activeId && result.changed.has(activeId)) return;
    const target = findFirstChangedPlugin(result.changed);
    if (target && target !== activeId) await switchActive(target);
  }

  function findFirstChangedPlugin(changed: ReadonlySet<UtilityId>): UtilityId | undefined {
    for (const entry of NAV_ORDER) {
      if (changed.has(entry.id)) return entry.id;
    }
    return undefined;
  }

  function toggleOutputPopover(): void {
    if (outputPopover) {
      outputPopover.close();
      return;
    }
    outputPopover = openOutputPopover({
      host: shell.editor,
      anchor: shell.outputSettingsButton,
      store: outputStore,
      canSave: () => !exporting && !shell.exportButton.disabled,
      onSaveAndClose: () => {
        outputPopover?.close();
        void handleExport();
      },
      onClose: () => {
        outputPopover = null;
      },
    });
  }

  function toggleCheatsheet(): void {
    if (cheatsheet) {
      cheatsheet.close();
      return;
    }
    cheatsheet = openCheatsheet({
      host: shell.editor,
      onClose: () => {
        cheatsheet = null;
      },
    });
  }

  function togglePreferencesModal(): void {
    if (preferencesModal) {
      preferencesModal.close();
      return;
    }
    preferencesModal = openPreferencesModal({
      host: shell.editor,
      initial: preferences,
      onChange: (next) => {
        preferences = next;
        outputStore.set({
          mimeChoice: next.outputMimeChoice,
          quality: next.outputQuality,
          stripMetadata: next.outputStripMetadata,
        });
        schedulePrefsSave();
      },
      onClose: () => {
        preferencesModal = null;
      },
    });
  }

  async function handleExport(): Promise<void> {
    if (exporting) return;
    if (!session.sourceImage || session.slots.size === 0) return;
    exporting = true;
    try {
      // The working image already has the committed chain baked in;
      // only the active plugin's bake (if dirty) is left to run.
      const baseImage = session.workingImage ?? session.sourceImage;
      let baked = baseImage;
      const active = session.active;
      if (active) {
        const slot = session.slots.get(active.id);
        if (slot) {
          const state = slot.store.get();
          if (!pluginStateIsNoOp(active.id, state)) {
            baked = await slot.plugin.bake(state, baseImage);
          }
        }
      }
      const encodeOptions: EncodeOptions = {
        output: outputStore.get(),
        ...(session.sourceName ? { sourceName: session.sourceName } : {}),
        ...(session.sourceFile ? { sourceBlob: session.sourceFile } : {}),
      };
      const file = await dependencies.encodeSourceImage(baked, encodeOptions);
      bus.emit('process', { dest: file });
      // Announce before cleanup so the live region is still in the DOM
      // when screen readers read it.
      shell.announce('Image saved.');
      // After Save, close unconditionally — willClose vetoes the close
      // button / Escape key, not Save (contract §8.2).
      cleanup();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export image';
      bus.emit('loaderror', { message, cause: error });
      shell.announce(`Save failed. ${message}`);
    } finally {
      exporting = false;
    }
  }

  const removeStageGestures = attachStageGestures(shell.stage, viewportController);

  let destroyed = false;
  function cleanup(): void {
    if (destroyed) return;
    destroyed = true;
    outputPopover?.close();
    outputPopover = null;
    preferencesModal?.close();
    preferencesModal = null;
    cheatsheet?.close();
    cheatsheet = null;
    if (prefsSaveTimer !== undefined) {
      clearTimeout(prefsSaveTimer);
      prefsSaveTimer = undefined;
      savePreferences(siteScope, preferences);
    }
    session.active?.handle.destroy();
    unsubscribeCommit();
    unsubscribeAnnounce();
    removeKeyboard();
    removeStageGestures();
    viewportController.clear();
    // Release the focus trap before tearing down the shell so the
    // trigger element (Ghost's Edit button) is still focusable when
    // the trap restores focus.
    focusTrap.release();
    shell.destroy();
    host.remove();
    bus.clear();
    editorBus.clear();
  }

  return {
    on<K extends EditorEventName>(
      event: K,
      listener: (payload: EditorEventPayloads[K]) => void,
    ): void {
      bus.on(event, listener);
    },
    off<K extends EditorEventName>(
      event: K,
      listener: (payload: EditorEventPayloads[K]) => void,
    ): void {
      bus.off(event, listener);
    },
  };
}

async function initialiseSession(
  shell: ReturnType<typeof mountShell>,
  options: EditorOptions,
  session: SessionState,
  dependencies: EditorDependencies,
  nav: UtilityNavElements,
  initialActiveId: UtilityId,
  editorBus: EventBus<EditorEvents>,
  viewportController: ViewportController,
): Promise<void> {
  const file = await dependencies.sourceToFile(options.src);
  const loaded = await dependencies.loadImage(file);

  const sourceImage: SourceImage = {
    bitmap: loaded.element,
    width: loaded.width,
    height: loaded.height,
    mimeType: file.type || 'image/png',
  };

  const presets = options.cropSelectPresetOptions ?? DEFAULT_CROP_PRESETS;
  const filter = options.cropSelectPresetFilter;

  const cropPlugin = dependencies.createCropPlugin({
    presets,
    presetFilter: filter,
    panelHost: shell.utilMain,
  });
  const rotatePlugin = dependencies.createRotatePlugin({ panelHost: shell.utilMain });
  const flipPlugin = dependencies.createFlipPlugin({ panelHost: shell.utilMain });
  const finetunePlugin = dependencies.createFinetunePlugin({ panelHost: shell.utilMain });
  const filterPlugin = dependencies.createFilterPlugin({ panelHost: shell.utilMain });

  const annotatePlugin = dependencies.createAnnotatePlugin({ panelHost: shell.utilMain });
  const redactPlugin = dependencies.createRedactPlugin({ panelHost: shell.utilMain });
  const resizePlugin = dependencies.createResizePlugin({ panelHost: shell.utilMain });
  const framePlugin = dependencies.createFramePlugin({
    panelHost: shell.utilMain,
    labels: resolveFrameLabels(options),
  });

  const initCtx = { source: sourceImage, bus: editorBus, viewport: viewportController };

  registerSlot(session, cropPlugin, initCtx);
  registerSlot(session, rotatePlugin, initCtx);
  registerSlot(session, flipPlugin, initCtx);
  registerSlot(session, finetunePlugin, initCtx);
  // Filter shares the finetune slot's store: clicking a preset writes
  // finetune state; dragging a finetune slider deactivates the strip's
  // active indicator (the state no longer matches any preset).
  const finetuneSlotForFilter = session.slots.get('finetune');
  if (finetuneSlotForFilter) {
    session.slots.set('filter', {
      id: 'filter',
      plugin: filterPlugin as UtilityPlugin<object>,
      store: finetuneSlotForFilter.store,
    });
  }
  registerSlot(session, annotatePlugin, initCtx);
  registerSlot(session, redactPlugin, initCtx);
  registerSlot(session, resizePlugin, initCtx);
  registerSlot(session, framePlugin, initCtx);

  session.sourceImage = sourceImage;
  session.sourceName = file.name;
  session.sourceFile = file;
  session.workingImage = sourceImage;
  session.committedChain = [];
  session.history = new History(captureSnapshot(session));

  const initialSlot = session.slots.get(initialActiveId);
  if (!initialSlot) return;
  const ctx = { source: session.workingImage, bus: editorBus, viewport: viewportController };
  const handle = initialSlot.plugin.mount(shell.stage, ctx, initialSlot.store);
  session.active = { id: initialActiveId, handle };
  setActiveUtilityButton(nav, initialActiveId, shell.utilMain);
}

function registerSlot<TState extends object>(
  session: SessionState,
  plugin: UtilityPlugin<TState>,
  ctx: {
    source: SourceImage;
    bus: EventBus<EditorEvents>;
    viewport: ViewportController;
  },
): void {
  const initial = plugin.init(ctx);
  const store = createStore<TState>(initial);
  session.slots.set(plugin.id, { id: plugin.id, plugin, store } as PluginSlot<object>);
}

// The `History` class's `Map<UtilityId, unknown>` shape is reused for the
// chain entry by casting. Image bytes are not stored in the snapshot —
// the working image is recomputed by replaying the chain on the source.
const CHAIN_SNAPSHOT_KEY = '__committedChain__' as UtilityId;

function captureSnapshot(session: SessionState): SessionSnapshot {
  const snapshot = new Map<UtilityId, unknown>();
  for (const [id, slot] of session.slots) {
    snapshot.set(id, slot.store.get());
  }
  snapshot.set(CHAIN_SNAPSHOT_KEY, session.committedChain);
  return snapshot;
}

function pluginStateIsNoOp(id: UtilityId, state: object): boolean {
  // Each branch is defensive: when a stub or partial state lacks the
  // expected shape we return `false` (treat as "has effect") so the
  // bake still runs. A false negative is an unnecessary identity bake;
  // a false positive would silently drop a user edit.
  switch (id) {
    case 'crop': {
      const s = state as Partial<CropState>;
      if (!s.rect || !s.imageSize) return false;
      return (
        s.rect.x === 0 &&
        s.rect.y === 0 &&
        s.rect.width === s.imageSize.width &&
        s.rect.height === s.imageSize.height
      );
    }
    case 'rotate': {
      const s = state as Partial<RotateState>;
      if (typeof s.quarterTurns !== 'number' || typeof s.freeAngle !== 'number') return false;
      return isRotateNoOp(s as RotateState);
    }
    case 'flip': {
      const s = state as Partial<FlipState>;
      if (typeof s.horizontal !== 'boolean' || typeof s.vertical !== 'boolean') return false;
      return isFlipNoOp(s as FlipState);
    }
    case 'finetune':
    case 'filter': {
      const s = state as FinetuneState | undefined;
      if (!s) return false;
      return isFinetuneNoOp(s);
    }
    case 'annotate': {
      const shapes = (state as Partial<AnnotateState>).shapes;
      return Array.isArray(shapes) && shapes.length === 0;
    }
    case 'redact': {
      const regions = (state as Partial<RedactState>).regions;
      return Array.isArray(regions) && regions.length === 0;
    }
    case 'resize': {
      const s = state as Partial<ResizeState>;
      if (typeof s.scaleX !== 'number' || typeof s.scaleY !== 'number') return false;
      return isResizeNoOp(s as ResizeState);
    }
    case 'frame': {
      const s = state as Partial<FrameState>;
      if (!s.presetId) return false;
      return isFrameNoOp(s as FrameState);
    }
    default:
      return true;
  }
}

async function commitActiveIntoChain(
  session: SessionState,
  editorBus: EventBus<EditorEvents>,
  viewportController: ViewportController,
): Promise<void> {
  if (!session.active) return;
  if (!session.workingImage) return;
  // Filter is a UI tab that shares the finetune store; its own slot has
  // an identity bake. Remap the commit through the finetune slot so the
  // state that actually changes the image is what gets recorded.
  const activeId = session.active.id;
  const commitId: UtilityId = activeId === 'filter' ? 'finetune' : activeId;
  const slot = session.slots.get(commitId);
  if (!slot) return;
  const state = slot.store.get();
  if (pluginStateIsNoOp(commitId, state)) return;

  const baked = await slot.plugin.bake(state, session.workingImage);
  session.workingImage = baked;
  session.committedChain.push({ id: slot.id, state: structuredClone(state) });

  // Reset the plugin's store to a fresh initial state against the new
  // working image. Filter and finetune share the store; one reset
  // clears both surfaces.
  const ctx = { source: session.workingImage, bus: editorBus, viewport: viewportController };
  const freshState = slot.plugin.init(ctx);
  slot.store.update(() => freshState as Partial<object>);
}

async function recomputeWorkingImage(
  session: SessionState,
  dependencies: EditorDependencies,
): Promise<void> {
  if (!session.sourceImage) return;
  const links: ChainLink[] = [];
  for (const entry of session.committedChain) {
    const slot = session.slots.get(entry.id);
    if (!slot) continue;
    links.push({ id: entry.id, plugin: slot.plugin, state: entry.state });
  }
  if (links.length === 0) {
    session.workingImage = session.sourceImage;
    return;
  }
  session.workingImage = await dependencies.runUtilityChain(links, session.sourceImage);
}

function readInitialUtility(options: EditorOptions): UtilityId {
  const raw = options.util;
  if (typeof raw !== 'string') return 'crop';
  for (const entry of NAV_ORDER) {
    if (entry.id === raw) return entry.id;
  }
  return 'crop';
}

function showStatus(stageHost: HTMLElement, message: string, session: SessionState): void {
  removeStatus(session);
  const status = document.createElement('div');
  status.className = 'kalotyp-stage-status';
  status.setAttribute('role', 'status');
  status.textContent = message;
  stageHost.appendChild(status);
  session.statusElement = status;
}

function removeStatus(session: SessionState): void {
  session.statusElement?.remove();
  session.statusElement = undefined;
}

function readExportLabel(options: EditorOptions): string {
  const fromLocale = options.locale?.labelButtonExport;
  return typeof fromLocale === 'string' && fromLocale.length > 0 ? fromLocale : 'Save and close';
}

function seedPluginsFromPreferences(
  session: SessionState,
  preferences: KalotypPreferences,
  applyPrefsPatch: (patch: Partial<KalotypPreferences>) => void,
): void {
  if (preferences.rememberAnnotationStyle) {
    const slot = session.slots.get('annotate');
    if (slot) {
      const annotateStore = slot.store as Store<AnnotateState>;
      annotateStore.update((current) => ({
        ...current,
        currentStyle: {
          ...current.currentStyle,
          color: preferences.lastAnnotationColor,
          strokeWidth: preferences.lastAnnotationStrokeWidth,
        },
      }));
      annotateStore.subscribe((state) => {
        applyPrefsPatch({
          lastAnnotationColor: state.currentStyle.color,
          lastAnnotationStrokeWidth: state.currentStyle.strokeWidth,
        });
      });
    }
  }

  if (preferences.rememberFilter && preferences.lastFilterPresetId !== null) {
    // Filter shares the finetune slot's store. Setting finetune state
    // makes the filter strip pick up the active preset via
    // `findActivePreset` on its next paint.
    const finetuneSlot = session.slots.get('finetune');
    const preset = FILTER_PRESETS.find((p) => p.id === preferences.lastFilterPresetId);
    if (finetuneSlot && preset) {
      const finetuneStore = finetuneSlot.store as Store<FinetuneState>;
      finetuneStore.update(() => preset.state);
    }
  }
  if (preferences.rememberFilter) {
    const finetuneSlot = session.slots.get('finetune');
    if (finetuneSlot) {
      const finetuneStore = finetuneSlot.store as Store<FinetuneState>;
      finetuneStore.subscribe((state) => {
        const active = findActivePreset(state);
        applyPrefsPatch({ lastFilterPresetId: active?.id ?? null });
      });
    }
  }

  if (preferences.rememberFrame) {
    const slot = session.slots.get('frame');
    if (slot) {
      const frameStore = slot.store as Store<FrameState>;
      if (preferences.lastFramePresetId) {
        frameStore.update(() => ({
          presetId: preferences.lastFramePresetId as FrameState['presetId'],
          color: preferences.lastFrameColor,
        }));
      }
      frameStore.subscribe((state) => {
        applyPrefsPatch({
          lastFramePresetId: state.presetId,
          lastFrameColor: state.color,
        });
      });
    }
  }
}

function resolveFrameLabels(
  options: EditorOptions,
): Partial<Record<FramePresetId, string>> | undefined {
  const frameOptions = options.frameOptions;
  if (!Array.isArray(frameOptions)) return undefined;
  const locale = (options.locale ?? {}) as Record<string, string>;
  const labels: Partial<Record<FramePresetId, string>> = {};
  for (const entry of frameOptions as ReadonlyArray<FrameOption>) {
    if (!Array.isArray(entry)) continue;
    const [styleId, labelFn] = entry;
    const presetId: FramePresetId = styleId === undefined ? 'none' : styleId;
    try {
      const label = labelFn(locale);
      if (typeof label === 'string' && label.length > 0) {
        labels[presetId] = label;
      }
    } catch {
      // Locale callback threw: skip and fall back to the default.
    }
  }
  return Object.keys(labels).length === 0 ? undefined : labels;
}

interface HistoryControls {
  readonly container: HTMLDivElement;
  readonly undoButton: HTMLButtonElement;
  readonly redoButton: HTMLButtonElement;
}

function buildHistoryControls(handlers: {
  onUndo: () => void;
  onRedo: () => void;
}): HistoryControls {
  const container = document.createElement('div');
  container.className = 'kalotyp-history-controls';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Edit history');

  const undoButton = document.createElement('button');
  undoButton.type = 'button';
  undoButton.className = 'kalotyp-history-button kalotyp-history-undo';
  undoButton.setAttribute('aria-label', 'Undo');
  undoButton.title = 'Undo (Ctrl+Z)';
  undoButton.innerHTML = icon('undo');
  undoButton.addEventListener('click', handlers.onUndo);

  const redoButton = document.createElement('button');
  redoButton.type = 'button';
  redoButton.className = 'kalotyp-history-button kalotyp-history-redo';
  redoButton.setAttribute('aria-label', 'Redo');
  redoButton.title = 'Redo (Ctrl+Shift+Z)';
  redoButton.innerHTML = icon('redo');
  redoButton.addEventListener('click', handlers.onRedo);

  container.appendChild(undoButton);
  container.appendChild(redoButton);
  return { container, undoButton, redoButton };
}

function installKeyboardShortcuts(handlers: {
  onUndo: () => void;
  onRedo: () => void;
  onEscape: () => void;
  onCheatsheet: () => void;
}): () => void {
  const handler = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      // Inline editors stop propagation when they want Esc for themselves;
      // if the event reaches us, it's available for the close action.
      event.preventDefault();
      handlers.onEscape();
      return;
    }
    const target = event.target as Element | null;
    if (isEditableTarget(target)) return;
    // Read `event.key` rather than `event.code` so layouts where `?`
    // is reached without Shift still match. Modified `?` falls through
    // so browser shortcuts stay intact.
    if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      handlers.onCheatsheet();
      return;
    }
    const accel = event.ctrlKey || event.metaKey;
    if (!accel) return;
    if (event.key === 'z' || event.key === 'Z') {
      event.preventDefault();
      if (event.shiftKey) handlers.onRedo();
      else handlers.onUndo();
      return;
    }
    if (event.key === 'y' || event.key === 'Y') {
      event.preventDefault();
      handlers.onRedo();
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}

function isEditableTarget(target: Element | null): boolean {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  const editable = (target as HTMLElement).isContentEditable;
  return editable === true;
}
