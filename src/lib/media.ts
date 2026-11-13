/**
 * Mengubah path gambar internal (/uploads/...) menjadi URL route media
 * yang mampu menyajikan berkas dari disk lokal maupun server FTP.
 * URL absolut (http/https) dan path lain dikembalikan apa adanya.
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("/uploads/") && !path.includes("..")) {
    return `/api/media${path}`;
  }
  return path;
}
