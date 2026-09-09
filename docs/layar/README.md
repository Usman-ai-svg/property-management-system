# Peta Layar Modul PROYEK

Satu berkas spesifikasi per halaman, untuk orang yang menulis ulang tampilannya
di `proyek.js`. Tanpa ini, penulisnya membaca JSX sambil menebak data mana yang
datang dari server dan mana yang dihitung di klien.

Tiap berkas memuat lima hal, sesuai permintaan panduan:

1. **Data dari server** — dalam JSON, dan JSON-nya **ditangkap dari basis data
   demo**, bukan dikarang: tiap fungsi `src/lib/data` benar-benar dipanggil lalu
   keluarannya diringkas. Inilah yang harus dikembalikan RPC `*_bootstrap`.
2. **Aksi** yang bisa dipicu dari halaman itu — nama RPC dan invariannya ada di
   `KONTRAK-RPC.md`.
3. **Sub-bagian izin**, beserta apa yang hilang bila perannya tidak berhak —
   termasuk daftar **kolom yang tidak boleh terkirim**.
4. **Drill-down** ke halaman mana saja.
5. **Keadaan** kosong, memuat, dan galat.

## Yang paling mudah keliru saat menulis ulang

**Kolom terbatas bukan urusan tampilan.** Di repo ini, kolom yang tidak boleh
dilihat **tidak di-`SELECT` sama sekali** — bukan diambil lalu disembunyikan.
Menyembunyikannya di klien berarti angka RAB, harga jual, dan business plan
tetap sampai ke browser dan bisa dibaca siapa pun lewat DevTools. Tiap berkas
menyebut kolom mana yang hilang untuk peran mana; aturannya sendiri ada di
`src/lib/auth/kolom-terbatas.ts` dan bisa dibaca mesin saat menulis RPC.

**Tidak ada keadaan "memuat" di klien.** Seluruh halaman adalah Server
Component: halamannya baru terkirim setelah datanya siap. Di ERP, `proyek.js`
mengambil data lewat `fetch`, jadi keadaan memuat itu **baru muncul di sana** —
ia harus dirancang, bukan disalin, karena memang belum ada padanannya di sini.

**Galat aksi tidak mengganti halaman.** `jalankan()` mengubah lemparan jadi
pesan yang ditampilkan di dalam form. Perilaku itu perlu ditiru: mengganti
halaman saat gagal menyimpan berarti isian pengguna hilang.

## Daftar halaman

30 halaman. Kolom **data** = berapa fungsi `src/lib/data` yang dipanggil;
**aksi** = berapa Server Action yang bisa dipicu dari halaman itu.

| Rute Next | Menu ERP | data | aksi |
|---|---|---:|---:|
| [`/plan-realisasi`](plan-realisasi.md) | (lebur ke Landbank › Business Plan) | 0 | 0 |
| [`/admin`](admin.md) | (tidak ikut — pengelolaan pengguna sudah ada di ERP) | 1 | 5 |
| [`/estimasi/pustaka`](estimasi-pustaka.md) | PROYEK › Estimasi RAB › Pustaka AHSP | 1 | 19 |
| [`/estimasi`](estimasi.md) | PROYEK › Estimasi RAB › RAB Estimasi | 3 | 1 |
| [`/estimasi/[id]`](estimasi-id.md) | PROYEK › Estimasi RAB › RAB Estimasi › (drill-down) | 4 | 27 |
| [`/estimasi/pemasok`](estimasi-pemasok.md) | PROYEK › Estimasi RAB › Supplier | 1 | 1 |
| [`/estimasi/pemasok/[id]`](estimasi-pemasok-id.md) | PROYEK › Estimasi RAB › Supplier › (drill-down) | 1 | 0 |
| [`/landbank`](landbank.md) | PROYEK › Landbank | 1 | 0 |
| [`/landbank/[kode]`](landbank-kode.md) | PROYEK › Landbank › (drill-down) | 3 | 25 |
| [`/equipment`](equipment.md) | PROYEK › Manajemen Proyek › Equipment & Asset | 1 | 8 |
| [`/keuangan`](keuangan.md) | PROYEK › Manajemen Proyek › Keuangan Proyek | 5 | 4 |
| [`/keuangan/[kode]`](keuangan-kode.md) | PROYEK › Manajemen Proyek › Keuangan Proyek › (drill-down) | 9 | 11 |
| [`/konstruksi`](konstruksi.md) | PROYEK › Manajemen Proyek › Konstruksi | 1 | 0 |
| [`/konstruksi/[kode]/laporan`](konstruksi-kode-laporan.md) | PROYEK › Manajemen Proyek › Konstruksi › (drill-down) | 2 | 0 |
| [`/konstruksi/[kode]/sarpras/[kodeSarpras]`](konstruksi-kode-sarpras-kodeSarpras.md) | PROYEK › Manajemen Proyek › Konstruksi › (drill-down) | 2 | 7 |
| [`/konstruksi/[kode]/unit/[unitKode]`](konstruksi-kode-unit-unitKode.md) | PROYEK › Manajemen Proyek › Konstruksi › (drill-down) | 2 | 7 |
| [`/konstruksi/[kode]/vendor/[kontrakKode]/[objek]`](konstruksi-kode-vendor-kontrakKode-objek.md) | PROYEK › Manajemen Proyek › Konstruksi › (drill-down) | 2 | 6 |
| [`/konstruksi/[kode]/vendor/[kontrakKode]`](konstruksi-kode-vendor-kontrakKode.md) | PROYEK › Manajemen Proyek › Konstruksi › (drill-down) | 2 | 0 |
| [`/konstruksi/[kode]`](konstruksi-kode.md) | PROYEK › Manajemen Proyek › Konstruksi › (drill-down) | 3 | 0 |
| [`/petty-cash`](petty-cash.md) | PROYEK › Manajemen Proyek › Petty Cash | 1 | 5 |
| [`/vendor`](vendor.md) | PROYEK › Manajemen Proyek › Vendor Management | 1 | 6 |
| [`/vendor/[id]/kontrak/[kode]/[objek]`](vendor-id-kontrak-kode-objek.md) | PROYEK › Manajemen Proyek › Vendor Management › (drill-down) | 2 | 6 |
| [`/vendor/[id]/kontrak/[kode]`](vendor-id-kontrak-kode.md) | PROYEK › Manajemen Proyek › Vendor Management › (drill-down) | 2 | 21 |
| [`/vendor/[id]`](vendor-id.md) | PROYEK › Manajemen Proyek › Vendor Management › (drill-down) | 2 | 13 |
| [`/master`](master.md) | PROYEK › Master Proyek | 2 | 4 |
| [`/master/[kode]/sarpras/[kodeSarpras]`](master-kode-sarpras-kodeSarpras.md) | PROYEK › Master Proyek › (drill-down) | 2 | 13 |
| [`/master/[kode]/tipe/[tipeKode]`](master-kode-tipe-tipeKode.md) | PROYEK › Master Proyek › (drill-down) | 1 | 21 |
| [`/master/[kode]/unit/[unitKode]`](master-kode-unit-unitKode.md) | PROYEK › Master Proyek › (drill-down) | 3 | 18 |
| [`/master/[kode]`](master-kode.md) | PROYEK › Master Proyek › (drill-down) | 1 | 22 |
| [`/`](ringkasan.md) | PROYEK › Ringkasan | 2 | 0 |

## Pohon navigasi

```
PROYEK
├── Ringkasan                       /
├── Master Proyek                   /master
│   └── detail proyek               /master/[kode]
│       ├── tipe unit               /master/[kode]/tipe/[tipeKode]
│       ├── unit                    /master/[kode]/unit/[unitKode]
│       └── sarpras                 /master/[kode]/sarpras/[kodeSarpras]
├── Estimasi RAB
│   ├── RAB Estimasi                /estimasi
│   │   └── detail RAB              /estimasi/[id]
│   ├── Pustaka AHSP                /estimasi/pustaka
│   └── Supplier                    /estimasi/pemasok
│       └── detail supplier         /estimasi/pemasok/[id]
├── Manajemen Proyek
│   ├── Konstruksi                  /konstruksi
│   │   └── detail proyek           /konstruksi/[kode]
│   │       ├── laporan mingguan    /konstruksi/[kode]/laporan
│   │       ├── unit                /konstruksi/[kode]/unit/[unitKode]
│   │       ├── sarpras             /konstruksi/[kode]/sarpras/[kodeSarpras]
│   │       └── SPK vendor          /konstruksi/[kode]/vendor/[kontrakKode]
│   │           └── per objek       …/[objek]
│   ├── Keuangan Proyek             /keuangan
│   │   └── detail proyek           /keuangan/[kode]
│   ├── Petty Cash                  /petty-cash
│   ├── Vendor Management           /vendor
│   │   └── detail vendor           /vendor/[id]
│   │       └── kontrak (SPK)       /vendor/[id]/kontrak/[kode]
│   │           └── per objek       …/[objek]
│   └── Equipment & Asset           /equipment
└── Landbank                        /landbank
    └── detail landbank             /landbank/[kode]
```

## Dua halaman yang TIDAK dipindahkan apa adanya

| Rute | Nasibnya |
|---|---|
| `/admin` | Tidak ikut — pengelolaan pengguna sudah ada di ERP. Yang IKUT hanya matriks hak aksesnya; lihat `docs/jahitan-identitas.md` |
| `/plan-realisasi` | Sudah dilebur ke tab Business Plan pada `/landbank/[kode]`; di ERP tidak perlu menu sendiri |

## Cara memperbarui

Spesifikasi ini **dihasilkan dari kode**, bukan ditulis tangan: fakta tiap
halaman diekstrak dari `page.tsx` (fungsi data, aksi, pemeriksaan izin, tautan,
keadaan kosong), dan JSON-nya ditangkap dengan memanggil fungsi datanya
sungguhan terhadap basis data demo.

Skripnya sekali pakai dan tidak disimpan — kalau halaman berubah banyak, cara
paling murah adalah membuatnya lagi daripada menyunting 30 berkas satu per satu.
Yang perlu diketahui untuk mengulanginya: ekstraksi memakai pencocokan pola atas
`page.tsx` dan satu tingkat impor lokalnya, dan penangkapan JSON memanggil tiap
ekspor `src/lib/data` dengan argumen yang ditebak dari aritas.
