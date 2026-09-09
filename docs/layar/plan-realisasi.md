# Layar — /plan-realisasi

| | |
|---|---|
| Rute Next | `/plan-realisasi` |
| Berkas | `src/app/(app)/plan-realisasi/page.tsx` |
| Menu ERP | (lebur ke Landbank › Business Plan) |
| RPC bootstrap | `proyek_plan_realisasi_bootstrap` |

## 1. Data yang dibutuhkan dari server

Halaman ini tidak memanggil lapisan data — seluruh isinya dari komponen anak.

## 2. Aksi yang bisa dipicu dari halaman ini

Tidak ada — halaman baca saja.

## 3. Sub-bagian izin — apa yang disembunyikan

Halaman ini tidak memeriksa sub-bagian apa pun; cukup sudah masuk.

## 4. Bisa masuk lebih dalam ke

Tidak ada.

## 5. Keadaan kosong, memuat, dan galat

| Keadaan | Perilaku sekarang |
|---|---|
| Memuat | Server Component — halaman baru terkirim setelah datanya siap; tidak ada keadaan memuat di klien |
| Galat aksi | `jalankan()` mengubah lemparan jadi pesan di form; halaman tidak berganti |

