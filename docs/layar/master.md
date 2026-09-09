# Layar — /master

| | |
|---|---|
| Rute Next | `/master` |
| Berkas | `src/app/(app)/master/page.tsx` |
| Menu ERP | PROYEK › Master Proyek |
| RPC bootstrap | `proyek_master_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `daftarProyek()`

```json
[
  {
    "id": "cmttjbhly008ivotf28loy0y6",
    "kode": "GN2",
    "nama": "Griya Nanotech 2",
    "status": "Pembangunan",
    "kelurahan": "Karadenan",
    "kecamatan": "Cibinong",
    "kota": "Kab. Bogor",
    "luasKavlingEfektif": 9000,
    "luasSarana": 700,
    "luasPrasarana": 1800,
    "luasRth": 900,
    "fases": [
      {
        "kode": "F1"
      }
    ],
    "_count": {
      "units": 15,
      "infrastructures": 3,
      "unitTypes": 2
    },
    "units": [
      {
        "boqItems": [
          "…",
          "… 11 lagi"
        ],
        "rapItems": [
          "…",
          "… 49 lagi"
        ],
        "rapUpahVolume": 1,
        "rapUpahHarga": 45028912,
        "customWorks": []
      },
      "… 14 lagi"
    ],
    "infrastructures": [
      {
        "rab": 465000000,
        "boqItems": [
          "…",
          "… 3 lagi"
        ],
        "rapItems": [
          "…",
          "… 2 lagi"
        ],
        "rapUpahVolume": 1,
        "rapUpahHarga": 159030000
      },
      "… 2 lagi"
    ],
    "totalRab": 3386576200,
    "totalRap": 3320323183.7999997
  },
  "… 2 lagi"
]
```

### `kpiMaster()`

```json
{
  "proyek": 3,
  "unit": 78,
  "tipeUnit": 7,
  "sarpras": 11
}
```

## 2. Aksi yang bisa dipicu dari halaman ini

Nama RPC dan invariannya ada di `KONTRAK-RPC.md`.

- `aturJumlahFase`
- `hapusProyek`
- `tambahProyek`
- `ubahProyek`

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `hargaRabRap` — Harga RAB & RAP | lihat | bagian itu tidak digambar |
| `deskripsi` — Deskripsi Proyek | ubah | tombol dan form hilang; isinya tetap terbaca |

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

- `/master/[kode]` — halaman anak
- `/master/[kode]/sarpras/[kodeSarpras]` — halaman anak
- `/master/[kode]/tipe/[tipeKode]` — halaman anak
- `/master/[kode]/unit/[unitKode]` — halaman anak

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Belum masuk | diarahkan ke `/login` |
| Tabel kosong | Belum ada proyek yang dapat Anda akses. |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

