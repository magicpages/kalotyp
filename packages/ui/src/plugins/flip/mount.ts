import {
  type FlipState,
  type SourceImage,
  type Store,
  toggleFlip,
  type ViewportController,
} from '@magicpages/kalotyp-core';
import {
  buildPreviewCanvas,
  paintPreview,
  previewViewportFor,
} from '../../canvas/preview-canvas.js';
import { icon } from '../../icons.js';

export interface MountFlipOptions {
  readonly stageHost: HTMLElement;
  readonly utilHost: HTMLElement;
  readonly source: SourceImage;
  readonly store: Store<FlipState>;
  readonly viewport?: ViewportController;
  readonly onCommit?: () => void;
}

export interface MountFlipHandle {
  destroy(): void;
}

export function mountFlipUtility(options: MountFlipOptions): MountFlipHandle {
  const { stageHost, utilHost, source, store, viewport: controller } = options;
  const commit = options.onCommit ?? (() => {});

  const preview = buildPreviewCanvas();
  stageHost.appendChild(preview.container);

  const panel = buildFlipPanel({
    onToggleHorizontal: () => {
      store.set(toggleFlip(store.get(), 'horizontal'));
      commit();
    },
    onToggleVertical: () => {
      store.set(toggleFlip(store.get(), 'vertical'));
      commit();
    },
  });
  utilHost.appendChild(panel.container);

  function paint(): void {
    const v = previewViewportFor(
      preview.container,
      { width: source.width, height: source.height },
      controller,
    );
    if (!v) return;
    const state = store.get();
    paintPreview(preview.canvas, v.stageWidth, v.stageHeight, (ctx) => {
      const display = v.viewport.displayRect;
      const sx = state.horizontal ? -1 : 1;
      const sy = state.vertical ? -1 : 1;
      // Anchor on display centre so the image stays letterboxed in place, just mirrored.
      const cx = display.x + display.width / 2;
      const cy = display.y + display.height / 2;
      ctx.translate(cx, cy);
      ctx.scale(sx, sy);
      ctx.drawImage(
        source.bitmap,
        -display.width / 2,
        -display.height / 2,
        display.width,
        display.height,
      );
    });
  }

  function syncPanel(state: FlipState): void {
    panel.horizontalButton.setAttribute('aria-pressed', state.horizontal ? 'true' : 'false');
    panel.verticalButton.setAttribute('aria-pressed', state.vertical ? 'true' : 'false');
  }

  syncPanel(store.get());
  paint();

  const resizeObserver = new ResizeObserver(() => paint());
  resizeObserver.observe(preview.container);

  let viewportRafScheduled = false;
  const unsubscribeViewport = controller?.subscribe(() => {
    if (viewportRafScheduled) return;
    viewportRafScheduled = true;
    requestAnimationFrame(() => {
      viewportRafScheduled = false;
      paint();
    });
  });

  let rafScheduled = false;
  const unsubscribe = store.subscribe((next) => {
    syncPanel(next);
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      paint();
    });
  });

  return {
    destroy() {
      unsubscribe();
      unsubscribeViewport?.();
      resizeObserver.disconnect();
      preview.container.remove();
      panel.container.remove();
    },
  };
}

interface FlipPanelOptions {
  onToggleHorizontal(): void;
  onToggleVertical(): void;
}

interface FlipPanel {
  container: HTMLDivElement;
  horizontalButton: HTMLButtonElement;
  verticalButton: HTMLButtonElement;
}

function buildFlipPanel(options: FlipPanelOptions): FlipPanel {
  const container = document.createElement('div');
  container.className = 'kalotyp-flip-panel';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Flip');

  const horizontalButton = createToggleButton(
    'Flip horizontal',
    icon('flipHorizontal'),
    options.onToggleHorizontal,
  );
  horizontalButton.classList.add('kalotyp-flip-button-h');
  const verticalButton = createToggleButton(
    'Flip vertical',
    icon('flipVertical'),
    options.onToggleVertical,
  );
  verticalButton.classList.add('kalotyp-flip-button-v');

  container.appendChild(horizontalButton);
  container.appendChild(verticalButton);

  return { container, horizontalButton, verticalButton };
}

function createToggleButton(
  label: string,
  iconHtml: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'kalotyp-toggle-button';
  button.innerHTML = `${iconHtml}<span>${label}</span>`;
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', label);
  button.addEventListener('click', onClick);
  return button;
}
