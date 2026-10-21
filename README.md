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

## Alur ujian (tanpa sesi)

- Satu lomba OMBN (`competitionId`) = satu exam. Paket soal diplot per jenjang (SD/SMP/SMA) lewat `ExamPackage`.
- Peserta masuk lewat `competition_id` + jenjang sekolah (`schools.tingkat`).
- Setelah absensi, peserta menunggu di ruang tunggu sampai juri/petugas menekan **MULAI** (`phase = RUNNING`).
- Timer dihitung per peserta sejak pertama kali membuka soal: `expiresAt = startedAt + durationMinutes + extraSeconds`.
- Variabel `OMBN_DATABASE_URL` hanya untuk baca (login admin/peserta, daftar lomba di form admin).

Logo di `public/brand/logo.svg` adalah placeholder. Ganti dengan berkas resmi lembaga.
