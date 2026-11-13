import ftp from "ftp";
import * as fs from "fs";
import { env } from "./env";

type FtpClient = ftp & {
  ready?: boolean;
};

/**
 * FTP Helper untuk koneksi dan operasi file di server FTP
 * Konfigurasi diambil dari environment variables
 */
export class FtpHelper {
  private client: FtpClient;
  private config: ftp.Options;
  private connected: boolean = false;

  constructor() {
    const config = env().ftp;
    this.config = {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      secure: config.secure,
      secureOptions: {
        rejectUnauthorized: false,
      },
    };
    this.client = new ftp();
  }

  /**
   * Koneksi ke server FTP
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      this.client.on("ready", () => {
        this.connected = true;
        resolve();
      });

      this.client.on("error", (err) => {
        this.connected = false;
        reject(new Error(`FTP connection failed: ${err.message}`));
      });

      this.client.connect(this.config);
    });
  }

  /**
   * Putus koneksi dari server FTP
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    return new Promise((resolve, reject) => {
      this.client.on("close", () => {
        this.connected = false;
        resolve();
      });

      this.client.on("error", (err) => {
        this.connected = false;
        reject(new Error(`FTP disconnect failed: ${err.message}`));
      });

      this.client.end();
    });
  }

  /**
   * Upload file ke server FTP
   * @param localPath - Path file lokal
   * @param remotePath - Path file di server FTP
   */
  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      this.client.put(localPath, remotePath, (err) => {
        if (err) {
          reject(new Error(`FTP upload failed: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Upload buffer ke server FTP tanpa file sementara lokal
   * @param data - Buffer berisi data file
   * @param remotePath - Path file di server FTP
   */
  async uploadBuffer(data: Buffer, remotePath: string): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      this.client.put(data, remotePath, (err) => {
        if (err) {
          reject(new Error(`FTP upload failed: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Download file dari server FTP
   * @param remotePath - Path file di server FTP
   * @param localPath - Path file lokal untuk menyimpan
   */
  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      this.client.get(remotePath, (err, stream) => {
        if (err) {
          reject(new Error(`FTP download failed: ${err.message}`));
          return;
        }

        const writeStream = fs.createWriteStream(localPath);

        stream.pipe(writeStream);

        writeStream.on("finish", () => {
          writeStream.close();
          resolve();
        });

        writeStream.on("error", (err) => {
          reject(new Error(`FTP download write failed: ${err.message}`));
        });

        stream.on("error", (err) => {
          reject(new Error(`FTP download stream failed: ${err.message}`));
        });
      });
    });
  }

  /**
   * Hapus file di server FTP
   * @param remotePath - Path file di server FTP
   */
  async deleteFile(remotePath: string): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      this.client.delete(remotePath, (err) => {
        if (err) {
          reject(new Error(`FTP delete failed: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Buat direktori di server FTP
   * @param remotePath - Path direktori di server FTP
   * @param recursive - Buat direktori secara rekursif (default: true)
   */
  async mkdir(remotePath: string, recursive: boolean = true): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      this.client.mkdir(remotePath, recursive, (err) => {
        if (err) {
          reject(new Error(`FTP mkdir failed: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Hapus direktori di server FTP
   * @param remotePath - Path direktori di server FTP
   * @param recursive - Hapus direktori secara rekursif (default: true)
   */
  async rmdir(remotePath: string, recursive: boolean = true): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      this.client.rmdir(remotePath, recursive, (err) => {
        if (err) {
          reject(new Error(`FTP rmdir failed: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * List isi direktori di server FTP
   * @param remotePath - Path direktori di server FTP
   */
  async list(remotePath: string): Promise<ftp.ListingElement[]> {
    await this.connect();

    return new Promise((resolve, reject) => {
      this.client.list(remotePath, (err, list) => {
        if (err) {
          reject(new Error(`FTP list failed: ${err.message}`));
        } else {
          resolve(list || []);
        }
      });
    });
  }

  /**
   * Cek apakah file/direktori ada di server FTP
   * @param remotePath - Path file/direktori di server FTP
   */
  async exists(remotePath: string): Promise<boolean> {
    try {
      await this.list(remotePath);
      return true;
    } catch {
      // Jika error, asumsikan tidak ada
      return false;
    }
  }

  /**
   * Rename file/direktori di server FTP
   * @param oldPath - Path lama
   * @param newPath - Path baru
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      this.client.rename(oldPath, newPath, (err) => {
        if (err) {
          reject(new Error(`FTP rename failed: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Eksekusi operasi FTP dengan auto-connect dan auto-disconnect
   * Berguna untuk operasi sekali pakai
   */
  async withConnection<T>(operation: (client: FtpClient) => Promise<T>): Promise<T> {
    try {
      await this.connect();
      return await operation(this.client);
    } finally {
      await this.disconnect();
    }
  }
}

/**
 * Folder remote FTP untuk unggahan gambar soal (summernote).
 * Default: <FTP_ROOT>/soal, mis. /Documents/ujian/soal.
 */
export function ftpUploadDir(): string {
  const root = env().ftp.root.replace(/^\/+|\/+$/g, "");
  return `/${[root, "soal"].filter(Boolean).join("/")}`;
}

/**
 * Instance singleton FTP helper
 */
let ftpHelperInstance: FtpHelper | null = null;

export function getFtpHelper(): FtpHelper {
  if (!ftpHelperInstance) {
    ftpHelperInstance = new FtpHelper();
  }
  return ftpHelperInstance;
}
