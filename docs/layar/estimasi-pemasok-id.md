# Layar — /estimasi/pemasok/[id]

| | |
|---|---|
| Rute Next | `/estimasi/pemasok/[id]` |
| Berkas | `src/app/(app)/estimasi/pemasok/[id]/page.tsx` |
| Menu ERP | PROYEK › Estimasi RAB › Supplier › (drill-down) |
| RPC bootstrap | `proyek_estimasi_pemasok_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `detailPemasok()`

```json
{
  "id": "cmttjbhmq009mvotfjcqncq27",
  "nama": "Toko Bangunan Sejahtera",
  "kategori": "Material",
  "kontakNama": "Hendra",
  "kontakTelepon": "0812-1000-2001",
  "alamat": "Jl. Raya Serpong No. 21",
  "kecamatan": "Serpong",
  "provinsi": "Banten",
  "status": "Aktif",
  "penawaran": [
    {
      "id": "cmttjbho700aevotfrduilajo",
      "harga": 650000,
      "tanggal": "2026-09-09T03:24:25.783Z",
      "keterangan": null,
      "hargaDasar": {
        "id": "cmttjbho700advotf891jviz0",
        "kode": "M.10",
        "uraian": "Bata ringan (hebel)",
        "satuan": "m3",
        "kategori": "BAHAN",
        "hargaAcuan": 650000
      }
    },
    "… 5 lagi"
  ],
  "pembelian": [
    {
      "id": "cmttjbjqj053evotfjf7kdg1y",
      "nomor": "PO-2026-021",
      "status": "Diterima",
      "tanggal": "2026-07-28T00:00:00.000Z",
      "keterangan": "Material struktur Fase 2",
      "project": {
        "id": "cmttjbhkl006zvotfmyozrstk",
        "kode": "NT4",
        "nama": "Nano Town 4"
      },
      "items": [
        {
          "id": "cmttjbjqj053fvotfm4o2eo7j",
          "uraian": "Semen Portland 50kg",
          "satuan": "sak",
          "qty": 300,
          "harga": 62000,
          "hargaDasarId": null
        },
        "… 2 lagi"
      ],
      "pembayaran": [
        {
          "id": "cmttjbjqn053ivotfhrq94q1r",
          "tanggal": "2026-08-02T00:00:00.000Z",
          "uraian": "Uang muka PO PO-2026-021 — Toko Bangunan Sejahtera",
          "total": 25000000,
          "metode": "Transfer",
          "status": "DP"
        }
      ]
    },
    "… 1 lagi"
  ]
}
```

## 2. Aksi yang bisa dipicu dari halaman ini

Tidak ada — halaman baca saja.

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
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

- `/estimasi/pemasok`
- `/estimasi/pustaka`
- `/keuangan`

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Belum masuk | diarahkan ke `/login` |
| Tidak berhak | diarahkan ke beranda |
| Daftar kosong | kartu `<KartuKosong>` |
| Tabel kosong | Belum ada penawaran dari supplier ini. |
| Tabel kosong | Tidak ada barang. |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

