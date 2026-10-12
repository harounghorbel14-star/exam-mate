export type AllowedDocType = 'pdf' | 'docx' | 'txt' | 'md';
export type AllowedImageType = 'png' | 'jpg' | 'webp';

/**
 * Identify a document by its content (magic bytes), never by the client-supplied MIME type
 * or extension alone. Returns null for anything not explicitly allowed.
 */
export function detectDocumentType(buf: Buffer, filename: string): AllowedDocType | null {
  if (buf.length < 4) return null;
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    // DOCX is a ZIP containing word/document.xml; the name appears in the local file headers.
    return buf.includes(Buffer.from('word/document.xml')) && /\.docx$/i.test(filename) ? 'docx' : null;
  }
  if (isProbablyText(buf)) return /\.md$/i.test(filename) ? 'md' : /\.txt$/i.test(filename) ? 'txt' : null;
  return null;
}

export function isProbablyText(buf: Buffer): boolean {
  if (buf.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

export function detectImageType(buf: Buffer): AllowedImageType | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString('latin1') === 'PNG') return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return base.replace(/[\u0000-\u001f<>:"|?*]/g, '_').slice(0, 150) || 'file';
}
