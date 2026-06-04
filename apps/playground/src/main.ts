/// <reference lib="dom" />

// Shape of the global Ghost's loader expects the editor module to set
// (the global's name is fixed by Ghost's contract; the types are ours).
interface EditorGlobal {
  openDefaultEditor: (options: EditorOptions) => EditorInstance;
}
interface EditorOptions {
  src: string | Blob | File;
  util?: string;
  [k: string]: unknown;
}
interface EditorInstance {
  on(event: 'process', cb: (result: { dest: File }) => void): void;
  on(event: 'loaderror', cb: (err: { message: string }) => void): void;
}

const SAMPLES: ReadonlyArray<{ label: string; url: string }> = [
  {
    label: 'Landscape',
    url: 'https://images.unsplash.com/photo-1520503922584-590e8f7a90d7?w=2000&q=80',
  },
  {
    label: 'Portrait',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1400&q=80',
  },
  {
    label: 'Wide',
    url: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=2400&q=80',
  },
];

const log = document.getElementById('log') as HTMLPreElement;
const srcUrl = document.getElementById('src-url') as HTMLInputElement;
const srcFile = document.getElementById('src-file') as HTMLInputElement;
const utilSelect = document.getElementById('util') as HTMLSelectElement;
const openButton = document.getElementById('open') as HTMLButtonElement;
const resetButton = document.getElementById('reset') as HTMLButtonElement;
const samples = document.getElementById('samples') as HTMLDivElement;
const result = document.getElementById('result') as HTMLDivElement;
const resultMeta = document.getElementById('result-meta') as HTMLDivElement;
const resultImg = document.getElementById('result-img') as HTMLImageElement;
const resultDownload = document.getElementById('result-download') as HTMLAnchorElement;

let lastObjectUrl: string | null = null;

function stamp(): string {
  // Wall-clock isn't available to the build at module scope, but it is at
  // runtime in the browser — this file only runs in the browser.
  return new Date().toISOString().slice(11, 19);
}

function write(line: string, kind: 'info' | 'process' | 'error' = 'info'): void {
  const span = document.createElement('span');
  span.className = `ev-${kind}`;
  span.textContent = `[${stamp()}] ${line}\n`;
  log.appendChild(span);
  log.scrollTop = log.scrollHeight;
}

for (const sample of SAMPLES) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sample';
  btn.textContent = sample.label;
  btn.addEventListener('click', () => {
    srcUrl.value = sample.url;
    srcFile.value = '';
    write(`source set to ${sample.label.toLowerCase()} sample`);
  });
  samples.appendChild(btn);
}

write('Importing /kalotyp.js …');
const kalotypUrl = '/kalotyp.js';
await import(/* @vite-ignore */ kalotypUrl).catch((error: unknown) => {
  write(`import failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
  throw error;
});

const pintura = (globalThis as { pintura?: EditorGlobal }).pintura;
if (!pintura) {
  write('window.pintura is not set — build the ghost package first (pnpm build).', 'error');
  openButton.disabled = true;
} else {
  write(`window.pintura ready: { ${Object.keys(pintura).join(', ')} }`);
}

async function showResult(dest: File): Promise<void> {
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  lastObjectUrl = URL.createObjectURL(dest);

  const dims = await imageDimensions(lastObjectUrl);
  const dimsText = dims ? ` · ${dims.width}×${dims.height}px` : '';
  resultMeta.textContent = `${dest.name} · ${dest.type || 'unknown'} · ${formatBytes(dest.size)}${dimsText}`;
  resultImg.src = lastObjectUrl;
  resultDownload.href = lastObjectUrl;
  resultDownload.download = dest.name;
  result.classList.add('show');
}

function imageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.onerror = () => resolve(null);
    probe.src = url;
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

openButton.addEventListener('click', () => {
  if (!pintura) return;
  const file = srcFile.files?.[0];
  const src: string | File = file ?? srcUrl.value.trim();
  const util = utilSelect.value || undefined;
  write(
    `openDefaultEditor({ src: ${file ? `File("${file.name}")` : `"${src}"`}${util ? `, util: "${util}"` : ''} })`,
  );

  const editor = pintura.openDefaultEditor(util ? { src, util } : { src });
  editor.on('process', (r) => {
    write(`process → ${r.dest.name} (${formatBytes(r.dest.size)}, ${r.dest.type})`, 'process');
    void showResult(r.dest);
  });
  editor.on('loaderror', (err) => {
    write(`loaderror → ${err.message}`, 'error');
  });
});

resetButton.addEventListener('click', () => {
  log.replaceChildren();
  result.classList.remove('show');
  if (lastObjectUrl) {
    URL.revokeObjectURL(lastObjectUrl);
    lastObjectUrl = null;
  }
  for (const node of document.querySelectorAll('.pintura-editor')) node.remove();
  for (const node of document.querySelectorAll('[data-kalotyp-host]')) node.remove();
  write('reset');
});
