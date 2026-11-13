/**
 * Contoh penggunaan FTP Helper
 *
 * Pastikan environment variables sudah di-set:
 * FTP_HOST=ftp.example.com
 * FTP_PORT=21
 * FTP_USER=username
 * FTP_PASSWORD=password
 * FTP_SECURE=false
 */

import { getFtpHelper } from "./ftp";

// Contoh 1: Upload file
async function uploadExample() {
  const ftp = getFtpHelper();
  try {
    await ftp.uploadFile("/local/path/file.pdf", "/remote/path/file.pdf");
    console.log("Upload berhasil");
  } catch (error) {
    console.error("Upload gagal:", error);
  }
}

// Contoh 2: Download file
async function downloadExample() {
  const ftp = getFtpHelper();
  try {
    await ftp.downloadFile("/remote/path/file.pdf", "/local/path/file.pdf");
    console.log("Download berhasil");
  } catch (error) {
    console.error("Download gagal:", error);
  }
}

// Contoh 3: Hapus file
async function deleteExample() {
  const ftp = getFtpHelper();
  try {
    await ftp.deleteFile("/remote/path/file.pdf");
    console.log("File berhasil dihapus");
  } catch (error) {
    console.error("Hapus gagal:", error);
  }
}

// Contoh 4: Buat direktori
async function mkdirExample() {
  const ftp = getFtpHelper();
  try {
    await ftp.mkdir("/remote/path/new-folder", true);
    console.log("Direktori berhasil dibuat");
  } catch (error) {
    console.error("Buat direktori gagal:", error);
  }
}

// Contoh 5: List isi direktori
async function listExample() {
  const ftp = getFtpHelper();
  try {
    const files = await ftp.list("/remote/path");
    console.log("Isi direktori:", files);
  } catch (error) {
    console.error("List gagal:", error);
  }
}

// Contoh 6: Cek apakah file ada
async function existsExample() {
  const ftp = getFtpHelper();
  try {
    const exists = await ftp.exists("/remote/path/file.pdf");
    console.log("File ada:", exists);
  } catch (error) {
    console.error("Cek keberadaan gagal:", error);
  }
}

// Contoh 7: Rename file
async function renameExample() {
  const ftp = getFtpHelper();
  try {
    await ftp.rename("/remote/path/old.pdf", "/remote/path/new.pdf");
    console.log("File berhasil di-rename");
  } catch (error) {
    console.error("Rename gagal:", error);
  }
}

// Contoh 8: Menggunakan withConnection untuk operasi sekali pakai
async function withConnectionExample() {
  const ftp = getFtpHelper();
  try {
    await ftp.withConnection(async (client) => {
      // Operasi custom langsung dengan client ftp
      // client adalah instance dari library 'ftp'
      console.log("Koneksi terbuka");
      // Lakukan operasi lain di sini
    });
    console.log("Koneksi otomatis ditutup");
  } catch (error) {
    console.error("Operasi gagal:", error);
  }
}

// Contoh 9: Upload dengan auto-connect/disconnect
async function uploadAutoExample() {
  const ftp = getFtpHelper();
  try {
    await ftp.withConnection(async () => {
      await ftp.uploadFile("/local/file.pdf", "/remote/file.pdf");
    });
    console.log("Upload berhasil dengan auto disconnect");
  } catch (error) {
    console.error("Upload gagal:", error);
  }
}
