# Layar — /equipment

| | |
|---|---|
| Rute Next | `/equipment` |
| Berkas | `src/app/(app)/equipment/page.tsx` |
| Menu ERP | PROYEK › Manajemen Proyek › Equipment & Asset |
| RPC bootstrap | `proyek_equipment_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `dataAset()`

```json
{
  "peralatan": [
    {
      "id": "cmttjbjsw054fvotf52o9pc02",
      "kode": "BBD-010",
      "jenis": "Peralatan",
      "nama": "Bar Bender (Pembengkok Besi)",
      "kategori": "Pembesian",
      "merk": "Toyo TBB-25",
      "jumlah": 2,
      "jumlahRusak": 0,
      "satuan": "unit",
      "kepemilikan": "Milik Sendiri",
      "nilai": 19500000,
      "servisTerakhir": "2026-04-14T00:00:00.000Z",
      "servisBerikut": "2026-10-14T00:00:00.000Z",
      "vendorId": null,
      "vendor": null,
      "dipakai": 0,
      "tersedia": 2,
      "status": "Tersedia"
    },
    "… 14 lagi"
  ],
  "aset": [
    {
      "id": "cmttjbjte054lvotfszw5r985",
      "kode": "MBL-001",
      "jenis": "Aset",
      "nama": "Toyota Hilux Double Cabin 4x4",
      "kategori": "Kendaraan Operasional",
      "merk": "Toyota Hilux 2.4",
      "jumlah": 2,
      "jumlahRusak": 0,
      "satuan": "unit",
      "kepemilikan": "Milik Sendiri",
      "nilai": 485000000,
      "servisTerakhir": "2026-06-15T00:00:00.000Z",
      "servisBerikut": "2026-12-15T00:00:00.000Z",
      "vendorId": null,
      "vendor": null,
      "dipakai": 1,
      "tersedia": 1,
      "status": "Sebagian"
    },
    "… 2 lagi"
  ],
  "penggunaan": [
    {
      "id": "cmttjbls40640votfxeotzwym",
      "jumlah": 1,
      "tanggalMulai": "2026-08-05T00:00:00.000Z",
      "tanggalSelesai": null,
      "tarif": 350000,
      "penanggungJawab": "Fajar Ramadhan",
      "catatan": "Pengukuran & stake out (sewa)",
      "status": "Aktif",
      "dicatatOleh": "Fajar Ramadhan",
      "equipment": {
        "kode": "SRV-011",
        "nama": "Theodolite / Total Station",
        "satuan": "unit"
      },
      "project": {
        "kode": "NT4",
        "nama": "Nano Town 4"
      },
      "hari": 36,
      "biaya": 12600000
    },
    "… 14 lagi"
  ],
  "penyesuaian": [
    {
      "id": "cmttjblrc063qvotf1taj2kk6",
      "tanggal": "2026-09-09T03:24:31.080Z",
      "jenis": "Koreksi Stok",
      "banyak": -4,
      "jumlahSebelum": 97,
      "jumlahSesudah": 93,
      "rusakSebelum": 2,
      "rusakSesudah": 2,
      "keterangan": "Opname fisik gudang: tercatat lebih banyak daripada yang ada",
      "penanggungJawab": null,
      "dicatatOleh": "Budi Hartono",
      "equipment": {
        "kode": "SCF-001",
        "nama": "Scaffolding Frame Set (100 set)",
        "satuan": "set"
      }
    },
    "… 5 lagi"
  ],
  "servis": [
    {
      "id": "cmttjblsv0648votf8h7xxge3",
      "tanggal": "2026-06-28T00:00:00.000Z",
      "servisBerikut": "2026-08-28T00:00:00.000Z",
      "biaya": 1200000,
      "catatan": "Servis dinamo & ganti filter udara",
      "dicatatOleh": "Hendra Kurnia",
      "equipment": {
        "kode": "GEN-007",
        "nama": "Genset 5.000 Watt"
      }
    },
    "… 4 lagi"
  ],
  "daftarVendor": [
    {
      "id": "cmttjbjd404wnvotf1fktjx2x",
      "nama": "CV Baja Jaya Mandiri"
    },
    "… 7 lagi"
  ],
  "daftarProyek": [
    {
      "id": "cmttjbhly008ivotf28loy0y6",
      "nama": "Griya Nanotech 2"
    },
    "… 2 lagi"
  ]
}
```

## 2. Aksi yang bisa dipicu dari halaman ini

Nama RPC dan invariannya ada di `KONTRAK-RPC.md`.

- `catatPenyesuaianAset`
- `catatServis`
- `hapusAset`
- `hapusPenggunaan`
- `selesaikanPenggunaan`
- `tambahAset`
- `tambahPenggunaan`
- `ubahAset`

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `hargaRabRap` — Harga RAB & RAP | lihat | bagian itu tidak digambar |
| `aset` — Equipment & Asset | ubah | tombol dan form hilang; isinya tetap terbaca |
| `penyesuaianAset` — Penyesuaian Aset | ubah | tombol dan form hilang; isinya tetap terbaca |

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

Tidak ada.

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Belum masuk | diarahkan ke `/login` |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

