# Layar — /admin

| | |
|---|---|
| Rute Next | `/admin` |
| Berkas | `src/app/(app)/admin/page.tsx` |
| Menu ERP | (tidak ikut — pengelolaan pengguna sudah ada di ERP) |
| RPC bootstrap | `proyek_admin_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `dataAdmin()`

```json
{
  "proyek": [
    {
      "id": "cmttjbhly008ivotf28loy0y6",
      "kode": "GN2",
      "nama": "Griya Nanotech 2"
    },
    "… 2 lagi"
  ],
  "peran": [
    {
      "id": "cmttjbh5c000evotfjestshlj",
      "nama": "Admin",
      "grup": "fin",
      "_count": {
        "users": 1
      },
      "permissions": [
        {
          "roleNama": "Admin",
          "section": "deskripsi",
          "bolehUbah": false
        },
        "… 8 lagi"
      ]
    },
    "… 21 lagi"
  ],
  "users": [
    {
      "id": "cmttjbln2062jvotf66k4h341",
      "nama": "Agus Pratama",
      "inisial": "AP",
      "email": "agus.pratama@nanoland.id",
      "aktif": true,
      "semuaProyek": false,
      "roles": [
        {
          "role": "…"
        }
      ],
      "aksesProyek": [
        {
          "project": "…"
        },
        "… 1 lagi"
      ]
    },
    "… 16 lagi"
  ],
  "log": [
    {
      "id": "cmttjblo7062wvotfgcsog81f",
      "waktu": "2026-07-22T16:40:00.000Z",
      "peran": "Quantity Surveyor",
      "objek": "Unit F2-3 · RAB",
      "aksi": "Ubah baris BOQ",
      "nilaiDari": "Pek. Lantai & Keramik — Rp 285.000/m²",
      "nilaiKe": "Pek. Lantai & Keramik — Rp 298.000/m²",
      "user": {
        "nama": "Budi Hartono"
      },
      "project": {
        "kode": "NT4"
      }
    },
    "… 4 lagi"
  ]
}
```

## 2. Aksi yang bisa dipicu dari halaman ini

Nama RPC dan invariannya ada di `KONTRAK-RPC.md`.

- `hapusUser`
- `tambahUser`
- `ubahIzin`
- `ubahStatusUser`
- `ubahUser`

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `deskripsi` — Deskripsi Proyek | ubah | tombol dan form hilang; isinya tetap terbaca |

## 4. Bisa masuk lebih dalam ke

Tidak ada.

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Belum masuk | diarahkan ke `/login` |
| Tidak berhak | kartu `<Terbatas>` menggantikan isinya |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

