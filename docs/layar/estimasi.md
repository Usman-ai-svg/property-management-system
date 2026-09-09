# Layar — /estimasi

| | |
|---|---|
| Rute Next | `/estimasi` |
| Berkas | `src/app/(app)/estimasi/page.tsx` |
| Menu ERP | PROYEK › Estimasi RAB › RAB Estimasi |
| RPC bootstrap | `proyek_estimasi_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `daftarRabEstimasi()`

```json
[
  {
    "id": "cmttjbhq100csvotf5u81dmqz",
    "nomor": "RAB-EST-001",
    "nama": "RAB Estimasi Awal — Pematangan & Struktur Bawah",
    "status": "Draft",
    "tanggal": "2026-09-09T03:24:25.849Z",
    "project": {
      "kode": "NT2",
      "nama": "Nano Town 2"
    },
    "jumlahBaris": 9,
    "total": 173399755
  }
]
```

### `kpiEstimasi()`

```json
{
  "jumlahRab": 1,
  "totalNilai": 173399755,
  "jumlahAnalisa": 12,
  "jumlahHargaDasar": 22,
  "pemasokAktif": 3
}
```

### `proyekUntukEstimasi()`

```json
[
  {
    "id": "cmttjbhly008ivotf28loy0y6",
    "kode": "GN2",
    "nama": "Griya Nanotech 2"
  },
  "… 2 lagi"
]
```

## 2. Aksi yang bisa dipicu dari halaman ini

Nama RPC dan invariannya ada di `KONTRAK-RPC.md`.

- `simpanBarisRabEstimasi`

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `hargaRabRap` — Harga RAB & RAP | ubah | tombol dan form hilang; isinya tetap terbaca |

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

- `/estimasi/[id]` — halaman anak
- `/estimasi/pemasok/[id]` — halaman anak
- `/estimasi/pemasok` — halaman anak
- `/estimasi/pustaka` — halaman anak

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Belum masuk | diarahkan ke `/login` |
| Tidak berhak | diarahkan ke beranda |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

