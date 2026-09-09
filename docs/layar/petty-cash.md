# Layar — /petty-cash

| | |
|---|---|
| Rute Next | `/petty-cash` |
| Berkas | `src/app/(app)/petty-cash/page.tsx` |
| Menu ERP | PROYEK › Manajemen Proyek › Petty Cash |
| RPC bootstrap | `proyek_petty_cash_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `pettyCashPengguna()`

```json
[
  {
    "project": {
      "id": "cmttjbhly008ivotf28loy0y6",
      "kode": "GN2",
      "nama": "Griya Nanotech 2"
    },
    "funds": [
      {
        "id": "cmttjblon0631votfzpz2yeur",
        "plafon": 5000000,
        "aktif": true,
        "pemegang": {
          "id": "cmttjbln2062jvotf66k4h341",
          "nama": "Agus Pratama"
        },
        "topUps": [
          "…",
          "… 2 lagi"
        ],
        "saldo": 1050000,
        "laporan": [
          "…",
          "… 3 lagi"
        ],
        "draftReportId": "cmttjblpr063evotfss5em1a2"
      }
    ]
  },
  "… 1 lagi"
]
```

## 2. Aksi yang bisa dipicu dari halaman ini

Nama RPC dan invariannya ada di `KONTRAK-RPC.md`.

- `ajukanLaporanPetty`
- `beriDanaPetty`
- `catatPengeluaranPetty`
- `reimburseLaporanPetty`
- `transisiLaporanPetty`

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `pettyCash` — Petty Cash | ubah | tombol dan form hilang; isinya tetap terbaca |
| `keuangan` — Keuangan Operasional | ubah | tombol dan form hilang; isinya tetap terbaca |

## 4. Bisa masuk lebih dalam ke

Tidak ada.

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Belum masuk | diarahkan ke `/login` |
| Tidak berhak | kartu `<Terbatas>` menggantikan isinya |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

