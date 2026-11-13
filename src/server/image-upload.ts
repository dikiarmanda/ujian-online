import { randomBytes } from "node:crypto";
import path from "node:path";
import { ftpUploadDir, getFtpHelper } from "./ftp";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

/**
 * Validasi dan simpan berkas gambar langsung ke server FTP pada folder soal
 * (default: <FTP_ROOT>/soal). Tidak menyentuh disk lokal.
 * Mengembalikan path /api/media/uploads/<nama> yang disajikan route media
 * (lokal → FTP_PUBLIC_URL → unduhan FTP).
 */
export async function storeQuestionImage(
  file: File,
): Promise<{ path: string; name: string }> {
  const ext = path.extname(file.name).toLowerCase();
  if (!IMAGE_EXTENSIONS.includes(ext)) {
    throw new Error("Jenis gambar tidak didukung.");
  }

  const name = `${randomBytes(16).toString("hex")}${ext}`;
  const data = Buffer.from(await file.arrayBuffer());

  const ftp = getFtpHelper();
  const remoteDir = ftpUploadDir();
  await ftp.withConnection(async () => {
    try {
      await ftp.mkdir(remoteDir, true);
    } catch {
      // Direktori mungkin sudah ada, abaikan error
    }
    await ftp.uploadBuffer(data, `${remoteDir}/${name}`);
  });

  // Path kanonis: langsung URL route media agar editor summernote bisa
  // menampilkan gambar tanpa menunggu render ulang.
  return { path: `/api/media/uploads/${name}`, name };
}
