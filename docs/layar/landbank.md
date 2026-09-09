# Layar — /landbank

| | |
|---|---|
| Rute Next | `/landbank` |
| Berkas | `src/app/(app)/landbank/page.tsx` |
| Menu ERP | PROYEK › Landbank |
| RPC bootstrap | `proyek_landbank_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `dataLandbank()`

```json
{
  "proyek": [
    {
      "id": "cmttjbhly008ivotf28loy0y6",
      "kode": "GN2",
      "nama": "Griya Nanotech 2",
      "status": "Pembangunan",
      "kecamatan": "Cibinong",
      "kota": "Kab. Bogor",
      "luasKavlingEfektif": 9000,
      "luasSarana": 700,
      "luasPrasarana": 1800,
      "luasRth": 900,
      "analisaDocId": "cmttjbhlu008gvotf07lri8si",
      "_count": {
        "units": 15
      },
      "hargaPerM2": 115000,
      "biayaPembelian": 1426000000,
      "biayaNotaris": 30000000,
      "biayaBalikNama": 25000000,
      "biayaLegalLain": 19000000
    },
    "… 2 lagi"
  ],
  "rencana": [
    {
      "projectId": "cmttjbhj6005rvotf7z1t5260",
      "hpp": [
        {
          "rows": [
            "…",
            "… 1 lagi"
          ]
        },
        "… 3 lagi"
      ],
      "operasional": [
        {
          "rows": [
            "…",
            "… 1 lagi"
          ]
        },
        "… 2 lagi"
      ],
      "omzet": [
        {
          "hargaDasar": 780000000
        },
        "… 11 lagi"
      ]
    },
    "… 2 lagi"
  ]
}
```

## 2. Aksi yang bisa dipicu dari halaman ini

Tidak ada — halaman baca saja.

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `hargaRabRap` — Harga RAB & RAP | lihat | bagian itu tidak digambar |
| `businessPlan` — Business Plan / Margin | lihat | bagian itu tidak digambar |

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

- `/landbank/[kode]` — halaman anak

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Belum masuk | diarahkan ke `/login` |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

