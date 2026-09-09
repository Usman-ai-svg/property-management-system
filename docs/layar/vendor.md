# Layar — /vendor

| | |
|---|---|
| Rute Next | `/vendor` |
| Berkas | `src/app/(app)/vendor/page.tsx` |
| Menu ERP | PROYEK › Manajemen Proyek › Vendor Management |
| RPC bootstrap | `proyek_vendor_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `dataVendor()`

```json
{
  "vendor": [
    {
      "id": "cmttjbjd404wnvotf1fktjx2x",
      "nama": "CV Baja Jaya Mandiri",
      "bidang": "Struktur & Atap Baja",
      "kontak": "Rudi Santoso · 0812-1122-3344",
      "alamat": "Cibinong, Kab. Bogor",
      "status": "Aktif",
      "sejak": 2023,
      "contracts": [
        {
          "id": "cmttjbjdv04wvvotfdgkntdkn",
          "nominal": 900000000,
          "retensiPct": 5,
          "project": "…",
          "expenses": [
            "…",
            "… 2 lagi"
          ],
          "variationOrders": [
            "…",
            "… 1 lagi"
          ]
        }
      ]
    },
    "… 7 lagi"
  ],
  "daftarProyek": []
}
```

## 2. Aksi yang bisa dipicu dari halaman ini

Nama RPC dan invariannya ada di `KONTRAK-RPC.md`.

- `hapusKontrak`
- `hapusVendor`
- `tambahKontrak`
- `tambahVendor`
- `ubahKontrak`
- `ubahVendor`

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `progress` — Progress & Kontrak | ubah | tombol dan form hilang; isinya tetap terbaca |
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

- `/vendor/[id]/kontrak/[kode]/[objek]` — halaman anak
- `/vendor/[id]/kontrak/[kode]` — halaman anak
- `/vendor/[id]` — halaman anak

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Belum masuk | diarahkan ke `/login` |
| Tidak berhak | kartu `<Terbatas>` menggantikan isinya |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

