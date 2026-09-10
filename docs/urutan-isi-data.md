# Urutan pengisian data — hari pertama di ERP

Modul Proyek tidak bisa diisi dari mana saja. Sebagian besar barisnya menempel
pada baris lain: tidak ada unit sebelum ada tipe unit dan fase, tidak ada BOQ
sebelum ada objek yang di-BOQ-kan, tidak ada SPK sebelum ada vendor dan dokumen.
Mengisi dengan urutan yang salah berakhir dengan baris yang ditolak — atau lebih
buruk, baris yatim yang tidak muncul di layar mana pun.

Dokumen ini urutannya. Dipakai tim yang mengisi data pertama kali.

---

## 0. Prasyarat (sekali, oleh yang menyiapkan database)

| Langkah | Perintah | Isinya |
| --- | --- | --- |
| Buat tabel | jalankan `prisma/proyek.sql` | 60 tabel schema `proyek`, RLS aktif, tanpa policy tulis |
| Isi pustaka harga | jalankan `prisma/acuan.sql` | 22 harga dasar, 12 analisa harga satuan, 64 komponen |
| Isi matriks hak akses | jalankan `prisma/acl.sql` | 145 baris untuk 18 jabatan |
| Pastikan akun ada | sisi ERP | tiap orang punya akun di `auth.users`, dan jabatannya terisi di HRIS |

Ketiganya dihasilkan ulang dengan `npm run skema:sql`, `npm run acuan:sql`, dan
`npm run acl:sql`; jangan disunting tangan.

Setelah `acuan.sql` masuk, **harga dasarnya wajib disesuaikan** sebelum dipakai
menyusun RAB. Yang bersifat acuan di sana strukturnya (kode, kategori, satuan,
koefisien analisa), bukan angkanya — angka bawaannya kisaran wajar, bukan harga
yang berlaku di lokasi Anda.

Peta jabatan HRIS → hak akses modul ini ada di `src/lib/domain/jabatan.ts`.
Kalau ada jabatan baru di HRIS, tambahkan di sana; jabatan yang tidak terpetakan
tidak punya hak apa pun di modul Proyek. Instruksi untuk sisi ERP:
[`jabatan-erp.md`](jabatan-erp.md).

---

## 1. Proyek

Semua menggantung di sini. Satu baris per proyek: kode, nama, lokasi, luas,
tanggal mulai.

Kodenya dipakai di URL dan di kode unit (`NT4-F2-3`), jadi **tetapkan sekali dan
jangan diganti**. Mengganti kode proyek yang sudah punya unit berarti seluruh
kode unitnya ikut menyesatkan.

## 2. Fase

Per proyek: `F1`, `F2`, … Fase adalah pengelompokan waktu pembangunan; unit
harus menyebut fasenya, jadi fase harus ada lebih dulu.

Proyek yang tidak berfase pun tetap butuh satu fase — buat `F1` saja.

## 3. Tipe unit

Per proyek, bukan lintas proyek: desain tipe 45 di satu perumahan bukan tipe 45
yang sama di perumahan lain. Isi luas bangunan dan luas tanah standarnya.

Tipe unit boleh punya BOQ dan RAP sendiri. Itulah **templatnya**: unit baru
bertipe ini menyalin isinya saat pertama dibuat. Mengisi BOQ tipe lebih dulu
menghemat pekerjaan sebanyak jumlah unitnya.

## 4. Unit

Butuh: proyek + fase + tipe unit. Kodenya tersusun dari ketiganya.

**Jangan mengisi kolom turunan.** Status pembangunan disimpulkan dari progres,
status jual, dan tanggal serah terima — mengisinya manual akan tertimpa pada
kesempatan berikutnya. Yang diisi manusia: nomor, luas tanah (kalau berbeda dari
standar tipe), harga jual, dan status jual.

## 5. Sarana & prasarana

Per proyek, sejajar dengan unit: jalan, saluran, gerbang, taman. Punya BOQ dan
RAP sendiri seperti unit, dan bisa jadi objek SPK.

## 6. Legalitas & dokumen teknis

Legalitas menempel pada proyek; dokumen teknis (model 3D, gambar kerja, render,
spek) menempel pada tipe unit, unit, sarpras, kerja tambah, atau kontrak.

Karena dokumen menempel pada pemiliknya, **pemiliknya harus ada lebih dulu**.
Soal berkas mana yang diunggah dan mana yang cukup dicatat tautannya, lihat
[`berkas.md`](berkas.md).

## 7. Business plan (opsional, tapi sebaiknya awal)

Per proyek: HPP, omzet per tipe, biaya operasional, cashflow. Tidak menghalangi
pengisian lain, tapi ia yang menjadi pembanding seluruh realisasi nanti. Diisi
belakangan berarti tidak ada pembanding untuk bulan-bulan yang sudah lewat.

## 8. Pustaka harga & RAB Estimasi

Butuh: data acuan (langkah 0) sudah masuk dan harganya sudah disesuaikan.

Urutannya di dalam modul ini:

1. **Pemasok** — siapa yang menawarkan.
2. **Harga dasar** — upah, bahan, alat. Sudah terisi dari `acuan.sql`;
   sesuaikan angkanya, tambahkan yang kurang.
3. **Penawaran pemasok** — pembanding harga; menempel pada harga dasar.
4. **Analisa harga satuan** — koefisien × harga dasar. Sudah terisi 12 analisa;
   tambahkan sesuai kebutuhan. **Harga satuannya tidak diisi** — selalu dihitung
   dari komponennya.
5. **RAB Estimasi** — per proyek, menyusun baris dari analisa + volume.

RAB Estimasi punya alur persetujuan (Draft → Diajukan → Disetujui/Ditolak).
Isinya hanya bisa diubah saat Draft atau Ditolak.

## 9. Vendor & SPK

1. **Vendor** — master, dipakai lintas proyek. Isi lebih dulu.
2. **Kontrak/SPK** — butuh proyek + vendor + **dokumen SPK yang diunggah pada
   formulir yang sama**. Kontrak tanpa dasar tertulis ditolak; itu disengaja
   (lihat INV-16 di [`invarian.md`](invarian.md)).
3. **BOQ SPK** — baris pekerjaan kontrak. Bisa diimpor dari Excel; impornya
   mengganti seluruh isi, bukan menambah.
4. **Objek SPK** — unit dan/atau sarpras mana yang dikerjakan kontrak ini.

**Nilai SPK tidak diketik**: ia jumlah baris BOQ-nya. Retensi dihitung dari
persentase yang diisi di kontrak.

## 10. Peralatan & aset

Master alat dulu (global, bukan per proyek), baru penggunaannya per proyek.
Stok dan status alat adalah nilai turunan dari ledger penggunaan — jangan diisi
manual.

## 11. Petty cash

Butuh: proyek + orang yang memegang dana (satu dana per orang per proyek).
Pemegangnya harus sudah punya akun, dan berjabatan **logistic staff** atau
**manager proyek**. Alurnya (catat → ajukan → verifikasi → setujui → reimburse)
menyebut jabatan, bukan orang, jadi jabatan akunnya harus sudah benar sejak
awal. Satu aturan yang perlu diketahui sebelum menunjuk pemegang: **pemegang
dana tidak bisa memverifikasi pengajuannya sendiri**, jadi harus ada orang lain
berjabatan quantity surveyor asst atau head of operation.

## 12. Keuangan

Paling akhir, karena hampir semua pengeluaran menunjuk sesuatu: proyek, kontrak,
unit, sarpras, atau pembelian.

1. **Pembelian material** — butuh pemasok. PO Draft → Diterima.
2. **Pengeluaran** — butuh peruntukan yang jelas. Peruntukan menentukan ke mana
   angkanya masuk pada laporan; salah peruntukan berarti angka benar di tempat
   yang salah.
3. **Pembayaran kontrak** — butuh SPK dan progresnya.
4. **Hutang & cicilan** — untuk pengeluaran bermetode Hutang.

## 13. Progres

Paling akhir dari semuanya, karena progres diisi **per baris BOQ**. Tidak ada
BOQ, tidak ada yang bisa dilaporkan progresnya.

---

## Ringkasan ketergantungan

| Mau mengisi | Harus sudah ada |
| --- | --- |
| Fase | Proyek |
| Tipe unit | Proyek |
| Unit | Proyek, Fase, Tipe unit |
| Sarpras | Proyek |
| Dokumen teknis | Pemilik dokumennya (unit/tipe/sarpras/kontrak) |
| Analisa harga satuan | Harga dasar |
| RAB Estimasi | Proyek, Analisa |
| Kontrak/SPK | Proyek, Vendor, berkas SPK |
| BOQ SPK | Kontrak |
| Objek SPK | Kontrak, Unit/Sarpras |
| Penggunaan alat | Alat, Proyek |
| Petty cash | Proyek, akun pemegang |
| Pembelian | Pemasok |
| Pengeluaran | Proyek (+ peruntukannya) |
| Progres | BOQ objek yang bersangkutan |

## Yang TIDAK diisi manusia

Salah isi di sini tidak menimbulkan galat; angkanya hanya akan tertimpa diam-
diam pada perubahan berikutnya, dan sementara itu laporan menampilkan angka yang
tidak berasal dari mana-mana.

- Status pembangunan unit dan sarpras — turunan dari progres, status jual, dan
  tanggal serah terima.
- Stok dan status alat — turunan dari ledger penggunaan dan penyesuaian.
- Harga satuan analisa — dihitung dari komponen × harga dasar.
- Nilai SPK — jumlah baris BOQ kontrak.
- Total RAB/RAP — jumlah barisnya.
- Sisa dana petty cash — saldo top-up dikurangi laporan.
