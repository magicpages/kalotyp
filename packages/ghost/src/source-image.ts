/**
 * Resolve any source input into a `File`. A `File` (not a `Blob`) is
 * required so the upload gets a sensible name: `gh-uploader.js:330` calls
 * `formData.append(this.paramName, file, file.name)` (contract §4.2).
 */
export async function sourceToFile(src: string | Blob | File): Promise<File> {
  if (src instanceof File) return src;
  if (src instanceof Blob) {
    return new File([src], 'kalotyp-image.png', { type: src.type || 'image/png' });
  }
  return fetchUrlAsFile(src);
}

async function fetchUrlAsFile(src: string): Promise<File> {
  const url = new URL(
    src,
    typeof window !== 'undefined' ? window.location.href : 'http://localhost',
  );
  const response = await fetch(url.href, { credentials: 'omit', mode: 'cors' });
  if (!response.ok) {
    throw new Error(`Source fetch failed: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  const name = inferFileName(url, blob.type);
  return new File([blob], name, { type: blob.type || 'application/octet-stream' });
}

function inferFileName(url: URL, mime: string): string {
  const last = url.pathname.split('/').pop();
  if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return last;
  const ext = mime.split('/')[1] ?? 'bin';
  return `kalotyp-image.${ext}`;
}
