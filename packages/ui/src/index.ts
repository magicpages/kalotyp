import './styles/base.css';
import './styles/crop.css';
import './styles/transform.css';
import './styles/annotate.css';
import './styles/finetune.css';
import './styles/filter.css';
import './styles/redact.css';
import './styles/frame.css';
import './styles/output.css';
import './styles/preferences.css';
import './styles/cheatsheet.css';
import './styles/mobile.css';

export { mountShell } from './shell.js';
export type { ShellHandle, ShellOptions } from './shell.js';

export { mountCropUtility } from './plugins/crop/mount.js';
export type { MountCropOptions, MountCropHandle } from './plugins/crop/mount.js';
export { createCropPlugin } from './plugins/crop/plugin.js';
export type { CropPluginOptions } from './plugins/crop/plugin.js';

export { mountFlipUtility } from './plugins/flip/mount.js';
export type { MountFlipOptions, MountFlipHandle } from './plugins/flip/mount.js';
export { createFlipPlugin } from './plugins/flip/plugin.js';
export type { FlipPluginOptions } from './plugins/flip/plugin.js';

export { mountRotateUtility } from './plugins/rotate/mount.js';
export type { MountRotateOptions, MountRotateHandle } from './plugins/rotate/mount.js';
export { createRotatePlugin } from './plugins/rotate/plugin.js';
export type { RotatePluginOptions } from './plugins/rotate/plugin.js';

export { mountResizeUtility } from './plugins/resize/mount.js';
export type { MountResizeOptions, MountResizeHandle } from './plugins/resize/mount.js';
export { createResizePlugin } from './plugins/resize/plugin.js';
export type { ResizePluginOptions } from './plugins/resize/plugin.js';

export { mountFinetuneUtility } from './plugins/finetune/mount.js';
export type {
  MountFinetuneOptions,
  MountFinetuneHandle,
} from './plugins/finetune/mount.js';
export { createFinetunePlugin } from './plugins/finetune/plugin.js';
export type { FinetunePluginOptions } from './plugins/finetune/plugin.js';

export { mountFilterUtility } from './plugins/filter/mount.js';
export type {
  MountFilterOptions,
  MountFilterHandle,
} from './plugins/filter/mount.js';
export { createFilterPlugin } from './plugins/filter/plugin.js';
export type { FilterPluginOptions } from './plugins/filter/plugin.js';

export { mountAnnotateUtility } from './plugins/annotate/mount.js';
export type {
  MountAnnotateOptions,
  MountAnnotateHandle,
} from './plugins/annotate/mount.js';
export { createAnnotatePlugin } from './plugins/annotate/plugin.js';
export type { AnnotatePluginOptions } from './plugins/annotate/plugin.js';

export { mountRedactUtility } from './plugins/redact/mount.js';
export type {
  MountRedactOptions,
  MountRedactHandle,
} from './plugins/redact/mount.js';
export { createRedactPlugin } from './plugins/redact/plugin.js';
export type { RedactPluginOptions } from './plugins/redact/plugin.js';

export { mountFrameUtility } from './plugins/frame/mount.js';
export type { MountFrameOptions, MountFrameHandle } from './plugins/frame/mount.js';
export { createFramePlugin } from './plugins/frame/plugin.js';
export type { FramePluginOptions } from './plugins/frame/plugin.js';

export {
  buildUtilityNav,
  setActiveUtilityButton,
  type UtilityNavElements,
  type UtilityNavEntry,
} from './dom/build-util-nav.js';

export {
  installFocusTrap,
  type FocusTrapHandle,
  type InstallFocusTrapOptions,
} from './dom/focus-trap.js';

export { attachStageGestures, type StageGestureHandle } from './canvas/stage-gestures.js';

export { icon, iconHtml, type IconName } from './icons.js';

export {
  openNestedModal,
  type NestedModalHandle,
  type NestedModalOptions,
} from './dom/nested-modal.js';

export {
  openOutputPopover,
  type OpenOutputPopoverOptions,
  type OutputPopoverHandle,
} from './output/popover.js';

export {
  DEFAULT_PREFERENCES,
  getSiteScope,
  loadPreferences,
  savePreferences,
  type KalotypPreferences,
} from './preferences/storage.js';

export {
  openPreferencesModal,
  type OpenPreferencesModalOptions,
  type PreferencesModalHandle,
} from './preferences/modal.js';

export {
  openCheatsheet,
  type OpenCheatsheetOptions,
  type CheatsheetHandle,
} from './cheatsheet/modal.js';

export {
  KEYBOARD_SHORTCUTS,
  KEYBOARD_SHORTCUT_CONTEXT_LABELS,
  type KeyboardShortcut,
  type KeyboardShortcutContext,
} from './keyboard-shortcuts.js';
