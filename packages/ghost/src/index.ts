import '@magicpages/kalotyp-ui/styles.css';
import { openDefaultEditor } from './editor.js';
import { installGlobal } from './install-global.js';

if (typeof window !== 'undefined') {
  installGlobal(globalThis);
}

export type {
  EditorEventName,
  EditorEventPayloads,
  EditorInstance,
  EditorOptions,
  LoadErrorEvent,
  ProcessEvent,
} from './contract.js';
export { openDefaultEditor };
