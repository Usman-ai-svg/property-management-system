-- Data acuan modul PROYEK — dihasilkan oleh scripts/acuan-sql.mjs.
-- JANGAN disunting tangan: sumbernya prisma/acuan/*.json.
--
-- Dijalankan SESUDAH prisma/proyek.sql, sekali, sebelum tim mulai mengisi.
-- Aman dijalankan ulang: tiap baris punya id tetap dan diakhiri
-- "on conflict do nothing", jadi menjalankan dua kali tidak menggandakan
-- apa pun dan juga TIDAK menimpa nilai yang sudah disunting tim.
--
-- Matriks hak akses TIDAK di berkas ini — lihat prisma/acl.sql (npm run acl:sql).
-- Urutan pengisian data sesudah ini: docs/urutan-isi-data.md

begin;

-- 22 harga dasar. Nilainya harga awal yang WAJIB disesuaikan
-- tim sebelum dipakai menyusun RAB — yang acuan di sini strukturnya, bukan angkanya.
insert into proyek.harga_dasar ("id", "kode", "kategori", "uraian", "satuan", "hargaAcuan") values
  ('hd-l-01', 'L.01', 'UPAH', 'Pekerja', 'OH', 110000),
  ('hd-l-02', 'L.02', 'UPAH', 'Tukang batu', 'OH', 150000),
  ('hd-l-03', 'L.03', 'UPAH', 'Tukang kayu', 'OH', 150000),
  ('hd-l-05', 'L.05', 'UPAH', 'Kepala tukang', 'OH', 170000),
  ('hd-l-06', 'L.06', 'UPAH', 'Mandor', 'OH', 180000),
  ('hd-m-01', 'M.01', 'BAHAN', 'Semen Portland (PC)', 'kg', 1600),
  ('hd-m-02', 'M.02', 'BAHAN', 'Pasir pasang', 'm3', 250000),
  ('hd-m-03', 'M.03', 'BAHAN', 'Pasir beton (cor)', 'm3', 300000),
  ('hd-m-04', 'M.04', 'BAHAN', 'Batu belah/kali 15/20', 'm3', 350000),
  ('hd-m-05', 'M.05', 'BAHAN', 'Kerikil/split beton', 'm3', 400000),
  ('hd-m-06', 'M.06', 'BAHAN', 'Besi beton polos', 'kg', 15000),
  ('hd-m-07', 'M.07', 'BAHAN', 'Kawat beton (bendrat)', 'kg', 25000),
  ('hd-m-08', 'M.08', 'BAHAN', 'Kayu bekisting/papan', 'm3', 3500000),
  ('hd-m-09', 'M.09', 'BAHAN', 'Paku 5–10 cm', 'kg', 22000),
  ('hd-m-10', 'M.10', 'BAHAN', 'Bata ringan (hebel)', 'm3', 650000),
  ('hd-m-11', 'M.11', 'BAHAN', 'Semen instan (mortar)', 'sak', 62000),
  ('hd-m-12', 'M.12', 'BAHAN', 'Keramik lantai 40×40', 'm2', 65000),
  ('hd-m-13', 'M.13', 'BAHAN', 'Cat tembok interior', 'kg', 35000),
  ('hd-m-14', 'M.14', 'BAHAN', 'Pipa PVC AW 1/2"', 'btg', 45000),
  ('hd-m-15', 'M.15', 'BAHAN', 'Kabel NYM 3×2,5', 'm', 22000),
  ('hd-m-16', 'M.16', 'BAHAN', 'Saklar/stopkontak + aksesoris', 'titik', 45000),
  ('hd-e-01', 'E.01', 'ALAT', 'Sewa concrete mixer (molen)', 'hari', 350000)
on conflict ("id") do nothing;

-- 12 analisa harga satuan, koefisien bergaya SNI AHSP.
-- Harga satuannya TIDAK disimpan: selalu dihitung dari komponen × harga dasar.
insert into proyek.analisa_harga ("id", "kode", "uraian", "satuan", "kelompok", "overheadPct") values
  ('an-a-01', 'A.01', 'Pembersihan lapangan & perataan', 'm2', 'Pekerjaan Persiapan', 13),
  ('an-a-02', 'A.02', 'Pengukuran & pemasangan bouwplank', 'm''', 'Pekerjaan Persiapan', 13),
  ('an-a-03', 'A.03', 'Galian tanah biasa sedalam ≤ 1 m', 'm3', 'Pekerjaan Tanah', 13),
  ('an-a-04', 'A.04', 'Urugan kembali & pemadatan', 'm3', 'Pekerjaan Tanah', 13),
  ('an-a-05', 'A.05', 'Pasangan pondasi batu kali camp. 1:4', 'm3', 'Pekerjaan Struktur', 13),
  ('an-a-06', 'A.06', 'Beton bertulang K-225 (cor, besi & bekisting)', 'm3', 'Pekerjaan Struktur', 13),
  ('an-a-07', 'A.07', 'Pasangan dinding bata ringan', 'm2', 'Pekerjaan Arsitektur', 13),
  ('an-a-08', 'A.08', 'Plesteran & acian dinding', 'm2', 'Pekerjaan Arsitektur', 13),
  ('an-a-09', 'A.09', 'Pasang keramik lantai 40×40', 'm2', 'Pekerjaan Arsitektur', 13),
  ('an-a-10', 'A.10', 'Pengecatan tembok interior', 'm2', 'Pekerjaan Arsitektur', 13),
  ('an-a-11', 'A.11', 'Instalasi titik listrik', 'titik', 'Pekerjaan MEP', 13),
  ('an-a-12', 'A.12', 'Pemasangan pipa air bersih PVC 1/2"', 'm''', 'Pekerjaan MEP', 13)
on conflict ("id") do nothing;

-- 64 komponen analisa.
insert into proyek.komponen_analisa ("id", "analisaId", "hargaDasarId", "koefisien", "urutan") values
  ('ka-a-01-01', 'an-a-01', 'hd-l-01', 0.1, 0),
  ('ka-a-01-02', 'an-a-01', 'hd-l-06', 0.005, 1),
  ('ka-a-02-01', 'an-a-02', 'hd-l-01', 0.1, 0),
  ('ka-a-02-02', 'an-a-02', 'hd-l-03', 0.1, 1),
  ('ka-a-02-03', 'an-a-02', 'hd-l-05', 0.01, 2),
  ('ka-a-02-04', 'an-a-02', 'hd-l-06', 0.005, 3),
  ('ka-a-02-05', 'an-a-02', 'hd-m-08', 0.012, 4),
  ('ka-a-02-06', 'an-a-02', 'hd-m-09', 0.02, 5),
  ('ka-a-03-01', 'an-a-03', 'hd-l-01', 0.75, 0),
  ('ka-a-03-02', 'an-a-03', 'hd-l-06', 0.025, 1),
  ('ka-a-04-01', 'an-a-04', 'hd-l-01', 0.25, 0),
  ('ka-a-04-02', 'an-a-04', 'hd-l-06', 0.008, 1),
  ('ka-a-05-01', 'an-a-05', 'hd-m-04', 1.2, 0),
  ('ka-a-05-02', 'an-a-05', 'hd-m-01', 163, 1),
  ('ka-a-05-03', 'an-a-05', 'hd-m-02', 0.52, 2),
  ('ka-a-05-04', 'an-a-05', 'hd-l-01', 1.5, 3),
  ('ka-a-05-05', 'an-a-05', 'hd-l-02', 0.75, 4),
  ('ka-a-05-06', 'an-a-05', 'hd-l-05', 0.075, 5),
  ('ka-a-05-07', 'an-a-05', 'hd-l-06', 0.075, 6),
  ('ka-a-06-01', 'an-a-06', 'hd-m-01', 371, 0),
  ('ka-a-06-02', 'an-a-06', 'hd-m-03', 0.499, 1),
  ('ka-a-06-03', 'an-a-06', 'hd-m-05', 0.776, 2),
  ('ka-a-06-04', 'an-a-06', 'hd-m-06', 105, 3),
  ('ka-a-06-05', 'an-a-06', 'hd-m-07', 1.5, 4),
  ('ka-a-06-06', 'an-a-06', 'hd-m-08', 0.04, 5),
  ('ka-a-06-07', 'an-a-06', 'hd-m-09', 0.4, 6),
  ('ka-a-06-08', 'an-a-06', 'hd-l-01', 5.3, 7),
  ('ka-a-06-09', 'an-a-06', 'hd-l-02', 1, 8),
  ('ka-a-06-10', 'an-a-06', 'hd-l-05', 0.1, 9),
  ('ka-a-06-11', 'an-a-06', 'hd-l-06', 0.265, 10),
  ('ka-a-06-12', 'an-a-06', 'hd-e-01', 0.1, 11),
  ('ka-a-07-01', 'an-a-07', 'hd-m-10', 0.1, 0),
  ('ka-a-07-02', 'an-a-07', 'hd-m-11', 0.12, 1),
  ('ka-a-07-03', 'an-a-07', 'hd-l-01', 0.3, 2),
  ('ka-a-07-04', 'an-a-07', 'hd-l-02', 0.15, 3),
  ('ka-a-07-05', 'an-a-07', 'hd-l-05', 0.015, 4),
  ('ka-a-07-06', 'an-a-07', 'hd-l-06', 0.015, 5),
  ('ka-a-08-01', 'an-a-08', 'hd-m-11', 0.2, 0),
  ('ka-a-08-02', 'an-a-08', 'hd-l-01', 0.3, 1),
  ('ka-a-08-03', 'an-a-08', 'hd-l-02', 0.15, 2),
  ('ka-a-08-04', 'an-a-08', 'hd-l-05', 0.015, 3),
  ('ka-a-08-05', 'an-a-08', 'hd-l-06', 0.015, 4),
  ('ka-a-09-01', 'an-a-09', 'hd-m-12', 1.05, 0),
  ('ka-a-09-02', 'an-a-09', 'hd-m-11', 0.1, 1),
  ('ka-a-09-03', 'an-a-09', 'hd-l-01', 0.35, 2),
  ('ka-a-09-04', 'an-a-09', 'hd-l-02', 0.175, 3),
  ('ka-a-09-05', 'an-a-09', 'hd-l-05', 0.018, 4),
  ('ka-a-09-06', 'an-a-09', 'hd-l-06', 0.018, 5),
  ('ka-a-10-01', 'an-a-10', 'hd-m-13', 0.26, 0),
  ('ka-a-10-02', 'an-a-10', 'hd-l-01', 0.02, 1),
  ('ka-a-10-03', 'an-a-10', 'hd-l-02', 0.063, 2),
  ('ka-a-10-04', 'an-a-10', 'hd-l-05', 0.006, 3),
  ('ka-a-10-05', 'an-a-10', 'hd-l-06', 0.003, 4),
  ('ka-a-11-01', 'an-a-11', 'hd-m-15', 12, 0),
  ('ka-a-11-02', 'an-a-11', 'hd-m-16', 1, 1),
  ('ka-a-11-03', 'an-a-11', 'hd-l-01', 0.4, 2),
  ('ka-a-11-04', 'an-a-11', 'hd-l-02', 0.4, 3),
  ('ka-a-11-05', 'an-a-11', 'hd-l-05', 0.04, 4),
  ('ka-a-11-06', 'an-a-11', 'hd-l-06', 0.02, 5),
  ('ka-a-12-01', 'an-a-12', 'hd-m-14', 0.3, 0),
  ('ka-a-12-02', 'an-a-12', 'hd-l-01', 0.036, 1),
  ('ka-a-12-03', 'an-a-12', 'hd-l-02', 0.06, 2),
  ('ka-a-12-04', 'an-a-12', 'hd-l-05', 0.006, 3),
  ('ka-a-12-05', 'an-a-12', 'hd-l-06', 0.003, 4)
on conflict ("id") do nothing;

commit;
