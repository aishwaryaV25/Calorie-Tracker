import type { ChatDownload } from './types';

/** Hands a blob to the browser under the name the API chose. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function saveChatDownload(file: ChatDownload) {
  const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
  saveBlob(new Blob([bytes], { type: file.contentType }), file.filename);
}
