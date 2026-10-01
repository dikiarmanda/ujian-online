---
name: ujian-online
version: 0.2
institution: "Majelis Dikdasmen dan PNF PP Muhammadiyah"
colors:
  page: "#EEF1F2"
  paper: "#FFFFFF"
  ink: "#1C1B19"
  ink-muted: "#55524B"
  line: "#C9CED1"
  line-strong: "#77746C"
  brand: "#0F6B3E"
  brand-soft: "#E1EFE6"
  mark: "#FFF1CC"
  mark-edge: "#B26B00"
  mark-ink: "#6B4100"
  alert: "#B3261E"
typography:
  ui: "IBM Plex Sans"
  digits: "IBM Plex Mono"
  fallback: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
  scale: { xs: 12, sm: 14, base: 16, question: 18, lg: 20, xl: 24 }
radius: { sm: 4, md: 8 }
spacing-unit: 4
---

# DESIGN.md: Web Ujian Online

Arah visual untuk antarmuka peserta dan admin. Dokumen ini adalah arah desain yang dibutuhkan filter anti-slop: filter hanya membuang yang generik, sedangkan arahnya ada di sini.

**Lembaga:** Majelis Dikdasmen dan PNF PP Muhammadiyah (dikdasmenppmuhammadiyah.org). Warna aksen diselaraskan dengan hijau yang menjadi warna dominan logo Muhammadiyah. **Kode hex hijau di bawah adalah perkiraan**, karena berkas logo tidak dapat dibaca dari sini; ganti dengan nilai resmi dari logo atau pedoman identitas lembaga, lalu cek ulang kontrasnya. Prinsip dan batasan dokumen ini tetap berlaku bila nilainya berubah.

## 1. Subjek, pengguna, dan tugas utama

- **Subjek:** ujian online berskala 10.000 peserta bersamaan, dengan soal pilihan ganda dan uraian, milik Majelis Dikdasmen dan PNF PP Muhammadiyah.
- **Peserta:** pelajar atau mahasiswa yang sedang tegang, mengerjakan 60 sampai 120 menit, di laptop atau tablet lembaga, kadang dengan layar dan koneksi seadanya.
- **Admin dan petugas penilai:** bekerja berjam-jam dengan tabel data dan menilai jawaban uraian.
- **Tugas utama peserta:** membaca soal dengan nyaman, menjawab, dan selalu tahu sisa waktu serta soal mana yang belum selesai. Antarmuka tidak boleh mencuri perhatian.

## 2. Konsep: lembar ujian

Ujian ini terasa seperti lembar ujian kertas yang diisi satu per satu.

- **Soal berada di atas "kertas"** putih dengan batas tipis, di atas latar abu dingin yang tenang. Tidak ada kartu bertumpuk.
- **Warna aksen adalah hijau identitas lembaga (`brand`)**, satu-satunya warna aksen. Dipakai untuk jawaban terpilih, soal yang sudah dijawab, dan tombol utama.
- **Tanda ragu-ragu adalah stabilo kuning (`mark`)**, dengan penanda bendera, jadi tidak bergantung pada warna saja.
- **Panel kanan adalah lembar jawaban** (seperti LJK): grid nomor yang diisi seiring pengerjaan.

Satu hal yang dibuat paling berkarakter: grid nomor soal dan timer di panel kanan. Sisanya sengaja tenang.

### Logo dan nama lembaga

- Header menampilkan logo Majelis Dikdasmen dan PNF PP Muhammadiyah di kiri atas, setinggi 32 px di halaman peserta dan 40 px di halaman admin, diikuti nama ujian. Selama ujian berlangsung hanya logo kecil ini yang tampil; tidak ada banner.
- Halaman login dan ruang tunggu boleh memakai logo 64 px dengan nama lembaga lengkap di bawahnya.
- Logo tidak diwarnai ulang, tidak diberi bayangan, dan tidak ditempatkan di atas latar berwarna. Ruang kosong di sekelilingnya minimal setengah tinggi logo.
- Berkas logo (SVG atau PNG transparan) disediakan lembaga dan disimpan di server sendiri, tidak ditautkan langsung dari situs lembaga.
- Penulisan nama: "Majelis Dikdasmen dan PNF PP Muhammadiyah". Footer halaman login memuat hak cipta dengan nama ini.

## 3. Warna

| Token | Hex | Fungsi |
|---|---|---|
| `page` | `#EEF1F2` | Latar halaman |
| `paper` | `#FFFFFF` | Area soal, panel, tabel |
| `ink` | `#1C1B19` | Teks utama |
| `ink-muted` | `#55524B` | Teks sekunder, label |
| `line` | `#C9CED1` | Pemisah dekoratif ringan |
| `line-strong` | `#77746C` | Batas input dan kontrol (kontras 3:1 atau lebih) |
| `brand` | `#0F6B3E` | Aksen tunggal (hijau identitas): terpilih, terjawab, tombol utama |
| `brand-soft` | `#E1EFE6` | Latar item terpilih |
| `mark` / `mark-edge` / `mark-ink` | `#FFF1CC` / `#B26B00` / `#6B4100` | Ragu-ragu dan peringatan waktu |
| `alert` | `#B3261E` | Galat dan waktu kritis |

**Kontras terhitung:** `ink` pada `page` 15,2:1; `ink-muted` pada `page` 6,9:1; `brand` pada `paper` 6,6:1; teks putih pada `brand` 6,6:1; `brand` pada `brand-soft` 5,5:1; `mark-ink` pada `mark` 7,9:1; `alert` pada `page` 5,8:1; `line-strong` pada `page` 4,1:1.

**Aturan**
- Hanya satu aksen (`brand`). Kuning dan merah adalah status, bukan hiasan.
- Tidak ada gradien, tidak ada bayangan dekoratif, tidak ada efek kaca.
- Warna tidak pernah menjadi satu-satunya pembeda status (lihat bagian 5).

## 4. Tipografi

- **IBM Plex Sans** untuk seluruh antarmuka, **IBM Plex Mono** hanya untuk angka timer dan nomor soal agar lebarnya tetap (tabular).
- **Dilayani dari server sendiri** (woff2, subset Latin), bukan dari CDN font eksternal: pada 10.000 pengguna dan jaringan lembaga, ketergantungan ke pihak ketiga menambah risiko. Siapkan `fallback` sistem agar teks tetap terbaca bila font gagal dimuat.
- **Skala:** 12, 14, 16, 18, 20, 24 px. Tidak ada ukuran lain.
- **Teks soal:** 18 px, line-height 1,7, lebar baris maksimum sekitar 68 karakter, rata kiri.
- **Antarmuka:** 16 px untuk peserta, 14 px untuk tabel admin.
- Hierarki dibangun dengan ukuran dan bobot (400 dan 600), bukan dengan huruf kapital semua, aksen satu kata, atau label kecil di atas judul.

## 5. Halaman ujian peserta

```
+----------------------------------------------+-------------------+
|  Nama ujian · Sesi          [Tersimpan]      |   Sisa waktu      |
|                                              |     01:12:45      |
|  Soal 7 dari 40                              |-------------------|
|                                              |  [1][2][3][4][5]  |
|  Teks soal ...                               |  [6][7][8][9][10] |
|                                              |  ...              |
|  ( ) A. ...                                  |-------------------|
|  (o) B. ...                                  |  Terjawab    22   |
|  ( ) C. ...                                  |  Belum       15   |
|                                              |  Ragu-ragu    3   |
|  [Sebelumnya] [Tandai ragu-ragu] [Berikutnya]|  [Selesai]        |
+----------------------------------------------+-------------------+
```

- **Kiri (sekitar 70%):** soal di atas `paper`. Satu kolom, rata kiri. Opsi pilihan ganda berupa baris penuh yang bisa diklik di seluruh lebarnya, dengan huruf opsi di kiri. Uraian memakai textarea minimal 8 baris yang tumbuh sesuai isi.
- **Kanan (sekitar 30%, lebar tetap 320 px):** timer di atas, lalu grid nomor soal 5 kolom, lalu ringkasan jumlah, lalu tombol Selesai di bawah, terpisah dari grid agar tidak tertekan tidak sengaja.
- **Status nomor soal** (warna selalu disertai bentuk):

| Status | Tampilan |
|---|---|
| Belum dijawab | Kotak berbatas `line-strong`, isi `paper` |
| Terjawab | Isi `brand`, angka putih, tanda centang kecil |
| Ragu-ragu | Isi `mark`, batas `mark-edge`, penanda bendera di sudut |
| Soal yang sedang dibuka | Cincin 2 px `ink` di luar kotak (dapat digabung dengan status lain) |

- **Timer:** angka Plex Mono 24 px. Normal memakai `ink`. Sepuluh menit terakhir memakai `mark` dengan label teks "Sisa 10 menit". Lima menit terakhir memakai `alert` dengan label "Sisa 5 menit". Perubahan ambang diumumkan sekali ke pembaca layar (`aria-live="polite"`), bukan setiap detik.
- **Indikator simpan** di header soal, tiga keadaan: "Menyimpan", "Tersimpan", "Gagal menyimpan, mencoba lagi". Ini informasi kritis, jadi selalu terlihat dan tidak berupa toast yang hilang sendiri.
- **Tablet (di bawah 1024 px):** panel kanan menjadi laci dari sisi kanan yang dibuka lewat tombol "Daftar soal"; timer tetap menempel di header. Target sentuh minimal 44 px.
- **Layar penuh:** halaman meminta layar penuh sebelum ujian dimulai; peringatan pelanggaran tampil sebagai dialog modal yang jelas, bukan banner kecil.

## 6. Halaman admin dan penilaian

- Padat dan fungsional: navigasi samping tetap, tabel 14 px dengan baris tinggi 40 px, pemisah `line` tipis. Tidak ada baris zebra dan tidak ada kartu statistik dekoratif.
- **Status** (belum absen, mengerjakan, selesai, belum dinilai, sebagian, selesai dinilai) ditampilkan sebagai teks dengan penanda kecil, bukan lencana berwarna terang.
- **Layar penilaian uraian** terbagi dua: jawaban peserta di kiri, rubrik dan input skor di kanan. Jawaban yang sedang dikunci petugas lain tidak tampil; penanda kunci milik sendiri terlihat jelas dengan waktu kedaluwarsanya.
- **Laporan:** tabel dulu, grafik hanya bila membantu membandingkan (misalnya persentase benar per soal). Nilai selalu angka sebenarnya dari data, tidak pernah contoh yang dibuat-buat.

## 7. Bentuk, jarak, gerak

- **Radius:** hanya dua, 4 px (input, nomor soal, tombol) dan 8 px (dialog, laci). Tidak ada radius lain.
- **Batas, bukan bayangan:** pemisahan lewat garis 1 px. Bayangan hanya untuk dialog dan laci yang melayang di atas konten.
- **Jarak:** kelipatan 4 px. Ruang antar blok soal besar; ruang dalam panel kanan rapat.
- **Gerak:** hampir tidak ada. Hanya transisi 100 ms pada fokus dan pemilihan jawaban, serta pembukaan dialog dan laci. Tidak ada animasi masuk saat halaman dimuat, tidak ada hitung naik pada angka, tidak ada konfeti saat ujian dikirim. Hormati `prefers-reduced-motion`.
- **Fokus keyboard:** cincin 2 px `brand` dengan offset 2 px di semua kontrol. Pindah soal lewat keyboard harus bisa, dengan urutan tab: soal, jawaban, navigasi, panel.

## 8. Bahasa antarmuka

Bahasa Indonesia baku yang ramah, memakai "Anda", kalimat biasa (bukan huruf kapital), tanpa tanda seru, tanpa emoji. Galat menyebut apa yang terjadi dan apa yang perlu dilakukan. Satu tindakan memakai satu nama di seluruh alur.

| Situasi | Teks |
|---|---|
| Tombol utama peserta | "Simpan dan lanjut", "Kirim jawaban" |
| Konfirmasi kirim | "Anda masih memiliki 3 soal belum dijawab dan 2 soal ditandai ragu-ragu. Kirim jawaban sekarang?" |
| Keluar layar penuh | "Anda keluar dari layar penuh. Kembali ke layar penuh untuk melanjutkan. Kejadian ini dicatat." |
| Pindah tab | "Anda meninggalkan halaman ujian. Kejadian ini dicatat." |
| Gagal menyimpan | "Jawaban belum tersimpan. Menghubungkan ulang, jangan tutup halaman ini." |
| Login gagal | "Identitas atau kata sandi tidak cocok. Periksa lalu coba lagi." |
| Sistem asal tidak merespons | "Layanan masuk sedang tidak dapat dihubungi. Coba lagi dalam beberapa saat." |
| Ruang tunggu | "Ujian dimulai pukul 08.00. Tombol mulai aktif otomatis pada waktunya." |

## 9. Yang tidak boleh ada

- Gradien, efek kaca, ilustrasi dekoratif, ikon di setiap fitur.
- Lencana "AI", simbol kilau, atau klaim angka yang tidak berasal dari data.
- Banyak aksen warna, banyak ukuran huruf, banyak radius.
- Kartu seragam bertumpuk dan bayangan abu yang sama di semua elemen.
- Animasi masuk, hitung naik, konfeti, atau suara.
- Penanda status yang hanya berbeda warna.

## 10. Pemetaan ke Tailwind CSS

Token di bagian frontmatter dipetakan ke `tailwind.config.js` agar tidak ada warna atau ukuran di luar daftar ini.

```js
module.exports = {
  theme: {
    colors: {
      transparent: 'transparent', white: '#FFFFFF',
      page: '#EEF1F2', paper: '#FFFFFF', ink: '#1C1B19', 'ink-muted': '#55524B',
      line: '#C9CED1', 'line-strong': '#77746C',
      brand: '#0F6B3E', 'brand-soft': '#E1EFE6',
      mark: '#FFF1CC', 'mark-edge': '#B26B00', 'mark-ink': '#6B4100',
      alert: '#B3261E',
    },
    borderRadius: { none: '0', sm: '4px', md: '8px' },
    fontFamily: {
      ui: ['"IBM Plex Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      digits: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
    },
    fontSize: {
      xs: '12px', sm: '14px', base: '16px', question: ['18px', '1.7'], lg: '20px', xl: '24px',
    },
    boxShadow: { none: 'none', overlay: '0 8px 24px rgba(28,27,25,0.18)' },
  },
};
```

## 11. Catatan penggunaan

- Letakkan berkas ini di akar repositori sebagai `DESIGN.md`. Filter anti-slop merujuk ke sini untuk palet dan arah visual.
- Nilai warna, font, dan teks bersifat usulan awal. Hijau `brand` adalah perkiraan dari warna dominan logo Muhammadiyah; ganti dengan hex resmi lembaga terlebih dahulu dan cek ulang kontrasnya (teks putih pada `brand` harus tetap minimal 4,5:1).
- Setelah halaman ujian pertama jadi, tinjau terhadap bagian 5 dan 9, lalu perbarui dokumen ini bila ada keputusan baru.
