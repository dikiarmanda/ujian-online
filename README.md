# Ujian Online

Aplikasi ujian Majelis Dikdasmen dan PNF PP Muhammadiyah. Arah visual ada di `DESIGN.md`.

## Menjalankan secara lokal

1. MySQL atau MariaDB, lalu buat database `ujian_online` dengan charset `utf8mb4`.
2. Redis di `127.0.0.1:6379`. Berkas `docker-compose.yml` menyediakan MySQL 8 dan Redis bila Docker berjalan.
3. Salin `.env.example` menjadi `.env`.
4. `npm install`
5. `npx prisma migrate dev`
6. `npm run db:seed`
7. `npm run dev` dan, di terminal lain, `npm run worker`

Mode mock menolak start bila `NODE_ENV=production`. Akun contoh setelah seed: identitas `admin`, `petugas`, atau `peserta`. Kata sandi apa saja diterima oleh driver mock.

Logo di `public/brand/logo.svg` adalah placeholder. Ganti dengan berkas resmi lembaga.
