# Jabatan & hak akses — yang harus dikerjakan di sisi ERP

Dokumen ini ditulis supaya bisa dikerjakan orang yang **belum pernah membuka
repo modul Proyek**. Isinya empat hal: dua jabatan yang perlu dibuat, kebijakan
centang modul, penegasan soal `profiles.role`, dan satu daftar periksa yang
jawabannya masih ditunggu.

---

## 0. Ringkasnya

Hak akses di dalam modul Proyek dikunci ke **jabatan**, bukan ke `profiles.role`.

| Lapis | Sumber | Menjawab |
| --- | --- | --- |
| Luar | `profiles.role` | modul mana yang kelihatan |
| Dalam | jabatan di `hris.employees` | di dalam modul Proyek boleh apa |

`profiles.role` **tidak berubah sama sekali**. Delapan nilainya —
`director`, `accountant`, `manager`, `sales`, `staff`, `viewer`, `hrd`, `admin` —
tetap apa adanya. Tidak ada nilai baru, tidak ada yang diganti artinya. Seluruh
risiko yang sempat dikhawatirkan (`canFinance()` bergeser, `is_hr_admin()`
kebobolan, peran baru tidak bisa absen) tidak berlaku di sini.

Konsekuensi yang perlu diketahui: **orang tanpa data karyawan HRIS tidak punya
jabatan, jadi tidak punya hak apa pun di modul Proyek** meski modulnya dicentang.
Itu perilaku yang benar dan aman — contohnya akun intern marketing yang memang
bukan karyawan. Yang ia lihat: menu Proyek ada, isinya kosong.

---

## 1. Dua jabatan yang perlu dibuat di HRIS

Dibuat **kosong** sekarang, tanpa orang. Barisnya sudah ada di matriks; tinggal
diisi nanti.

| Jabatan | Kenapa dibuat sekarang |
| --- | --- |
| `komisaris` | Melihat 9 sub-bagian termasuk business plan dan keuangan; tanpa hak ubah sama sekali. |
| `consultant finance` | Melihat 9 sub-bagian, hak ubah hanya petty cash. |

Kalau barisnya tidak dibuat sekarang, orang pertama yang menempati jabatan itu
akan masuk tanpa akses apa pun, dan yang terlihat bukan "belum diatur" melainkan
"aplikasinya rusak".

---

## 2. Kebijakan centang modul Proyek

**Dapat centang** — seluruh jabatan pada tabel di bagian 5. Termasuk jabatan
marketing dan media: mereka memang perlu melihat deskripsi proyek, daftar unit,
daftar sarpras, dokumen teknis, dan data aset sebagai bahan kerja.

Yang membatasi mereka bukan centang modul, melainkan **matriks**: delapan
jabatan bercakupan `luar` tidak punya satu pun hak ubah, dan tidak melihat
harga, margin, keuangan, petty cash, progres, maupun persetujuan RAB. Ada tes di
repo yang gagal bila salah satunya mendapat hak ubah.

**Tidak dapat centang** — akun yang bukan karyawan, dan jabatan yang tidak ada
di tabel bagian 5. Keduanya berakhir sama: tanpa jabatan yang dikenal, tidak ada
hak apa pun.

Dua hal yang perlu diputuskan Umar, bukan dikerjakan sekarang:

- `dokumenTeknis` termasuk berkas `.skp` dan `.dwg`. Jadi copy writer, design
  graphic staff, dan graphic designer bisa mengunduh gambar kerja. Untuk
  keperluan konten mungkin memang itu yang diinginkan.
- `progress` **tidak** termasuk yang boleh mereka lihat. Kalau tim konten butuh
  melihat kemajuan pembangunan untuk bahan posting, sub-bagian ini perlu
  ditambahkan. Sekarang belum.

---

## 3. Daftar periksa kolom jabatan di HRIS — **jawabannya ditunggu**

Ini satu-satunya hal yang belum terjawab, dan jawabannya menentukan apakah
perlu satu langkah tambahan.

Masalahnya: kalau kolom jabatan berupa **teks bebas**, satu salah ketik
`"Quantity Surveyor Asst"` menjadi `"Quantity Surveyor asst"` membuat orangnya
kehilangan akses **tanpa pesan apa pun**. Bukan galat, bukan halaman merah —
cuma menu yang kosong.

Jalankan tiga query ini di Supabase, lalu kirimkan hasilnya:

```sql
-- 1. kolom jabatan itu apa namanya, dan tipenya apa
select column_name, data_type
  from information_schema.columns
 where table_schema = 'hris' and table_name = 'employees'
   and (column_name ilike '%jabat%' or column_name ilike '%posi%'
        or column_name ilike '%title%');

-- 2. nilai yang benar-benar dipakai sekarang, beserta jumlah orangnya
select <kolom_jabatan>, count(*)
  from hris.employees
 group by 1
 order by 2 desc;

-- 3. ada constraint yang membatasi nilainya?
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'hris.employees'::regclass;
```

### Apa yang dilakukan dengan jawabannya

**Sudah aman dari sekarang, apa pun jawabannya.** Matriks di repo tidak pernah
dikunci ke teks HRIS; ia dikunci ke **kunci baku** (`quantity_surveyor_asst`),
dan teks HRIS diterjemahkan lebih dulu oleh `jabatanDariHris()`. Terjemahannya
sudah mengabaikan huruf besar-kecil dan spasi berlebih — dua bentuk salah ketik
yang paling sering.

Yang dikerjakan setelah jawaban datang:

| Kalau ternyata… | Langkahnya |
| --- | --- |
| ada CHECK/enum yang membatasi nilainya | cukup samakan ejaan `jabatanHris` di `src/lib/domain/jabatan.ts` dengan daftar itu |
| teks bebas, dan ada ejaan lain yang dipakai | tambahkan barisnya ke `ALIAS_HRIS` di berkas yang sama — satu baris per ejaan, tanpa menyentuh matriks |
| ada jabatan yang belum terpetakan | tambahkan entri baru, atau putuskan ia memang tanpa akses |

---

## 4. Yang dibawa dari repo

Dua berkas SQL, dijalankan berurutan di SQL editor, sekali:

1. `prisma/proyek.sql` — 60 tabel schema `proyek`, RLS aktif, tanpa policy tulis.
2. `prisma/acl.sql` — 145 baris matriks hak akses untuk 18 jabatan.

Keduanya aman dijalankan ulang: tiap baris punya id tetap dan diakhiri
`on conflict do nothing`, jadi menjalankan dua kali tidak menggandakan apa pun
dan tidak menimpa penyuntingan yang sudah dilakukan lewat halaman Admin.

Tabelnya `proyek.role_section_permissions`, kolomnya `jabatan`, `section`,
`bolehLihat`, `bolehUbah`.

> **`bolehUbah` pada `pettyCash` berarti "boleh ikut dalam alur", BUKAN "boleh
> semua tahap".** Tahap mana untuk jabatan mana ditegakkan tabel transisi,
> bukan flag ini. Salah membacanya berarti mengira satu orang bisa mengajukan
> sekaligus menyetujui.

Aturan alur petty cash yang harus ikut ke RPC:

- Pemegang dana hanya boleh **mengajukan**. Tahap sesudahnya digerakkan orang
  lain — tidak ada yang memeriksa pertanggungjawabannya sendiri.
- `director` boleh menembus semua transisi, **kecuali** atas dana yang ia pegang
  sendiri. Aturan pertama diperiksa lebih dulu.

---

## 5. Peta jabatan → hak akses

Angka di bawah dihitung dari matriks, bukan diketik tangan.

| Jabatan HRIS | Orang | Lihat | Ubah | Catatan |
| --- | --- | ---: | ---: | --- |
| director | Umar | 12 | 12 | Administrator sistem de facto: pemegang modul Pengaturan dan jejak audit |
| komisaris | *kosong* | 9 | 0 | Pengawas: melihat banyak, mengubah tak satu pun |
| head of operation | Usman | 12 | 12 | Gabungan Head Operation Office + Project + Business Development |
| manager proyek | Abdillah | 11 | 7 | Boleh memegang dana petty cash |
| logistic staff | Dicky | 8 | 3 | Boleh memegang dana petty cash |
| quantity surveyor asst | Laras | 11 | 5 | QS + Procurement. **Tidak** boleh menyetujui RAB |
| junior arsitek staff | Sabila | 7 | 1 | Dokumen teknis |
| consultant finance | *kosong* | 9 | 1 | Petty cash |
| Finance & Tax | Nisa | 9 | 2 | Keuangan & reimburse |
| staff administration | Firmanda | 9 | 2 | Keuangan & administrasi |
| HRD staff | Galih | 6 | 0 | Cakupan luar |
| Sales & Marketing | Diana | 6 | 0 | Cakupan luar |
| customer service | Arzenico | 6 | 0 | Cakupan luar |
| Manager marketing | Wahyudi | 6 | 0 | Cakupan luar |
| agent coordinator | Imam Jaka | 6 | 0 | Cakupan luar |
| copy writer | Intan | 6 | 0 | Cakupan luar |
| design graphic staff | Gunawan | 6 | 0 | Cakupan luar |
| graphic designer | Yuzak | 6 | 0 | Cakupan luar |

Dua pemisahan yang **tidak boleh hilang**, keduanya dijaga tes:

1. Quantity surveyor asst menyusun RAB, dan tidak menyetujui buatannya sendiri.
2. Pemegang dana petty cash tidak memverifikasi pengajuannya sendiri.

Sumber angkanya: `prisma/acuan/hak-akses.json`, dihasilkan dari
`src/lib/domain/jabatan.ts`. Yang mengubahnya di aplikasi: halaman Admin →
Kelola Hak Akses, terbuka untuk jabatan yang punya hak ubah `deskripsi`.
