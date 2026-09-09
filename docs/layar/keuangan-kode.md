# Layar — /keuangan/[kode]

| | |
|---|---|
| Rute Next | `/keuangan/[kode]` |
| Berkas | `src/app/(app)/keuangan/[kode]/page.tsx` |
| Menu ERP | PROYEK › Manajemen Proyek › Keuangan Proyek › (drill-down) |
| RPC bootstrap | `proyek_keuangan_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `hargaDasarUntukPembelian()`

```json
[
  {
    "id": "cmttjbhoo00amvotf3cgii0mr",
    "kode": "E.01",
    "uraian": "Sewa concrete mixer (molen)",
    "satuan": "hari",
    "hargaAcuan": 350000
  },
  "… 21 lagi"
]
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

### `kontrakUntukAlokasi()`

```json
{
  "kontrakUnit": [],
  "kontrakSarpras": []
}
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

### `pembelianProyek()`

```json
[]
```

### `proyekKeuangan()`

```json
{
  "id": "cmttjbhj6005rvotf7z1t5260",
  "kode": "NT2",
  "nama": "Nano Town 2",
  "status": "Selesai",
  "units": [
    {
      "id": "cmttjbhws00qwvotfxs8uneep",
      "kode": "NT2-F1-1",
      "nomor": 1,
      "hargaJual": 207526468,
      "rapUpahVolume": 1,
      "rapUpahHarga": 45028912,
      "phase": {
        "kode": "F1"
      },
      "unitType": {
        "nama": "Tipe 36"
      },
      "boqItems": [
        {
          "volume": 1,
          "hargaSatuan": 3500000
        },
        "… 11 lagi"
      ],
      "rapItems": [
        {
          "grup": "Material Alam",
          "volume": 7.04,
          "hargaSatuan": 400000
        },
        "… 49 lagi"
      ],
      "customWorks": []
    },
    "… 11 lagi"
  ],
  "infrastructures": [
    {
      "id": "cmttjbjag04tjvotfln43wk5z",
      "kode": "NT2-S1",
      "nama": "Jalan Lingkungan",
      "jenis": "Prasarana",
      "volume": "820 m²",
      "status": "Selesai",
      "progress": 100,
      "rab": 385000000,
      "rapUpahVolume": 1,
      "rapUpahHarga": 131670000,
      "boqItems": [
        {
          "volume": 1,
          "hargaSatuan": 15400000
        },
        "… 3 lagi"
      ],
      "rapItems": [
        {
          "grup": "Material Struktur & Dinding",
          "volume": 1,
          "hargaSatuan": 98821800
        },
        "… 2 lagi"
      ]
    },
    "… 1 lagi"
  ],
  "expenses": [
    {
      "id": "cmttjbk2h058evotf1igqupe0",
      "tanggal": "2026-07-19T00:00:00.000Z",
      "jenis": "Material",
      "peruntukan": "Unit (rumah dijual)",
      "metode": "Transfer",
      "uraian": "Keramik, cat & sanitair",
      "total": 30062160,
      "status": "Lunas",
      "pic": null,
      "bukti": null,
      "buktiKey": null,
      "kreditur": null,
      "tenggat": null,
      "contractId": null,
      "pembelianId": null,
      "alokasi": [
        {
          "id": "cmttjbk2i058fvotfwmq0by7j",
          "unitId": "cmttjbi28015svotfx1p17qvp",
          "infrastructureId": null,
          "nominal": 30062160
        }
      ],
      "cicilan": [],
      "contract": null,
      "pembelian": null
    },
    "… 100 lagi"
  ]
}
```

### `WARNA_JENIS()`

_Bentuknya tidak tertangkap otomatis — turunkan dari klausa `select`-nya di_
_`src/lib/data/`._

### `pemegangKandidat()`

```json
[]
```

### `pettyCashProyek()`

```json
[]
```

## 2. Aksi yang bisa dipicu dari halaman ini

Nama RPC dan invariannya ada di `KONTRAK-RPC.md`.

- `ajukanLaporanPetty`
- `bagikanBiayaUnitRata`
- `bayarPembelian`
- `beriDanaPetty`
- `buatPembelian`
- `catatPengeluaranPetty`
- `hapusPembayaran`
- `hapusPembelian`
- `reimburseLaporanPetty`
- `terimaPembelian`
- `transisiLaporanPetty`

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `keuangan` — Keuangan Operasional | ubah | tombol dan form hilang; isinya tetap terbaca |
| `pettyCash` — Petty Cash | ubah | tombol dan form hilang; isinya tetap terbaca |

## 4. Bisa masuk lebih dalam ke

- `/keuangan`

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Data tidak ditemukan | halaman 404 Next |
| Belum masuk | diarahkan ke `/login` |
| Tidak berhak | kartu `<Terbatas>` menggantikan isinya |
| Tabel kosong | Belum ada transaksi yang dicatat langsung ke unit ini. Biaya yang masuk lewat kontrak borongan muncul sebagai Alokasi Kontrak, bukan sebagai transaksi unit. |
| Tabel kosong | Proyek ini belum punya item sarana & prasarana. |
| Tabel kosong | Belum ada transaksi yang dicatat langsung ke item ini. Biaya yang masuk lewat kontrak vendor muncul sebagai Alokasi Kontrak. |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

