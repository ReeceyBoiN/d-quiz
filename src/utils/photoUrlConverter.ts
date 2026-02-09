/**
 * Ensures a photo path is converted to a proper file:// URL
 * Handles data URLs, existing file URLs, network paths, and local paths
 * Prevents double-prefixing of file:// protocol
 */
export function ensureFileUrl(
  photoPath: string | undefined | null
): string | undefined {
  if (!photoPath) return undefined;
  if (typeof photoPath !== 'string') return undefined;

  // Accept data URLs (no conversion needed)
  if (photoPath.startsWith('data:')) return photoPath;

  // Accept already-proper file:// URLs (CRITICAL FIX)
  if (photoPath.startsWith('file://')) return photoPath;

  // Accept http(s) URLs as-is
  if (
    photoPath.startsWith('http://') ||
    photoPath.startsWith('https://')
  ) {
    return photoPath;
  }

  // Convert local filesystem paths to proper file:// URL
  let normalizedPath = photoPath.replace(/\\/g, '/');

  // Windows absolute path (C:/Users/...)
  if (normalizedPath.includes(':') && !normalizedPath.startsWith('file://')) {
    return `file:///${normalizedPath}`;
  }
  // Unix absolute path (/home/user/...)
  else if (normalizedPath.startsWith('/')) {
    return `file://${normalizedPath}`;
  }
  // Relative path (../../resources/photo.jpg)
  else {
    return `file://${normalizedPath}`;
  }
}
