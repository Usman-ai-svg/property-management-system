-- Kolom jabatan HRIS jadi daftar tertutup — dihasilkan oleh
-- scripts/jabatan-hris-sql.mjs. JANGAN disunting tangan: sumbernya
-- src/lib/domain/jabatan.ts.
--
-- Dijalankan di sisi ERP, sekali, SEBELUM modul Proyek dipakai.
--
-- Kolomnya diasumsikan bernama "jabatan" pada hris.employees. Langkah 1 di bawah
-- memastikannya; kalau namanya berbeda, ganti di seluruh berkas ini.
--
-- Kenapa ini perlu: tanpa constraint, "Quantity Surveyor Asst" masuk tanpa
-- keluhan dan orangnya kehilangan seluruh akses modul Proyek tanpa pesan apa
-- pun — bukan galat, cuma menu yang kosong. Dengan constraint, kekeliruan yang
-- sama ditolak saat disimpan, oleh orang yang sedang mengetiknya.
--
-- Padanan nilai HRIS -> kunci yang dipakai matriks hak akses:
--   director                 -> director
--   komisaris                -> komisaris
--   head of operation        -> head_of_operation
--   manager proyek           -> manager_proyek
--   logistic staff           -> logistic_staff
--   quantity surveyor asst   -> quantity_surveyor_asst
--   junior arsitek staff     -> junior_arsitek_staff
--   consultant finance       -> consultant_finance
--   finance & tax            -> finance_tax
--   staff administration     -> staff_administration
--   hrd staff                -> hrd_staff
--   sales & marketing        -> sales_marketing
--   customer service         -> customer_service
--   manager marketing        -> manager_marketing
--   agent coordinator        -> agent_coordinator
--   copy writer              -> copy_writer
--   design graphic staff     -> design_graphic_staff
--   graphic designer         -> graphic_designer


-- ===========================================================================
-- LANGKAH 1 — PERIKSA DULU. Jangan lanjut sebelum hasilnya dibaca.
-- ===========================================================================

-- 1a. Pastikan nama kolomnya benar.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'hris' and table_name = 'employees'
   and (column_name ilike '%jabat%' or column_name ilike '%posi%'
        or column_name ilike '%title%');

-- 1b. Nilai yang benar-benar dipakai sekarang, beserta jumlah orangnya.
--     Inilah daftar yang menentukan berapa banyak yang perlu dirapikan.
select jabatan, count(*) as orang
  from hris.employees
 group by 1
 order by 2 desc;

-- 1c. Yang TIDAK cocok dengan salah satu dari 18 nilai resmi.
--     Perbandingannya mengabaikan huruf besar-kecil dan spasi berlebih, jadi
--     yang muncul di sini benar-benar berbeda, bukan cuma beda ejaan kapital.
select jabatan, count(*) as orang
  from hris.employees
 where lower(regexp_replace(coalesce(jabatan, ''), '\s+', ' ', 'g')) not in (
    'director',
    'komisaris',
    'head of operation',
    'manager proyek',
    'logistic staff',
    'quantity surveyor asst',
    'junior arsitek staff',
    'consultant finance',
    'finance & tax',
    'staff administration',
    'hrd staff',
    'sales & marketing',
    'customer service',
    'manager marketing',
    'agent coordinator',
    'copy writer',
    'design graphic staff',
    'graphic designer'
 )
 group by 1
 order by 2 desc;


-- ===========================================================================
-- LANGKAH 2 — RAPIKAN. Aman dijalankan ulang.
-- ===========================================================================

-- 2a. Buang spasi berlebih dan samakan kapitalisasi ke bentuk resminya.
--     Menyembuhkan mayoritas kasus: "  Head Of  Operation " -> "head of operation".
update hris.employees e
   set jabatan = r.resmi
  from (values
    ('director', 'director'),
    ('komisaris', 'komisaris'),
    ('head of operation', 'head of operation'),
    ('manager proyek', 'manager proyek'),
    ('logistic staff', 'logistic staff'),
    ('quantity surveyor asst', 'quantity surveyor asst'),
    ('junior arsitek staff', 'junior arsitek staff'),
    ('consultant finance', 'consultant finance'),
    ('finance & tax', 'finance & tax'),
    ('staff administration', 'staff administration'),
    ('hrd staff', 'hrd staff'),
    ('sales & marketing', 'sales & marketing'),
    ('customer service', 'customer service'),
    ('manager marketing', 'manager marketing'),
    ('agent coordinator', 'agent coordinator'),
    ('copy writer', 'copy writer'),
    ('design graphic staff', 'design graphic staff'),
    ('graphic designer', 'graphic designer')
       ) as r(bentuk, resmi)
 where lower(regexp_replace(coalesce(e.jabatan, ''), '\s+', ' ', 'g')) = r.bentuk
   and e.jabatan is distinct from r.resmi;

-- 2b. Sisanya — yang muncul di query 1c — harus dirapikan MANUAL, satu per
--     satu, oleh orang yang tahu jabatan sebenarnya. Contoh bentuknya:
--
--     update hris.employees set jabatan = 'quantity surveyor asst'
--      where jabatan = 'QS Asst';
--
--     Jangan menebak. Jabatan yang salah tebak memberi akses yang salah, dan
--     itu tidak menimbulkan galat apa pun — persis kelas kekeliruan yang
--     berkas ini ada untuk mencegahnya.

-- 2c. Pastikan sudah bersih. HARUS mengembalikan 0 baris sebelum lanjut.
select jabatan, count(*) as orang
  from hris.employees
 where jabatan is not null
   and jabatan not in (
    'director',
    'komisaris',
    'head of operation',
    'manager proyek',
    'logistic staff',
    'quantity surveyor asst',
    'junior arsitek staff',
    'consultant finance',
    'finance & tax',
    'staff administration',
    'hrd staff',
    'sales & marketing',
    'customer service',
    'manager marketing',
    'agent coordinator',
    'copy writer',
    'design graphic staff',
    'graphic designer'
 )
 group by 1;


-- ===========================================================================
-- LANGKAH 3 — KUNCI.
-- ===========================================================================

-- NULL sengaja diizinkan: karyawan yang jabatannya belum diisi bukan
-- kekeliruan data, ia cuma belum punya akses apa pun di modul Proyek. Yang
-- ditolak adalah nilai yang TERISI tapi di luar daftar.
alter table hris.employees
  drop constraint if exists employees_jabatan_sah;

alter table hris.employees
  add constraint employees_jabatan_sah check (
    jabatan is null or jabatan in (
    'director',
    'komisaris',
    'head of operation',
    'manager proyek',
    'logistic staff',
    'quantity surveyor asst',
    'junior arsitek staff',
    'consultant finance',
    'finance & tax',
    'staff administration',
    'hrd staff',
    'sales & marketing',
    'customer service',
    'manager marketing',
    'agent coordinator',
    'copy writer',
    'design graphic staff',
    'graphic designer'
    )
  );


-- ===========================================================================
-- MENAMBAH JABATAN BARU, NANTI
-- ===========================================================================
--
-- Constraint ini membuat jabatan baru menuntut DUA langkah, dan keduanya
-- memang perlu:
--
--   1. tambahkan entri di src/lib/domain/jabatan.ts (kunci, teks HRIS, label,
--      grup, cakupan) lalu jalankan npm run acl:sql — tanpa ini, jabatan baru
--      tidak punya satu baris pun hak akses;
--   2. jalankan ulang berkas ini untuk memperbarui constraint-nya.
--
-- Terasa merepotkan, dan itu disengaja: jabatan yang ada di HRIS tapi tidak ada
-- di matriks menghasilkan orang yang bisa masuk tetapi tidak melihat apa-apa,
-- dan yang bersangkutan akan melaporkannya sebagai aplikasi rusak.
--
-- Kalau jabatan di organisasi ternyata sering berubah, ganti CHECK di atas
-- dengan tabel acuan + foreign key: menambah jabatan jadi INSERT satu baris,
-- bukan DDL. Database tetap menolak nilai yang tidak dikenal.
