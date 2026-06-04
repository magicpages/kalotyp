/* @vitest-environment jsdom */
import type {
  AnnotateState,
  ChainLink,
  CropPreset,
  CropPresetFilter,
  CropState,
  EditorEvents,
  EventBus,
  FinetuneState,
  FlipState,
  FrameState,
  LoadedImage,
  RedactState,
  ResizeState,
  RotateState,
  SourceImage,
  Store,
  UtilityPlugin,
} from '@magicpages/kalotyp-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorDependencies } from './editor.js';
import { openDefaultEditor } from './editor.js';

const sourceFile = new File([new Uint8Array([137, 80, 78, 71])], 'unedited.png', {
  type: 'image/png',
});

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  document.body.replaceChildren();
});

/**
 * jsdom can't decode images or run a 2D canvas. The two unit tests that
 * round-trip through bake/encode use this stubbed dependency set so we
 * exercise the wiring without depending on those runtimes. The full
 * crop-bake-encode pipeline is verified by the Playwright E2E suite.
 */
function makeStubDeps(overrides: Partial<EditorDependencies> = {}): EditorDependencies {
  const stubLoaded: LoadedImage = {
    element: document.createElement('img'),
    width: 800,
    height: 600,
  };
  const stubCrop: UtilityPlugin<CropState> = {
    id: 'crop',
    init: () => ({
      rect: { x: 0, y: 0, width: 800, height: 600 },
      aspectRatio: undefined,
      activePresetIndex: -1,
      presets: [] as readonly CropPreset[],
      imageSize: { width: 800, height: 600 },
    }),
    mount: () => ({ destroy: () => {} }),
    bake: async (_state, source: SourceImage) => source,
  };
  const stubRotate: UtilityPlugin<RotateState> = {
    id: 'rotate',
    init: () => ({ quarterTurns: 0, freeAngle: 0 }),
    mount: () => ({ destroy: () => {} }),
    bake: async (_state, source: SourceImage) => source,
  };
  const stubFlip: UtilityPlugin<FlipState> = {
    id: 'flip',
    init: () => ({ horizontal: false, vertical: false }),
    mount: () => ({ destroy: () => {} }),
    bake: async (_state, source: SourceImage) => source,
  };
  const stubFinetune: UtilityPlugin<FinetuneState> = {
    id: 'finetune',
    init: () => ({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      exposure: 0,
      clarity: 0,
      gamma: 0,
    }),
    mount: () => ({ destroy: () => {} }),
    bake: async (_state, source: SourceImage) => source,
  };
  const stubFilter: UtilityPlugin<FinetuneState> = {
    id: 'filter',
    init: () => ({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      exposure: 0,
      clarity: 0,
      gamma: 0,
    }),
    mount: () => ({ destroy: () => {} }),
    bake: async (_state, source: SourceImage) => source,
  };
  const stubAnnotate: UtilityPlugin<AnnotateState> = {
    id: 'annotate',
    init: () => ({
      shapes: [],
      selectedId: null,
      activeTool: 'select',
      currentStyle: { color: '#000', strokeWidth: 4, fillColor: null, fontSize: 32 },
      imageSize: { width: 800, height: 600 },
      nextShapeNumber: 1,
    }),
    mount: () => ({ destroy: () => {} }),
    bake: async (_state, source: SourceImage) => source,
  };
  const stubResize: UtilityPlugin<ResizeState> = {
    id: 'resize',
    init: () => ({ scaleX: 1, scaleY: 1, lockAspect: true }),
    mount: () => ({ destroy: () => {} }),
    bake: async (_state, source: SourceImage) => source,
  };
  const stubRedact: UtilityPlugin<RedactState> = {
    id: 'redact',
    init: () => ({
      regions: [],
      nextRegionNumber: 1,
      selectedId: null,
      currentMode: 'pixelate',
      currentColor: '#000000',
      imageSize: { width: 800, height: 600 },
    }),
    mount: () => ({ destroy: () => {} }),
    bake: async (_state, source: SourceImage) => source,
  };
  const stubFrame: UtilityPlugin<FrameState> = {
    id: 'frame',
    init: () => ({ presetId: 'none', color: '#000000' }),
    mount: () => ({ destroy: () => {} }),
    bake: async (_state, source: SourceImage) => source,
  };
  return {
    sourceToFile: async (src) =>
      src instanceof File
        ? src
        : src instanceof Blob
          ? new File([src], 'stub.png', { type: 'image/png' })
          : new File([new Uint8Array(0)], 'stub.png', { type: 'image/png' }),
    loadImage: async () => stubLoaded,
    encodeSourceImage: async (_source, options) =>
      new File([new Uint8Array([1, 2, 3])], options.sourceName ?? 'edited.png', {
        type: 'image/png',
      }),
    createCropPlugin: () => stubCrop,
    createRotatePlugin: () => stubRotate,
    createFlipPlugin: () => stubFlip,
    createFinetunePlugin: () => stubFinetune,
    createFilterPlugin: () => stubFilter,
    createAnnotatePlugin: () => stubAnnotate,
    createRedactPlugin: () => stubRedact,
    createResizePlugin: () => stubResize,
    createFramePlugin: () => stubFrame,
    runUtilityChain: async (links: readonly ChainLink[], source: SourceImage) => {
      let current = source;
      for (const link of links) current = await link.plugin.bake(link.state, current);
      return current;
    },
    ...overrides,
  };
}

describe('openDefaultEditor (Ghost contract)', () => {
  it('mounts a host with .pintura-editor on the body', () => {
    openDefaultEditor({ src: sourceFile }, makeStubDeps());
    expect(document.querySelector('.pintura-editor')).not.toBeNull();
  });

  it('mounts a .kalotyp-root with `landscape has-navigation` data-env tokens', () => {
    openDefaultEditor({ src: sourceFile }, makeStubDeps());
    const root = document.querySelector<HTMLElement>('.kalotyp-root');
    expect(root).not.toBeNull();
    const tokens = (root?.getAttribute('data-env') ?? '').split(/\s+/);
    expect(tokens).toContain('landscape');
    expect(tokens).toContain('has-navigation');
  });

  it('renders a close button matching `.PinturaModal button[title="Close"]`', () => {
    openDefaultEditor({ src: sourceFile }, makeStubDeps());
    expect(document.querySelector('.PinturaModal button[title="Close"]')).not.toBeNull();
  });

  it('renders the export button with .kalotyp-button-export and uses `locale.labelButtonExport`', () => {
    openDefaultEditor(
      { src: sourceFile, locale: { labelButtonExport: 'Save and close' } },
      makeStubDeps(),
    );
    const button = document.querySelector<HTMLButtonElement>('.kalotyp-button-export');
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain('Save and close');
  });

  it('disables the export button until the image has loaded', async () => {
    let resolveLoad: ((value: LoadedImage) => void) | undefined;
    const loadStarted = new Promise<void>((startResolve) => {
      const deps = makeStubDeps({
        loadImage: () =>
          new Promise<LoadedImage>((resolve) => {
            resolveLoad = resolve;
            startResolve();
          }),
      });
      openDefaultEditor({ src: sourceFile }, deps);
    });
    const button = document.querySelector<HTMLButtonElement>('.kalotyp-button-export');
    expect(button?.disabled).toBe(true);
    await loadStarted;
    resolveLoad?.({ element: document.createElement('img'), width: 100, height: 100 });
    await vi.waitFor(() => {
      expect(button?.disabled).toBe(false);
    });
  });

  it('returns an instance whose .on(process, …) fires with `dest: File` after the export click', async () => {
    const editor = openDefaultEditor({ src: sourceFile }, makeStubDeps());
    const handler = vi.fn();
    editor.on('process', handler);

    await vi.waitFor(() => {
      const btn = document.querySelector<HTMLButtonElement>('.kalotyp-button-export');
      expect(btn?.disabled).toBe(false);
    });
    document.querySelector<HTMLButtonElement>('.kalotyp-button-export')?.click();

    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledOnce();
    });

    const [arg] = handler.mock.calls[0] as [{ dest: File }];
    expect(arg.dest).toBeInstanceOf(File);
    expect(arg.dest.name.length).toBeGreaterThan(0);
  });

  it('emits loaderror when image loading fails', async () => {
    const deps = makeStubDeps({
      loadImage: async () => {
        throw new Error('CORS blocked');
      },
    });
    const editor = openDefaultEditor({ src: 'https://cdn/example.jpg' }, deps);
    const handler = vi.fn();
    editor.on('loaderror', handler);

    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledOnce();
    });
    expect(handler.mock.calls[0]?.[0]).toMatchObject({ message: 'CORS blocked' });
  });

  it('honours willClose() === false to keep the editor open on close click', () => {
    const willClose = vi.fn(() => false);
    openDefaultEditor({ src: sourceFile, willClose }, makeStubDeps());
    document.querySelector<HTMLButtonElement>('.PinturaModal button[title="Close"]')?.click();
    expect(willClose).toHaveBeenCalled();
    expect(document.querySelector('.pintura-editor')).not.toBeNull();
  });

  it('removes the editor from the DOM when willClose() returns true', () => {
    openDefaultEditor({ src: sourceFile, willClose: () => true }, makeStubDeps());
    document.querySelector<HTMLButtonElement>('.PinturaModal button[title="Close"]')?.click();
    expect(document.querySelector('.pintura-editor')).toBeNull();
  });

  it('cleans up automatically after the process event fires, regardless of willClose', async () => {
    // Ghost's willClose() returns false except after the Close button is
    // clicked. After Save, we close unconditionally — willClose vetoes
    // ESC, not Save (contract §8.2 + the Save UX Ghost expects).
    const willClose = vi.fn(() => false);
    const editor = openDefaultEditor({ src: sourceFile, willClose }, makeStubDeps());
    editor.on('process', () => {});
    await vi.waitFor(() => {
      const btn = document.querySelector<HTMLButtonElement>('.kalotyp-button-export');
      expect(btn?.disabled).toBe(false);
    });
    document.querySelector<HTMLButtonElement>('.kalotyp-button-export')?.click();
    await vi.waitFor(() => {
      expect(document.querySelector('.pintura-editor')).toBeNull();
    });
  });

  it('passes the cropSelectPresetOptions and filter through to the crop plugin', async () => {
    const createCropPlugin = vi.fn((opts) => ({
      id: 'crop' as const,
      init: () => ({
        rect: { x: 0, y: 0, width: 100, height: 100 },
        aspectRatio: undefined,
        activePresetIndex: -1,
        presets: opts.presets,
        imageSize: { width: 100, height: 100 },
      }),
      mount: () => ({ destroy: () => {} }),
      bake: async (_state: CropState, src: SourceImage) => src,
    }));
    const deps = makeStubDeps({ createCropPlugin });
    const presets: readonly CropPreset[] = [
      [undefined, 'Custom'],
      [1, 'Square'],
    ];
    const filter: CropPresetFilter = 'landscape';
    openDefaultEditor(
      { src: sourceFile, cropSelectPresetOptions: presets, cropSelectPresetFilter: filter },
      deps,
    );
    await vi.waitFor(() => {
      expect(createCropPlugin).toHaveBeenCalled();
    });
    expect(createCropPlugin.mock.calls[0]?.[0]).toMatchObject({
      presets,
      presetFilter: filter,
    });
  });

  it('tolerates extra unknown option keys without crashing', () => {
    expect(() =>
      openDefaultEditor(
        {
          src: sourceFile,
          enableTransparencyGrid: true,
          util: 'crop',
          utils: ['crop', 'filter', 'finetune', 'redact', 'annotate', 'trim', 'frame', 'resize'],
          cropSelectPresetFilter: 'landscape',
          cropSelectPresetOptions: [
            [undefined, 'Custom'],
            [1, 'Square'],
          ],
          previewPad: true,
          somethingGhostMightAddLater: 'hello',
        } as never,
        makeStubDeps(),
      ),
    ).not.toThrow();
  });

  it('renders a util nav with the nine Phase 6.4 utilities, crop active by default', async () => {
    openDefaultEditor({ src: sourceFile }, makeStubDeps());
    await vi.waitFor(() => {
      const buttons = document.querySelectorAll<HTMLButtonElement>('.kalotyp-util-nav-button');
      expect(buttons.length).toBe(9);
    });
    // Trim is omitted from the nav per Phase 6.4 / — Ghost
    // never invokes the editor with video content. The remaining
    // entries follow the chain order plus filter (which is a UI tab
    // on the finetune store).
    const ids = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.kalotyp-util-nav-button'),
    ).map((b) => b.dataset.utilityId);
    expect(ids).toEqual([
      'crop',
      'rotate',
      'flip',
      'filter',
      'finetune',
      'annotate',
      'redact',
      'resize',
      'frame',
    ]);
    const active = document.querySelector<HTMLButtonElement>(
      '.kalotyp-util-nav-button[aria-selected="true"]',
    );
    expect(active?.dataset.utilityId).toBe('crop');
  });

  it('mounts the requested utility when its nav button is clicked', async () => {
    const flipMount = vi.fn(() => ({ destroy: vi.fn() }));
    const deps = makeStubDeps({
      createFlipPlugin: () => ({
        id: 'flip',
        init: () => ({ horizontal: false, vertical: false }),
        mount: flipMount,
        bake: async (_s, src: SourceImage) => src,
      }),
    });
    openDefaultEditor({ src: sourceFile }, deps);

    await vi.waitFor(() => {
      const button = document.querySelector<HTMLButtonElement>(
        '.kalotyp-util-nav-button[data-utility-id="flip"]',
      );
      expect(button?.disabled).toBe(false);
    });

    const flipButton = document.querySelector<HTMLButtonElement>(
      '.kalotyp-util-nav-button[data-utility-id="flip"]',
    );
    flipButton?.click();

    await vi.waitFor(() => {
      expect(flipMount).toHaveBeenCalledOnce();
    });
    const active = document.querySelector<HTMLButtonElement>(
      '.kalotyp-util-nav-button[aria-selected="true"]',
    );
    expect(active?.dataset.utilityId).toBe('flip');
  });

  it('save bakes the active plugin on top of the committed chain', async () => {
    // Bake-on-switch destructive-edit model: each tab switch with
    // dirty state bakes the leaving plugin into the working image
    // and appends it to the user-action chain. On Save, the chain
    // is already baked into the working image; only the active
    // plugin's bake (if dirty) runs on top. With no edits and no
    // tab switches, only the initial active plugin (`crop`) would
    // bake if its state were dirty — and crop's initial state is a
    // no-op, so nothing bakes at all.
    const order: string[] = [];
    const recordingPlugin = <
      Id extends
        | 'crop'
        | 'rotate'
        | 'flip'
        | 'finetune'
        | 'filter'
        | 'annotate'
        | 'redact'
        | 'resize'
        | 'frame',
    >(
      id: Id,
    ): UtilityPlugin<object> => ({
      id,
      init: () => ({}),
      mount: () => ({ destroy: () => {} }),
      bake: async (_state, source: SourceImage) => {
        order.push(id);
        return source;
      },
    });
    const deps = makeStubDeps({
      createCropPlugin: () => recordingPlugin('crop') as UtilityPlugin<CropState>,
      createRotatePlugin: () => recordingPlugin('rotate') as UtilityPlugin<RotateState>,
      createFlipPlugin: () => recordingPlugin('flip') as UtilityPlugin<FlipState>,
      createFinetunePlugin: () => recordingPlugin('finetune') as UtilityPlugin<FinetuneState>,
      createFilterPlugin: () => recordingPlugin('filter') as UtilityPlugin<FinetuneState>,
      createAnnotatePlugin: () => recordingPlugin('annotate') as UtilityPlugin<AnnotateState>,
      createRedactPlugin: () => recordingPlugin('redact') as UtilityPlugin<RedactState>,
      createResizePlugin: () => recordingPlugin('resize') as UtilityPlugin<ResizeState>,
      createFramePlugin: () => recordingPlugin('frame') as UtilityPlugin<FrameState>,
    });
    openDefaultEditor({ src: sourceFile }, deps);

    await vi.waitFor(() => {
      const btn = document.querySelector<HTMLButtonElement>('.kalotyp-button-export');
      expect(btn?.disabled).toBe(false);
    });
    order.length = 0;
    document.querySelector<HTMLButtonElement>('.kalotyp-button-export')?.click();

    // Active plugin has `{}` state, which `pluginStateIsNoOp`
    // treats as "non-no-op" via its defensive false-default for
    // unrecognised shapes. So the active plugin (`crop`) bakes
    // exactly once, on top of an empty working-image chain.
    await vi.waitFor(() => {
      expect(order).toEqual(['crop']);
    });
  });

  it('filter and finetune share the same store so a click on Filter updates Finetune sliders', async () => {
    const captured: {
      filterStore?: Store<FinetuneState>;
      finetuneStore?: Store<FinetuneState>;
      filterBus?: EventBus<EditorEvents>;
    } = {};
    const trackingFilter: UtilityPlugin<FinetuneState> = {
      id: 'filter',
      init: () => ({
        brightness: 0,
        contrast: 0,
        saturation: 0,
        exposure: 0,
        clarity: 0,
        gamma: 0,
      }),
      mount: (_host, ctx, store) => {
        captured.filterStore = store;
        captured.filterBus = ctx.bus;
        return { destroy: () => {} };
      },
      bake: async (_state, source: SourceImage) => source,
    };
    const trackingFinetune: UtilityPlugin<FinetuneState> = {
      id: 'finetune',
      init: () => ({
        brightness: 0,
        contrast: 0,
        saturation: 0,
        exposure: 0,
        clarity: 0,
        gamma: 0,
      }),
      mount: (_host, _ctx, store) => {
        captured.finetuneStore = store;
        return { destroy: () => {} };
      },
      bake: async (_state, source: SourceImage) => source,
    };
    const deps = makeStubDeps({
      createFinetunePlugin: () => trackingFinetune,
      createFilterPlugin: () => trackingFilter,
    });
    openDefaultEditor({ src: sourceFile, util: 'filter' }, deps);

    await vi.waitFor(() => {
      expect(captured.filterStore).toBeDefined();
    });

    // Switch to finetune so its mount captures the store reference.
    document
      .querySelector<HTMLButtonElement>('.kalotyp-util-nav-button[data-utility-id="finetune"]')
      ?.click();
    await vi.waitFor(() => {
      expect(captured.finetuneStore).toBeDefined();
    });

    const filterStore = captured.filterStore;
    const finetuneStore = captured.finetuneStore;
    if (!filterStore || !finetuneStore) throw new Error('plugin mounts did not capture stores');

    expect(filterStore).toBe(finetuneStore);

    // Writing through the filter store updates the finetune store —
    // because they're the same object.
    filterStore.update(() => ({
      brightness: 5,
      contrast: 10,
      saturation: 40,
      exposure: 0,
      clarity: 5,
      gamma: 0,
    }));
    expect(finetuneStore.get().saturation).toBe(40);
  });

  it('honours `util` to set the initial active utility', async () => {
    openDefaultEditor({ src: sourceFile, util: 'rotate' }, makeStubDeps());
    await vi.waitFor(() => {
      const active = document.querySelector<HTMLButtonElement>(
        '.kalotyp-util-nav-button[aria-selected="true"]',
      );
      expect(active?.dataset.utilityId).toBe('rotate');
    });
  });

  it('renders disabled undo and redo buttons before the first commit', async () => {
    openDefaultEditor({ src: sourceFile }, makeStubDeps());
    await vi.waitFor(() => {
      const undo = document.querySelector<HTMLButtonElement>('.kalotyp-history-undo');
      expect(undo).not.toBeNull();
      expect(undo?.disabled).toBe(true);
    });
    expect(document.querySelector<HTMLButtonElement>('.kalotyp-history-redo')?.disabled).toBe(true);
  });

  it('captures plugin commits and undoes them via the editor history', async () => {
    const captured: { storeRef?: Store<RotateState>; busRef?: EventBus<EditorEvents> } = {};
    const trackingRotate: UtilityPlugin<RotateState> = {
      id: 'rotate',
      init: () => ({ quarterTurns: 0, freeAngle: 0 }),
      mount: (_host, ctx, store) => {
        captured.storeRef = store;
        captured.busRef = ctx.bus;
        return { destroy: () => {} };
      },
      bake: async (_state, source: SourceImage) => source,
    };
    const deps = makeStubDeps({ createRotatePlugin: () => trackingRotate });
    openDefaultEditor({ src: sourceFile, util: 'rotate' }, deps);

    await vi.waitFor(() => {
      expect(captured.storeRef).toBeDefined();
    });
    const store = captured.storeRef;
    const bus = captured.busRef;
    if (!store || !bus) throw new Error('plugin mount did not capture store/bus');

    // Simulate a plugin doing a commit boundary: write state, emit
    // `commit` for that utility. The editor coordinator should capture
    // the snapshot.
    store.set({ quarterTurns: 1 });
    bus.emit('commit', { utility: 'rotate' });

    await vi.waitFor(() => {
      expect(document.querySelector<HTMLButtonElement>('.kalotyp-history-undo')?.disabled).toBe(
        false,
      );
    });

    document.querySelector<HTMLButtonElement>('.kalotyp-history-undo')?.click();

    await vi.waitFor(() => {
      expect(store.get().quarterTurns).toBe(0);
    });
    expect(document.querySelector<HTMLButtonElement>('.kalotyp-history-redo')?.disabled).toBe(
      false,
    );

    document.querySelector<HTMLButtonElement>('.kalotyp-history-redo')?.click();

    await vi.waitFor(() => {
      expect(store.get().quarterTurns).toBe(1);
    });
  });

  it('auto-switches to the affected utility when undo crosses tabs', async () => {
    const captured: { rotateStore?: Store<RotateState>; bus?: EventBus<EditorEvents> } = {};
    const trackingRotate: UtilityPlugin<RotateState> = {
      id: 'rotate',
      init: () => ({ quarterTurns: 0, freeAngle: 0 }),
      mount: (_host, ctx, store) => {
        captured.rotateStore = store;
        captured.bus = ctx.bus;
        return { destroy: () => {} };
      },
      bake: async (_state, source: SourceImage) => source,
    };
    const deps = makeStubDeps({ createRotatePlugin: () => trackingRotate });
    // Open on rotate so the rotate plugin mounts first and we capture
    // its store and bus reference.
    openDefaultEditor({ src: sourceFile, util: 'rotate' }, deps);
    await vi.waitFor(() => {
      expect(captured.rotateStore).toBeDefined();
    });

    const rotateStore = captured.rotateStore;
    const bus = captured.bus;
    if (!rotateStore || !bus) throw new Error('rotate plugin did not capture store/bus');
    rotateStore.set({ quarterTurns: 2 });
    bus.emit('commit', { utility: 'rotate' });

    // Switch the user to the crop tab. Bake-on-switch commits the
    // rotate edit into the chain and resets rotate's store; that
    // also captures a history snapshot, so the rotate edit and the
    // tab switch are two distinct undo steps in the new model.
    document
      .querySelector<HTMLButtonElement>('.kalotyp-util-nav-button[data-utility-id="crop"]')
      ?.click();
    await vi.waitFor(() => {
      const active = document.querySelector<HTMLButtonElement>(
        '.kalotyp-util-nav-button[aria-selected="true"]',
      );
      expect(active?.dataset.utilityId).toBe('crop');
    });

    // First undo: revert the tab-switch commit. Rotate auto-
    // becomes active because its state is what changed (the
    // chain rewinds and rotate's store is restored to q:2 pre-
    // commit).
    document.querySelector<HTMLButtonElement>('.kalotyp-history-undo')?.click();

    await vi.waitFor(() => {
      const active = document.querySelector<HTMLButtonElement>(
        '.kalotyp-util-nav-button[aria-selected="true"]',
      );
      expect(active?.dataset.utilityId).toBe('rotate');
    });
    expect(rotateStore.get().quarterTurns).toBe(2);

    // Second undo: revert the rotate edit itself.
    document.querySelector<HTMLButtonElement>('.kalotyp-history-undo')?.click();
    await vi.waitFor(() => {
      expect(rotateStore.get().quarterTurns).toBe(0);
    });
  });

  it('keyboard shortcut Ctrl+Z triggers undo', async () => {
    const captured: { store?: Store<RotateState>; bus?: EventBus<EditorEvents> } = {};
    const trackingRotate: UtilityPlugin<RotateState> = {
      id: 'rotate',
      init: () => ({ quarterTurns: 0, freeAngle: 0 }),
      mount: (_host, ctx, store) => {
        captured.store = store;
        captured.bus = ctx.bus;
        return { destroy: () => {} };
      },
      bake: async (_state, source: SourceImage) => source,
    };
    openDefaultEditor(
      { src: sourceFile, util: 'rotate' },
      makeStubDeps({ createRotatePlugin: () => trackingRotate }),
    );
    await vi.waitFor(() => {
      expect(captured.store).toBeDefined();
    });

    const store = captured.store;
    const bus = captured.bus;
    if (!store || !bus) throw new Error('rotate plugin did not capture store/bus');
    store.set({ quarterTurns: 1 });
    bus.emit('commit', { utility: 'rotate' });

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    );

    await vi.waitFor(() => {
      expect(store.get().quarterTurns).toBe(0);
    });
  });
});
