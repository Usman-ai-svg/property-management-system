# Layar — /master/[kode]/tipe/[tipeKode]

| | |
|---|---|
| Rute Next | `/master/[kode]/tipe/[tipeKode]` |
| Berkas | `src/app/(app)/master/[kode]/tipe/[tipeKode]/page.tsx` |
| Menu ERP | PROYEK › Master Proyek › (drill-down) |
| RPC bootstrap | `proyek_master_tipe_tipeKode_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `detailTipeUnit()`

```json
null
```

## 2. Aksi yang bisa dipicu dari halaman ini

Nama RPC dan invariannya ada di `KONTRAK-RPC.md`.

- `angka`
- `hapusSarpras`
- `hapusTipeUnit`
- `hapusUnit`
- `imporTabel`
- `izinkan`
- `jalankan`
- `pilihan`
- `simpanBoqTipe`
- `simpanRapTipe`
- `simpanSarpras`
- `simpanTipeUnit`
- `tambahUnit`
- `teks`
- `teksOpsional`
- `ubahLegalitas`
- `ubahLokasiProyek`
- `ubahLuasLahan`
- `ubahUnit`
- `unggahRevisi`
- `wajibLolos`

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `hargaRabRap` — Harga RAB & RAP | ubah | tombol dan form hilang; isinya tetap terbaca |
| `dokumenTeknis` — Dokumen Teknis | ubah | tombol dan form hilang; isinya tetap terbaca |

### Kolom yang TIDAK BOLEH terkirim

Bukan kerapian tampilan. Kolom ini **tidak di-`SELECT` sama sekali** bila
perannya tidak berhak — menyembunyikannya di klien berarti angkanya tetap
sampai ke browser dan bisa dibaca lewat DevTools.

| Model | Kolom | Hilang untuk peran tanpa |
|---|---|---|
| `unit` | `hargaJual`, `rapUpah`, `boqItems`, `rapItems` | `hargaRabRap` |
| `infrastructure` | `rab`, `rapUpah`, `boqItems`, `rapItems` | `hargaRabRap` |
| `project` | `hargaPerM2`, `biayaPembelian`, `biayaNotaris`, `biayaBalikNama`, `biayaLegalLain` | `hargaRabRap` |
| `equipment` | `nilai` | `hargaRabRap` |
| `customWork` | `rapUpah`, `boqItems`, `rapItems` | `hargaRabRap` |

## 4. Bisa masuk lebih dalam ke

- `/master`

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Data tidak ditemukan | halaman 404 Next |
| Belum masuk | diarahkan ke `/login` |
| Tidak berhak | kartu `<Terbatas>` menggantikan isinya |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

