# Layar — /konstruksi/[kode]/laporan

| | |
|---|---|
| Rute Next | `/konstruksi/[kode]/laporan` |
| Berkas | `src/app/(app)/konstruksi/[kode]/laporan/page.tsx` |
| Menu ERP | PROYEK › Manajemen Proyek › Konstruksi › (drill-down) |
| RPC bootstrap | `proyek_konstruksi_laporan_bootstrap` |

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

## 2. Aksi yang bisa dipicu dari halaman ini

Tidak ada — halaman baca saja.

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `daftarUnit` — Daftar Unit | lihat | bagian itu tidak digambar |
| `daftarSarpras` — Daftar Sarpras | lihat | bagian itu tidak digambar |

## 4. Bisa masuk lebih dalam ke


## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Data tidak ditemukan | halaman 404 Next |
| Belum masuk | diarahkan ke `/login` |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

