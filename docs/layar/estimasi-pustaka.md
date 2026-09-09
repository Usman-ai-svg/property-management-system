# Layar — /estimasi/pustaka

| | |
|---|---|
| Rute Next | `/estimasi/pustaka` |
| Berkas | `src/app/(app)/estimasi/pustaka/page.tsx` |
| Menu ERP | PROYEK › Estimasi RAB › Pustaka AHSP |
| RPC bootstrap | `proyek_estimasi_pustaka_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `pustakaAhsp()`

```json
{
  "analisa": [
    {
      "id": "cmttjbhor00aovotffmer5drm",
      "kode": "A.01",
      "uraian": "Pembersihan lapangan & perataan",
      "satuan": "m2",
      "kelompok": "Pekerjaan Persiapan",
      "overheadPct": 13,
      "komponen": [
        {
          "id": "cmttjbhos00apvotfd4a0t4n2",
          "koefisien": 0.1,
          "urutan": 0,
          "hargaDasar": "…"
        },
        "… 1 lagi"
      ]
    },
    "… 11 lagi"
  ],
  "hargaDasar": [
    {
      "id": "cmttjbhoo00amvotf3cgii0mr",
      "kode": "E.01",
      "kategori": "ALAT",
      "uraian": "Sewa concrete mixer (molen)",
      "satuan": "hari",
      "hargaAcuan": 350000,
      "_count": {
        "komponen": 1
      },
      "penawaran": [
        {
          "id": "cmttjbhop00anvotfkqn9im3y",
          "harga": 350000,
          "tanggal": "2026-09-09T03:24:25.801Z",
          "keterangan": "Termasuk operator",
          "pemasok": "…"
        }
      ]
    },
    "… 21 lagi"
  ],
  "pemasok": [
    {
      "id": "cmttjbhmu009nvotf6dpxu5e9",
      "nama": "CV Mitra Material Utama",
      "kategori": "Material",
      "kontakNama": "Sutrisno",
      "kontakTelepon": "0813-2000-3002",
      "alamat": "Jl. Industri Blok C7",
      "kecamatan": "Bekasi Selatan",
      "provinsi": "Jawa Barat",
      "status": "Aktif",
      "_count": {
        "penawaran": 6
      }
    },
    "… 2 lagi"
  ]
}
```

## 2. Aksi yang bisa dipicu dari halaman ini

Nama RPC dan invariannya ada di `KONTRAK-RPC.md`.

- `hapusAnalisa`
- `hapusBarisRab`
- `hapusHargaDasar`
- `hapusPemasok`
- `hapusPenawaran`
- `hapusRabEstimasi`
- `imporBarisRab`
- `jadikanAcuan`
- `segarkanHargaBaris`
- `simpanAnalisa`
- `simpanBarisRabEstimasi`
- `tambahHargaDasar`
- `tambahPemasok`
- `tambahPenawaran`
- `tambahRabEstimasi`
- `ubahBarisRab`
- `ubahHargaDasar`
- `ubahPemasok`
- `ubahRabEstimasi`

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

- `/estimasi`

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Belum masuk | diarahkan ke `/login` |
| Tidak berhak | diarahkan ke beranda |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

