import { createReadStream, statSync } from "node:fs";
import { stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { env } from "@/server/env";
import { ftpUploadDir, getFtpHelper } from "@/server/ftp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const FILE_NAME = /^[a-z0-9_-]+\.(png|jpe?g|webp|gif)$/i;

// Nama berkas bersifat unik dan immutable, jadi hasil unduhan FTP aman di-cache.
const ftpCacheDir = path.join(os.tmpdir(), "ujian-media");
const inflight = new Map<string, Promise<string>>();

function resolveName(segments: string[]): string | null {
  if (segments.length !== 2 || segments[0] !== "uploads") return null;
  const name = segments[1];
  return FILE_NAME.test(name) ? name : null;
}

function fileResponse(filePath: string, name: string): Response {
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": MIME_TYPES[path.extname(name).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": String(statSync(filePath).size),
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}

async function ensureFtpCached(name: string): Promise<string> {
  const cached = path.join(ftpCacheDir, name);
  const existing = inflight.get(name);
  if (existing) return existing;
  try {
    await stat(cached);
    return cached;
  } catch {
    // Belum ada di cache — unduh dari FTP.
  }
  const job = (async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(ftpCacheDir, { recursive: true });
    // Kandidat lokasi remote: folder soal saat ini (absolute & relatif),
    // lalu lokasi lama /uploads untuk berkas yang diupload sebelumnya.
    const dir = ftpUploadDir();
    const candidates = [
      `${dir}/${name}`,
      `${dir.replace(/^\/+/, "")}/${name}`,
      `/uploads/${name}`,
    ];
    const ftp = getFtpHelper();
    await ftp.withConnection(async () => {
      let lastError: unknown;
      for (const remotePath of candidates) {
        try {
          await ftp.downloadFile(remotePath, cached);
          return;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError;
    });
    return cached;
  })();
  inflight.set(name, job);
  try {
    return await job;
  } catch (error) {
    // Jangan sisakan file parsial yang bisa tersaji di request berikutnya.
    await import("node:fs/promises").then((fs) => fs.unlink(cached)).catch(() => undefined);
    throw error;
  } finally {
    inflight.delete(name);
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const name = resolveName(segments ?? []);
  if (!name) return new Response("Tidak ditemukan.", { status: 404 });

  const localPath = path.join(process.cwd(), "public", "uploads", name);
  try {
    await stat(localPath);
    return fileResponse(localPath, name);
  } catch {
    // Berkas tidak ada di disk lokal — coba FTP.
  }

  // Bila server FTP punya URL publik (HTTP), lempar ke sana agar tidak membebani aplikasi.
  // publicUrl diasumsikan menunjuk root FTP, jadi sertakan path remote lengkapnya.
  try {
    const publicUrl = env().ftp.publicUrl;
    if (publicUrl) {
      const remotePath = `${ftpUploadDir()}/${name}`;
      return Response.redirect(`${publicUrl.replace(/\/+$/, "")}${remotePath}`, 302);
    }
  } catch {
    // env belum tersedia — lanjut unduh via FTP.
  }

  try {
    const cached = await ensureFtpCached(name);
    return fileResponse(cached, name);
  } catch (error) {
    console.error(`Gagal mengambil gambar FTP /uploads/${name}:`, error);
    return new Response("Gambar tidak ditemukan.", { status: 404 });
  }
}
