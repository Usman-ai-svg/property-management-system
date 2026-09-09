# Layar — /konstruksi/[kode]

| | |
|---|---|
| Rute Next | `/konstruksi/[kode]` |
| Berkas | `src/app/(app)/konstruksi/[kode]/page.tsx` |
| Menu ERP | PROYEK › Manajemen Proyek › Konstruksi › (drill-down) |
| RPC bootstrap | `proyek_konstruksi_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `isiKonstruksiProyek()`

```json
{
  "unit": [],
  "sarpras": []
}
```

### `proyekKonstruksi()`

```json
{
  "id": "cmttjbhj6005rvotf7z1t5260",
  "kode": "NT2",
  "nama": "Nano Town 2",
  "status": "Selesai",
  "fases": [
    {
      "kode": "F1"
    },
    "… 1 lagi"
  ]
}
```

### `vendorKonstruksiProyek()`

```json
[]
```

## 2. Aksi yang bisa dipicu dari halaman ini

Tidak ada — halaman baca saja.

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `daftarUnit` — Daftar Unit | lihat | bagian itu tidak digambar |
| `daftarSarpras` — Daftar Sarpras | lihat | bagian itu tidak digambar |
| `progress` — Progress & Kontrak | lihat | bagian itu tidak digambar |
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

- `/konstruksi/[kode]/laporan` — halaman anak
- `/konstruksi/[kode]/sarpras/[kodeSarpras]` — halaman anak
- `/konstruksi/[kode]/unit/[unitKode]` — halaman anak
- `/konstruksi/[kode]/vendor/[kontrakKode]/[objek]` — halaman anak
- `/konstruksi/[kode]/vendor/[kontrakKode]` — halaman anak
- `/konstruksi`

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Data tidak ditemukan | halaman 404 Next |
| Belum masuk | diarahkan ke `/login` |
| Tidak berhak | kartu `<Terbatas>` menggantikan isinya |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

