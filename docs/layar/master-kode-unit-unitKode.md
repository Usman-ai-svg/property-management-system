# Layar — /master/[kode]/unit/[unitKode]

| | |
|---|---|
| Rute Next | `/master/[kode]/unit/[unitKode]` |
| Berkas | `src/app/(app)/master/[kode]/unit/[unitKode]/page.tsx` |
| Menu ERP | PROYEK › Master Proyek › (drill-down) |
| RPC bootstrap | `proyek_master_unit_unitKode_bootstrap` |

## 1. Data yang dibutuhkan dari server

Bentuk di bawah **ditangkap dari basis data demo**, bukan dikarang: tiap fungsi
benar-benar dipanggil lalu keluarannya diringkas (larik dipotong satu baris).
Inilah yang harus dikembalikan RPC `*_bootstrap`-nya.

### `detailUnit()`

```json
null
```

### `kontrakUnit()`

```json
[]
```

### `nilaiUnit()`

```json
{
  "rabStandar": 0,
  "kerjaTambah": 0,
  "rab": 0,
  "rap": 0,
  "rapMaterial": 0,
  "rapUpah": 0,
  "rapKerjaTambah": 0,
  "rap4": {
    "material": 0,
    "tenaga": 0,
    "subkon": 0,
    "lain": 0,
    "total": 0
  }
}
```

## 2. Aksi yang bisa dipicu dari halaman ini

Nama RPC dan invariannya ada di `KONTRAK-RPC.md`.

- `angka`
- `hapusKerjaTambah`
- `hapusUnitPaksa`
- `imporTabel`
- `izinkan`
- `jalankan`
- `pilihan`
- `simpanBoqKerjaTambah`
- `simpanBoqUnit`
- `simpanRapKerjaTambah`
- `simpanRapUnit`
- `tambahKerjaTambah`
- `teks`
- `teksOpsional`
- `ubahJudulKerjaTambah`
- `ubahUnit`
- `unggahRevisi`
- `wajibLolos`

## 3. Sub-bagian izin — apa yang disembunyikan

| Sub-bagian | Tingkat | Bila tidak berhak |
|---|---|---|
| `hargaRabRap` — Harga RAB & RAP | ubah | tombol dan form hilang; isinya tetap terbaca |
| `dokumenTeknis` — Dokumen Teknis | ubah | tombol dan form hilang; isinya tetap terbaca |
| `daftarUnit` — Daftar Unit | ubah | tombol dan form hilang; isinya tetap terbaca |
| `progress` — Progress & Kontrak | ubah | tombol dan form hilang; isinya tetap terbaca |

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

- `/master`

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Data tidak ditemukan | halaman 404 Next |
| Belum masuk | diarahkan ke `/login` |
| Tidak berhak | kartu `<Terbatas>` menggantikan isinya |
| Tabel kosong | Unit ini belum tercakup kontrak vendor mana pun. |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

