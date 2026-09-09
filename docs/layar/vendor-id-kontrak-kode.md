# Layar — /vendor/[id]/kontrak/[kode]

| | |
|---|---|
| Rute Next | `/vendor/[id]/kontrak/[kode]` |
| Berkas | `src/app/(app)/vendor/[id]/kontrak/[kode]/page.tsx` |
| Menu ERP | PROYEK › Manajemen Proyek › Vendor Management › (drill-down) |
| RPC bootstrap | `proyek_vendor_kontrak_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `kontrakDetail()`

```json
null
```

### `petaOverrideBoq()`

_Bentuknya tidak tertangkap otomatis — turunkan dari klausa `select`-nya di_
_`src/lib/data/`._

## 2. Aksi yang bisa dipicu dari halaman ini

Nama RPC dan invariannya ada di `KONTRAK-RPC.md`.

- `angka`
- `batalSelesai`
- `hapusBarisBoqSpk`
- `hapusPembayaran`
- `hapusVo`
- `imporBoqSpk`
- `izinkan`
- `jalankan`
- `pilihan`
- `resetOverrideBoq`
- `tambahBarisBoqSpk`
- `tambahPembayaran`
- `tambahVo`
- `tandaiSelesai`
- `teks`
- `teksOpsional`
- `ubahBarisBoqSpk`
- `ubahOverrideBoq`
- `ubahStatusVo`
- `unggahRevisi`
- `wajibLolos`

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `progress` — Progress & Kontrak | ubah | tombol dan form hilang; isinya tetap terbaca |
| `hargaRabRap` — Harga RAB & RAP | lihat | bagian itu tidak digambar |

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

- `/vendor/[id]/kontrak/[kode]/[objek]` — halaman anak

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Data tidak ditemukan | halaman 404 Next |
| Belum masuk | diarahkan ke `/login` |
| Tidak berhak | kartu `<Terbatas>` menggantikan isinya |
| Tabel kosong | SPK ini belum mencakup unit atau sarana & prasarana mana pun. |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

