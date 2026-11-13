import { randomBytes } from "node:crypto";
import path from "node:path";
import { ftpUploadDir, getFtpHelper } from "./ftp";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

/**
 * Validasi dan simpan berkas gambar langsung ke server FTP pada folder soal
 * (default: <FTP_ROOT>/soal). Tidak menyentuh disk lokal.
 * Mengembalikan path logis /uploads/<nama> yang disajikan lewat /api/media.
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

  return { path: `/uploads/${name}`, name };
}
