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

export { attachStageGestures, type StageGestureHandle } from './canvas/stage-gestures.js';
export {
  type CheatsheetHandle,
  type OpenCheatsheetOptions,
  openCheatsheet,
} from './cheatsheet/modal.js';
export {
  buildUtilityNav,
  setActiveUtilityButton,
  type UtilityNavElements,
  type UtilityNavEntry,
} from './dom/build-util-nav.js';
export {
  type FocusTrapHandle,
  type InstallFocusTrapOptions,
  installFocusTrap,
} from './dom/focus-trap.js';
export {
  type NestedModalHandle,
  type NestedModalOptions,
  openNestedModal,
} from './dom/nested-modal.js';
export { type IconName, icon, iconHtml } from './icons.js';
export {
  KEYBOARD_SHORTCUT_CONTEXT_LABELS,
  KEYBOARD_SHORTCUTS,
  type KeyboardShortcut,
  type KeyboardShortcutContext,
} from './keyboard-shortcuts.js';
export {
  type OpenOutputPopoverOptions,
  type OutputPopoverHandle,
  openOutputPopover,
} from './output/popover.js';
export type {
  MountAnnotateHandle,
  MountAnnotateOptions,
} from './plugins/annotate/mount.js';
export { mountAnnotateUtility } from './plugins/annotate/mount.js';
export type { AnnotatePluginOptions } from './plugins/annotate/plugin.js';
export { createAnnotatePlugin } from './plugins/annotate/plugin.js';
export type { MountCropHandle, MountCropOptions } from './plugins/crop/mount.js';
export { mountCropUtility } from './plugins/crop/mount.js';
export type { CropPluginOptions } from './plugins/crop/plugin.js';
export { createCropPlugin } from './plugins/crop/plugin.js';
export type {
  MountFilterHandle,
  MountFilterOptions,
} from './plugins/filter/mount.js';
export { mountFilterUtility } from './plugins/filter/mount.js';
export type { FilterPluginOptions } from './plugins/filter/plugin.js';
export { createFilterPlugin } from './plugins/filter/plugin.js';
export type {
  MountFinetuneHandle,
  MountFinetuneOptions,
} from './plugins/finetune/mount.js';
export { mountFinetuneUtility } from './plugins/finetune/mount.js';
export type { FinetunePluginOptions } from './plugins/finetune/plugin.js';
export { createFinetunePlugin } from './plugins/finetune/plugin.js';
export type { MountFlipHandle, MountFlipOptions } from './plugins/flip/mount.js';
export { mountFlipUtility } from './plugins/flip/mount.js';
export type { FlipPluginOptions } from './plugins/flip/plugin.js';
export { createFlipPlugin } from './plugins/flip/plugin.js';
export type { MountFrameHandle, MountFrameOptions } from './plugins/frame/mount.js';
export { mountFrameUtility } from './plugins/frame/mount.js';
export type { FramePluginOptions } from './plugins/frame/plugin.js';
export { createFramePlugin } from './plugins/frame/plugin.js';
export type {
  MountRedactHandle,
  MountRedactOptions,
} from './plugins/redact/mount.js';
export { mountRedactUtility } from './plugins/redact/mount.js';
export type { RedactPluginOptions } from './plugins/redact/plugin.js';
export { createRedactPlugin } from './plugins/redact/plugin.js';
export type { MountResizeHandle, MountResizeOptions } from './plugins/resize/mount.js';
export { mountResizeUtility } from './plugins/resize/mount.js';
export type { ResizePluginOptions } from './plugins/resize/plugin.js';
export { createResizePlugin } from './plugins/resize/plugin.js';
export type { MountRotateHandle, MountRotateOptions } from './plugins/rotate/mount.js';
export { mountRotateUtility } from './plugins/rotate/mount.js';
export type { RotatePluginOptions } from './plugins/rotate/plugin.js';
export { createRotatePlugin } from './plugins/rotate/plugin.js';
export {
  type OpenPreferencesModalOptions,
  openPreferencesModal,
  type PreferencesModalHandle,
} from './preferences/modal.js';
export {
  DEFAULT_PREFERENCES,
  getSiteScope,
  type KalotypPreferences,
  loadPreferences,
  savePreferences,
} from './preferences/storage.js';
export type { ShellHandle, ShellOptions } from './shell.js';
export { mountShell } from './shell.js';
