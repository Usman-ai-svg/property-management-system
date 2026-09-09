# Layar — /estimasi/[id]

| | |
|---|---|
| Rute Next | `/estimasi/[id]` |
| Berkas | `src/app/(app)/estimasi/[id]/page.tsx` |
| Menu ERP | PROYEK › Estimasi RAB › RAB Estimasi › (drill-down) |
| RPC bootstrap | `proyek_estimasi_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `detailRabEstimasi()`

_Bentuknya tidak tertangkap otomatis — turunkan dari klausa `select`-nya di_
_`src/lib/data/`._

### `nomorSpkBerikutnya()`

```json
{
  "K": "001",
  "S": "001",
  "tahun": 2026
}
```

### `objekProyek()`

```json
{
  "units": [],
  "sarpras": []
}
```

### `vendorUntukPembanding()`

```json
[
  {
    "id": "cmttjbjd404wnvotf1fktjx2x",
    "nama": "CV Baja Jaya Mandiri",
    "bidang": "Struktur & Atap Baja"
  },
  "… 7 lagi"
]
```

## 2. Aksi yang bisa dipicu dari halaman ini

Nama RPC dan invariannya ada di `KONTRAK-RPC.md`.

- `ajukanRab`
- `buatKontrakDariRab`
- `hapusAnalisa`
- `hapusBarisRab`
- `hapusHargaDasar`
- `hapusPemasok`
- `hapusPenawaran`
- `hapusRabEstimasi`
- `hapusVendorPembanding`
- `imporBarisRab`
- `jadikanAcuan`
- `segarkanHargaBaris`
- `setujuiRab`
- `simpanAnalisa`
- `simpanBarisRabEstimasi`
- `simpanPemenang`
- `simpanPenawaranVendor`
- `tambahHargaDasar`
- `tambahPemasok`
- `tambahPenawaran`
- `tambahRabEstimasi`
- `tambahVendorPembanding`
- `tolakRab`
- `ubahBarisRab`
- `ubahHargaDasar`
- `ubahPemasok`
- `ubahRabEstimasi`

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `hargaRabRap` — Harga RAB & RAP | ubah | tombol dan form hilang; isinya tetap terbaca |
| `setujuiRab` — Setujui RAB Estimasi | ubah | tombol dan form hilang; isinya tetap terbaca |
| `progress` — Progress & Kontrak | ubah | tombol dan form hilang; isinya tetap terbaca |

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

- `/estimasi`

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Belum masuk | diarahkan ke `/login` |
| Tidak berhak | diarahkan ke beranda |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

