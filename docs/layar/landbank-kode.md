# Layar — /landbank/[kode]

| | |
|---|---|
| Rute Next | `/landbank/[kode]` |
| Berkas | `src/app/(app)/landbank/[kode]/page.tsx` |
| Menu ERP | PROYEK › Landbank › (drill-down) |
| RPC bootstrap | `proyek_landbank_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `businessPlanProyek()`

```json
null
```

### `detailLandbank()`

```json
{
  "id": "cmttjbhj6005rvotf7z1t5260",
  "kode": "NT2",
  "nama": "Nano Town 2",
  "status": "Selesai",
  "kecamatan": "Bojongsari",
  "kota": "Kota Depok",
  "luasKavlingEfektif": 7800,
  "luasSarana": 620,
  "luasPrasarana": 1450,
  "luasRth": 780,
  "analisaDoc": {
    "id": "cmttjbhiz005pvotfpdghlas4",
    "kategori": "analisa",
    "versions": [
      {
        "id": "cmttjbhj0005qvotf4l8xr9lr",
        "revisi": "R1",
        "namaFile": "Analisa-Lahan-NT2.pdf",
        "ukuranByte": 2202010,
        "objectKey": null,
        "diunggahPada": "2022-11-18T00:00:00.000Z"
      }
    ]
  },
  "marketComparables": [
    {
      "id": "cmttjbhjs005yvotfyr3wkr6o",
      "nama": "Bojongsari Green",
      "jarak": 1.3,
      "tipe": [
        {
          "id": "cmttjbhjs005zvotfnacqivgc",
          "tipe": "Tipe 36",
          "jumlah": 68,
          "luasUnit": 36,
          "luasLahan": 60,
          "harga": 745000000
        },
        "… 1 lagi"
      ]
    },
    "… 1 lagi"
  ]
}
```

### `planVsRealisasi()`

```json
null
```

## 2. Aksi yang bisa dipicu dari halaman ini

Nama RPC dan invariannya ada di `KONTRAK-RPC.md`.

- `angka`
- `hapusBarisHpp`
- `hapusBarisOperasional`
- `hapusCashflow`
- `hapusKategoriHpp`
- `hapusKategoriOperasional`
- `hapusPembanding`
- `hapusPembayaranJual`
- `izinkan`
- `jalankan`
- `pilihan`
- `resetHargaDasarUnit`
- `simpanBarisHpp`
- `simpanBarisOperasional`
- `simpanCashflow`
- `simpanHargaDasarUnit`
- `simpanKategoriHpp`
- `simpanKategoriOperasional`
- `simpanPembanding`
- `simpanPembayaranJual`
- `teks`
- `teksOpsional`
- `ubahBiayaLahan`
- `unggahRevisi`
- `wajibLolos`

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `hargaRabRap` — Harga RAB & RAP | ubah | tombol dan form hilang; isinya tetap terbaca |
| `businessPlan` — Business Plan / Margin | ubah | tombol dan form hilang; isinya tetap terbaca |
| `keuangan` — Keuangan Operasional | ubah | tombol dan form hilang; isinya tetap terbaca |
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

- `/landbank`

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Data tidak ditemukan | halaman 404 Next |
| Belum masuk | diarahkan ke `/login` |
| Tabel kosong | Belum ada proyek pembanding. |
| Tabel kosong | Proyek ini belum punya unit. |
| Tabel kosong | Belum ada periode cashflow. |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

