import { randomBytes } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { ftpUploadDir, getFtpHelper } from "./ftp";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const MAX_DIMENSION = 1920;

/**
 * Kompres gambar soal: resize maksimal 1920px, luruskan EXIF orientation,
 * dan encode ulang per format. Hanya dipakai bila hasilnya lebih kecil;
 * GIF dan gambar animasi (webp multi-frame) dibiarkan apa adanya.
 */
async function compressImage(data: Buffer, ext: string): Promise<Buffer> {
  if (ext === ".gif") return data;
  const meta = await sharp(data).metadata();
  if ((meta.pages ?? 1) > 1) return data;

  const image = sharp(data).rotate().resize({
    width: MAX_DIMENSION,
    height: MAX_DIMENSION,
    fit: "inside",
    withoutEnlargement: true,
  });

  let output: Buffer;
  if (ext === ".png") {
    output = await image.png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
  } else if (ext === ".webp") {
    output = await image.webp({ quality: 82 }).toBuffer();
  } else {
    output = await image.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  }
  return output.length < data.length ? output : data;
}

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
  const original = Buffer.from(await file.arrayBuffer());
  const data = await compressImage(original, ext);

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
