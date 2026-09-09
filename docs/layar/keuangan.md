# Layar — /keuangan

| | |
|---|---|
| Rute Next | `/keuangan` |
| Berkas | `src/app/(app)/keuangan/page.tsx` |
| Menu ERP | PROYEK › Manajemen Proyek › Keuangan Proyek |
| RPC bootstrap | `proyek_keuangan_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `dataKeuangan()`

```json
{
  "proyek": [
    {
      "id": "cmttjbhly008ivotf28loy0y6",
      "kode": "GN2",
      "nama": "Griya Nanotech 2",
      "status": "Pembangunan",
      "jumlahUnit": 15,
      "rab": 3386576200,
      "rap": 3320323183.7999997,
      "realisasi": 2397245468
    },
    "… 2 lagi"
  ],
  "tren": [
    {
      "bulan": "Okt",
      "label": "Okt 2025",
      "nilai": 0
    },
    "… 11 lagi"
  ],
  "expenses": [
    {
      "id": "cmttjblpt063fvotfn8h4hf84",
      "tanggal": "2026-08-12T00:00:00.000Z",
      "jenis": "Material",
      "peruntukan": "Unit (rumah dijual)",
      "total": 900000,
      "uraian": "Semen & pasir tambahan finishing",
      "pic": "Agus Pratama",
      "project": {
        "nama": "Griya Nanotech 2"
      }
    },
    "… 637 lagi"
  ],
  "hutang": [
    {
      "id": "cmttjbjr6053svotf20ejt3dp",
      "kreditur": "Toko Bangunan Sejahtera",
      "uraian": "Semen & besi struktur Fase 2",
      "proyek": "Nano Town 4",
      "kodeProyek": "NT4",
      "total": 48500000,
      "terbayar": 0,
      "sisa": 48500000,
      "status": "Belum",
      "tenggat": "05 Agu 2026",
      "jatuhTempo": "lewat"
    },
    "… 5 lagi"
  ]
}
```

### `komposisi()`

```json
[
  {
    "nilai": null,
    "warna": "#999"
  }
]
```

### `pemasokUntukPembelian()`

```json
[
  {
    "id": "cmttjbhmu009nvotf6dpxu5e9",
    "nama": "CV Mitra Material Utama",
    "kategori": "Material"
  },
  "… 2 lagi"
]
```

### `pintuBayar()`

```json
[
  {
    "id": "cmttjbhly008ivotf28loy0y6",
    "nama": "Griya Nanotech 2",
    "units": [
      {
        "id": "cmttjbiyq041mvotf0ffuuljd",
        "label": "F1-1"
      },
      "… 14 lagi"
    ],
    "sarpras": [
      {
        "id": "cmttjbjce04vtvotff5q4m3io",
        "label": "Jalan Lingkungan · Prasarana"
      },
      "… 2 lagi"
    ],
    "kontrak": [
      {
        "id": "cmttjbjgh04ymvotfc3sx1ud3",
        "label": "GN2/K/2026/001 · Pemborong Hj. Hasim — Borongan rumah tip…",
        "nilai": 320000000,
        "terbayar": 201000000,
        "sisa": 119000000,
        "retensi": 16000000,
        "retensiPct": 5,
        "peruntukan": "Unit (rumah dijual)",
        "jenisBiaya": "Kontraktor",
        "cakupan": 4
      },
      "… 1 lagi"
    ],
    "po": [],
    "hutang": [
      {
        "id": "cmttjbjrv0541votf27abofdb",
        "label": "CV Mitra Material Utama — Keramik & cat finishing · sisa …",
        "kreditur": "CV Mitra Material Utama",
        "sisa": 18750000,
        "tenggat": "08 Agu 2026",
        "jatuhTempo": "lewat"
      },
      "… 1 lagi"
    ]
  },
  "… 2 lagi"
]
```

### `WARNA_JENIS()`

_Bentuknya tidak tertangkap otomatis — turunkan dari klausa `select`-nya di_
_`src/lib/data/`._

## 2. Aksi yang bisa dipicu dari halaman ini

Nama RPC dan invariannya ada di `KONTRAK-RPC.md`.

- `bayarHutang`
- `bayarPembelian`
- `catatPengeluaran`
- `tambahPembayaran`

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `keuangan` — Keuangan Operasional | ubah | tombol dan form hilang; isinya tetap terbaca |

## 4. Bisa masuk lebih dalam ke

- `/keuangan/[kode]` — halaman anak

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Belum masuk | diarahkan ke `/login` |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

