import { openDefaultEditor } from './editor.js';
import { installGlobal } from './install-global.js';

if (typeof window !== 'undefined') {
  installGlobal(globalThis);
}

export { openDefaultEditor };
export type {
  EditorEventName,
  EditorEventPayloads,
  EditorInstance,
  EditorOptions,
  ProcessEvent,
  LoadErrorEvent,
} from './contract.js';
