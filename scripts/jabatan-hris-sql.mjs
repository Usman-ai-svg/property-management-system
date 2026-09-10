import { writeFileSync } from "node:fs";
import { JABATAN } from "../src/lib/domain/jabatan.ts";

/**
 * KOLOM JABATAN HRIS → daftar tertutup.
 *
 * Keputusan Usman: nilai jabatan di `hris.employees` harus persis 18 dan rapi,
 * supaya salah ketik tidak mungkin terjadi — bukan ditampung belakangan.
 *
 * Bedanya nyata. Tanpa constraint, `"Quantity Surveyor Asst"` masuk tanpa
 * keluhan dan orangnya kehilangan seluruh akses modul Proyek TANPA pesan apa
 * pun: bukan galat, bukan halaman merah, cuma menu yang kosong. Dengan
 * constraint, kekeliruan yang sama ditolak saat disimpan, oleh orang yang
 * sedang mengetiknya, pada saat ia masih ingat maksudnya.
 *
 * Berkas ini dihasilkan dari `src/lib/domain/jabatan.ts` supaya kedelapan belas
 * nilainya tidak mungkin berbeda dari yang dipakai matriks hak akses. Ditulis
 * tangan, keduanya akan berbeda dalam sebulan.
 *
 * URUTANNYA TIDAK BOLEH DIBALIK: periksa dulu, rapikan, baru kunci. Constraint
 * yang dipasang di atas data yang belum bersih akan GAGAL — dan gagalnya di
 * tengah, setelah sebagian pekerjaan lain sudah berjalan.
 */

const KELUARAN = "prisma/jabatan-hris.sql";

/** Kolom jabatan di hris.employees. Diperiksa langkah 1; ganti bila berbeda. */
const KOLOM = "jabatan";
const TABEL = "hris.employees";

const kutip = (teks) => `'${String(teks).split("'").join("''")}'`;

const nilai = JABATAN.map((j) => j.jabatanHris);
const daftar = nilai.map((v) => `    ${kutip(v)}`).join(",\n");

/**
 * Bentuk yang sudah dinormalkan, untuk membandingkan data yang BELUM rapi.
 *
 * Dipakai langkah pemeriksaan: yang muncul di sana benar-benar jabatan lain,
 * bukan sekadar beda kapital atau spasi — dan cuma itu yang perlu dirapikan
 * manusia.
 */
const daftarNormal = nilai.map((v) => `    ${kutip(v.toLowerCase())}`).join(",\n");

const petaKunci = JABATAN.map(
  (j) => `--   ${j.jabatanHris.padEnd(24)} -> ${j.kunci}`,
).join("\n");

const sql = `-- Kolom jabatan HRIS jadi daftar tertutup — dihasilkan oleh
-- scripts/jabatan-hris-sql.mjs. JANGAN disunting tangan: sumbernya
-- src/lib/domain/jabatan.ts.
--
-- Dijalankan di sisi ERP, sekali, SEBELUM modul Proyek dipakai.
--
-- Kolomnya diasumsikan bernama "${KOLOM}" pada ${TABEL}. Langkah 1 di bawah
-- memastikannya; kalau namanya berbeda, ganti di seluruh berkas ini.
--
-- Kenapa ini perlu: tanpa constraint, "Quantity Surveyor Asst" masuk tanpa
-- keluhan dan orangnya kehilangan seluruh akses modul Proyek tanpa pesan apa
-- pun — bukan galat, cuma menu yang kosong. Dengan constraint, kekeliruan yang
-- sama ditolak saat disimpan, oleh orang yang sedang mengetiknya.
--
-- Padanan nilai HRIS -> kunci yang dipakai matriks hak akses:
${petaKunci}


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
select ${KOLOM}, count(*) as orang
  from ${TABEL}
 group by 1
 order by 2 desc;

-- 1c. Yang TIDAK cocok dengan salah satu dari 18 nilai resmi.
--     Perbandingannya mengabaikan huruf besar-kecil dan spasi berlebih, jadi
--     yang muncul di sini benar-benar berbeda, bukan cuma beda ejaan kapital.
select ${KOLOM}, count(*) as orang
  from ${TABEL}
 where lower(regexp_replace(coalesce(${KOLOM}, ''), '\\s+', ' ', 'g')) not in (
${daftarNormal}
 )
 group by 1
 order by 2 desc;


-- ===========================================================================
-- LANGKAH 2 — RAPIKAN. Aman dijalankan ulang.
-- ===========================================================================

-- 2a. Buang spasi berlebih dan samakan kapitalisasi ke bentuk resminya.
--     Menyembuhkan mayoritas kasus: "  Head Of  Operation " -> "head of operation".
update ${TABEL} e
   set ${KOLOM} = r.resmi
  from (values
${JABATAN.map((j) => `    (${kutip(j.jabatanHris.toLowerCase())}, ${kutip(j.jabatanHris)})`).join(",\n")}
       ) as r(bentuk, resmi)
 where lower(regexp_replace(coalesce(e.${KOLOM}, ''), '\\s+', ' ', 'g')) = r.bentuk
   and e.${KOLOM} is distinct from r.resmi;

-- 2b. Sisanya — yang muncul di query 1c — harus dirapikan MANUAL, satu per
--     satu, oleh orang yang tahu jabatan sebenarnya. Contoh bentuknya:
--
--     update ${TABEL} set ${KOLOM} = 'quantity surveyor asst'
--      where ${KOLOM} = 'QS Asst';
--
--     Jangan menebak. Jabatan yang salah tebak memberi akses yang salah, dan
--     itu tidak menimbulkan galat apa pun — persis kelas kekeliruan yang
--     berkas ini ada untuk mencegahnya.

-- 2c. Pastikan sudah bersih. HARUS mengembalikan 0 baris sebelum lanjut.
select ${KOLOM}, count(*) as orang
  from ${TABEL}
 where ${KOLOM} is not null
   and ${KOLOM} not in (
${daftar}
 )
 group by 1;


-- ===========================================================================
-- LANGKAH 3 — KUNCI.
-- ===========================================================================

-- NULL sengaja diizinkan: karyawan yang jabatannya belum diisi bukan
-- kekeliruan data, ia cuma belum punya akses apa pun di modul Proyek. Yang
-- ditolak adalah nilai yang TERISI tapi di luar daftar.
alter table ${TABEL}
  drop constraint if exists employees_jabatan_sah;

alter table ${TABEL}
  add constraint employees_jabatan_sah check (
    ${KOLOM} is null or ${KOLOM} in (
${daftar}
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
`;

writeFileSync(KELUARAN, sql);

console.log(`${KELUARAN}: ${nilai.length} nilai jabatan resmi dikunci pada ${TABEL}.${KOLOM}`);
