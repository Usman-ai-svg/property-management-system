# Layar — /master/[kode]

| | |
|---|---|
| Rute Next | `/master/[kode]` |
| Berkas | `src/app/(app)/master/[kode]/page.tsx` |
| Menu ERP | PROYEK › Master Proyek › (drill-down) |
| RPC bootstrap | `proyek_master_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `detailProyek()`

```json
{
  "proyek": {
    "id": "cmttjbhj6005rvotf7z1t5260",
    "kode": "NT2",
    "nama": "Nano Town 2",
    "status": "Selesai",
    "alamat": "Jl. Raya Bojongsari No. 21",
    "kelurahan": "Bojongsari Baru",
    "kecamatan": "Bojongsari",
    "kota": "Kota Depok",
    "provinsi": "Jawa Barat",
    "pinLat": -6.4021,
    "pinLng": 106.7532,
    "luasKavlingEfektif": 7800,
    "luasSarana": 620,
    "luasPrasarana": 1450,
    "luasRth": 780,
    "unitTypes": [
      {
        "id": "cmttjbhr600dcvotfb90tys2z",
        "kode": "T36",
        "nama": "Tipe 36",
        "luasBangunan": 36,
        "luasTanah": 60,
        "_count": {
          "units": 6
        }
      },
      "… 1 lagi"
    ],
    "fases": [
      {
        "id": "cmttjbhq500d2votf6lv4gibz",
        "kode": "F1",
        "nama": "Fase 1",
        "urutan": 0,
        "_count": {
          "units": 4
        }
      },
      "… 1 lagi"
    ],
    "legalitas": [
      {
        "id": "cmttjbhje005uvotffx8e7u5q",
        "nib": "8120003344215",
        "jenisHak": "Hak Milik (HM)",
        "nomorHak": "412",
        "sertifikat": "Induk, pemecahan selesai 8 unit",
        "luas": 5200,
        "dokumen": {
          "id": "cmttjbhjb005svotf3hlkznhw",
          "kategori": "legalitas",
          "versions": [
            "…"
          ]
        }
      },
      "… 1 lagi"
    ]
  },
  "unit": [
    {
      "id": "cmttjbhws00qwvotfxs8uneep",
      "kode": "NT2-F1-1",
      "nomor": 1,
      "luasTanah": 60,
      "phaseId": "cmttjbhq500d2votf6lv4gibz",
      "statusJual": "Serah Terima",
      "tanggalSerahTerima": "2026-04-09T03:24:26.080Z",
      "progress": 100,
      "_count": {
        "boqItems": 12
      },
      "phase": {
        "kode": "F1"
      },
      "unitType": {
        "kode": "T36",
        "nama": "Tipe 36",
        "luasBangunan": 36
      },
      "customWorks": [],
      "hargaJual": 207526468,
      "rapUpahVolume": 1,
      "rapUpahHarga": 45028912,
      "boqItems": [
        {
          "volume": 1,
          "hargaSatuan": 3500000
        },
        "… 11 lagi"
      ],
      "rapItems": [
        {
          "grup": "Material Alam",
          "volume": 7.04,
          "hargaSatuan": 400000
        },
        "… 49 lagi"
      ],
      "statusPembangunan": "Selesai"
    },
    "… 11 lagi"
  ],
  "sarpras": [
    {
      "id": "cmttjbjag04tjvotfln43wk5z",
      "kode": "NT2-S1",
      "nama": "Jalan Lingkungan",
      "jenis": "Prasarana",
      "volume": "820 m²",
      "status": "Selesai",
      "progress": 100,
      "_count": {
        "contractItems": 1,
        "boqItems": 4
      },
      "rab": 385000000,
      "boqItems": [
        {
          "volume": 1,
          "hargaSatuan": 15400000
        },
        "… 3 lagi"
      ]
    },
    "… 1 lagi"
  ],
  "bolehHarga": true,
  "bolehUnit": true,
  "bolehSarpras": true,
  "bolehDokumen": true
}
```

## 2. Aksi yang bisa dipicu dari halaman ini

Nama RPC dan invariannya ada di `KONTRAK-RPC.md`.

- `angka`
- `aturJumlahFase`
- `hapusProyek`
- `hapusSarpras`
- `hapusTipeUnit`
- `hapusUnit`
- `izinkan`
- `jalankan`
- `pilihan`
- `simpanSarpras`
- `simpanTipeUnit`
- `tambahProyek`
- `tambahUnit`
- `teks`
- `teksOpsional`
- `ubahLegalitas`
- `ubahLokasiProyek`
- `ubahLuasLahan`
- `ubahProyek`
- `ubahUnit`
- `unggahRevisi`
- `wajibLolos`

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `daftarUnit` — Daftar Unit | ubah | tombol dan form hilang; isinya tetap terbaca |
| `deskripsi` — Deskripsi Proyek | ubah | tombol dan form hilang; isinya tetap terbaca |
| `dokumenTeknis` — Dokumen Teknis | ubah | tombol dan form hilang; isinya tetap terbaca |
| `progress` — Progress & Kontrak | ubah | tombol dan form hilang; isinya tetap terbaca |
| `daftarSarpras` — Daftar Sarpras | ubah | tombol dan form hilang; isinya tetap terbaca |

## 4. Bisa masuk lebih dalam ke

- `/master/[kode]/sarpras/[kodeSarpras]` — halaman anak
- `/master/[kode]/tipe/[tipeKode]` — halaman anak
- `/master/[kode]/unit/[unitKode]` — halaman anak
- `/master`

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Belum masuk | diarahkan ke `/login` |
| Tidak berhak | kartu `<Terbatas>` menggantikan isinya |
| Tabel kosong | Belum ada tipe unit. Tambahkan tipe lebih dulu sebelum membuat unit. |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

