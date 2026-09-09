# Layar — /konstruksi

| | |
|---|---|
| Rute Next | `/konstruksi` |
| Berkas | `src/app/(app)/konstruksi/page.tsx` |
| Menu ERP | PROYEK › Manajemen Proyek › Konstruksi |
| RPC bootstrap | `proyek_konstruksi_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `dashboardKonstruksi()`

```json
[
  {
    "id": "cmttjbhly008ivotf28loy0y6",
    "kode": "GN2",
    "nama": "Griya Nanotech 2",
    "status": "Pembangunan",
    "fases": [
      "F1"
    ],
    "jumlahUnit": 15,
    "dikerjakan": 15,
    "rataUnit": 48,
    "jumlahSarpras": 3,
    "rataSarpras": 55
  },
  "… 2 lagi"
]
```

## 2. Aksi yang bisa dipicu dari halaman ini

Tidak ada — halaman baca saja.

## 3. Sub-bagian izin — apa yang disembunyikan

Halaman ini tidak memeriksa sub-bagian apa pun; cukup sudah masuk.

## 4. Bisa masuk lebih dalam ke

- `/konstruksi/[kode]/laporan` — halaman anak
- `/konstruksi/[kode]` — halaman anak
- `/konstruksi/[kode]/sarpras/[kodeSarpras]` — halaman anak
- `/konstruksi/[kode]/unit/[unitKode]` — halaman anak
- `/konstruksi/[kode]/vendor/[kontrakKode]/[objek]` — halaman anak
- `/konstruksi/[kode]/vendor/[kontrakKode]` — halaman anak

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Belum masuk | diarahkan ke `/login` |
| Tabel kosong | Belum ada proyek yang dapat Anda akses. |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

