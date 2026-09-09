# Layar — Ringkasan

| | |
|---|---|
| Rute Next | `/` |
| Berkas | `src/app/(app)/page.tsx` |
| Menu ERP | PROYEK › Ringkasan |
| RPC bootstrap | `proyek_ringkasan_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `ringkasanProyek()`

```json
[
  {
    "id": "cmttjbhly008ivotf28loy0y6",
    "kode": "GN2",
    "nama": "Griya Nanotech 2",
    "status": "Pembangunan",
    "jumlahUnit": 15,
    "unitProgress": 15,
    "unitSelesai": 0,
    "rataProgress": 48,
    "anggaran": 2369653183.7999997,
    "realisasi": 2397245468,
    "nilaiJual": 3405978204
  },
  "… 2 lagi"
]
```

### `kpiSeluruhFitur()`

```json
[
  {
    "id": "equipment",
    "judul": "Equipment & Asset",
    "href": "/equipment",
    "angka": [
      {
        "label": "Total Aset",
        "nilai": "18 jenis",
        "catatan": "105 unit sedang dipakai"
      },
      "… 3 lagi"
    ]
  }
]
```

## 2. Aksi yang bisa dipicu dari halaman ini

Tidak ada — halaman baca saja.

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `keuangan` — Keuangan Operasional | lihat | bagian itu tidak digambar |

## 4. Bisa masuk lebih dalam ke


## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Belum masuk | diarahkan ke `/login` |
| Tidak berhak | kartu `<Terbatas>` menggantikan isinya |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

