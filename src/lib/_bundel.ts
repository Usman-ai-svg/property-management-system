/**
 * TITIK MASUK BUNDEL LAPISAN MURNI.
 *
 * `npm run bundel:hitung` memancarkan berkas ini menjadi
 * `dist/proyek-hitung.min.js` — satu berkas IIFE yang memasang global
 * `ProyekHitung`. ERP memakainya apa adanya dari `index.html`:
 *
 *   <script src="proyek-hitung.min.js"></script>
 *   const total = ProyekHitung.calc.totalBaris(baris);
 *
 * Yang ikut hanya lapisan yang tidak menyentuh apa pun di luar dirinya: tanpa
 * React, tanpa Next, tanpa Prisma, tanpa exceljs. Itu dijaga
 * `src/lib/lapisan.test.ts`, jadi bundel ini tidak bisa diam-diam menyeret
 * setengah aplikasi.
 *
 * ------------------------------------------------------------------------
 * KENAPA BERNAMESPACE, BUKAN DIRATAKAN
 * ------------------------------------------------------------------------
 * Nama yang sama muncul di lapisan yang berbeda dengan arti yang berbeda —
 * `total`, `status`, `ringkas`. Kalau semuanya diratakan ke satu objek, yang
 * dimuat belakangan menang tanpa peringatan apa pun, dan yang kalah adalah
 * fungsi yang dipanggil halaman lain. Enam namespace membuat tabrakan itu
 * mustahil, dan membuat pemanggilnya menyebut lapisan mana yang ia maksud.
 *
 * Isi tiap namespace:
 *
 *   calc      — hitungan uang, volume, progres, penyusutan.
 *   domain    — enum, template, dan aturan yang sifatnya definisi.
 *   tampilan  — penyusun bentuk siap tampil (baris tabel, ringkasan, grafik).
 *   adaptor   — pembacaan masukan: formulir, tabel Excel, rute, berkas.
 *   format    — pemformatan angka, tanggal, dan teks Indonesia.
 *   kontrak   — validasi masukan tiap aksi tulis; padanan lapisan `periksa*`
 *               yang dipanggil RPC sebelum menulis.
 */

import * as ahsp from "./calc/ahsp";
import * as calcAset from "./calc/aset";
import * as boq from "./calc/boq";
import * as hariKerja from "./calc/hari-kerja";
import * as calcKeuangan from "./calc/keuangan";
import * as kontrakBoq from "./calc/kontrak-boq";
import * as opname from "./calc/opname";
import * as pembelian from "./calc/pembelian";
import * as calcPetty from "./calc/petty-cash";
import * as statusBangun from "./calc/status-bangun";
import * as tender from "./calc/tender";

import * as enums from "./domain/enums";
import * as kolomEnum from "./domain/kolom-enum";
import * as templates from "./domain/templates";

import * as tampilanAset from "./tampilan/aset";
import * as tampilanEstimasi from "./tampilan/estimasi";
import * as grafik from "./tampilan/grafik";
import * as keuanganProyek from "./tampilan/keuangan-proyek";
import * as tampilanKonstruksi from "./tampilan/konstruksi";
import * as tampilanLandbank from "./tampilan/landbank";
import * as tampilanMaster from "./tampilan/master";
import * as tampilanPlanRealisasi from "./tampilan/plan-realisasi";
import * as tampilanProyek from "./tampilan/proyek";
import * as ringkasan from "./tampilan/ringkasan";
import * as tampilanVendor from "./tampilan/vendor";

import * as berkasAturan from "./adaptor/berkas-aturan";
import * as formulir from "./adaptor/formulir";
import * as identitas from "./adaptor/identitas";
import * as kelompokTabel from "./adaptor/kelompok-tabel";
import * as rute from "./adaptor/rute";
import * as tabelAturan from "./adaptor/tabel-aturan";

import * as formatIndex from "./format/index";

import * as kontrakAdmin from "./kontrak/admin";
import * as kontrakBoqSpk from "./kontrak/boq-spk";
import * as kontrakDasar from "./kontrak/dasar";
import * as kontrakEquipment from "./kontrak/equipment";
import * as kontrakEstimasi from "./kontrak/estimasi";
import * as kontrakKeuangan from "./kontrak/keuangan";
import * as kontrakKonstruksi from "./kontrak/konstruksi";
import * as kontrakLandbank from "./kontrak/landbank";
import * as kontrakMaster from "./kontrak/master";
import * as kontrakPetty from "./kontrak/petty-cash";
import * as kontrakPlanReal from "./kontrak/plan-real";
import * as kontrakVendor from "./kontrak/vendor";

/**
 * Gabungkan modul-modul satu lapisan menjadi satu namespace.
 *
 * Melempar kalau satu nama menunjuk dua hal BERBEDA. Dengan operator sebar
 * biasa, modul yang belakangan menang tanpa suara — dan yang kalah adalah
 * fungsi yang dipanggil halaman lain, dengan hasil yang mirip tapi tidak sama.
 * Lebih baik bundelnya menolak dibangun.
 *
 * Nama yang sama menunjuk nilai yang PERSIS sama dibiarkan lewat: itu satu
 * fungsi kanonis yang diekspor ulang oleh beberapa modul, dan tidak ada yang
 * ambigu di sana. Aturan inilah yang dulu menemukan `nilaiBaris` berdiri
 * sendiri tiga kali di lapisan calc.
 */
function gabung(nama: string, ...modul: Record<string, unknown>[]): Record<string, unknown> {
  const hasil: Record<string, unknown> = {};
  for (const m of modul) {
    for (const [kunci, nilai] of Object.entries(m)) {
      if (kunci in hasil && hasil[kunci] !== nilai) {
        throw new Error(
          `bundel ${nama}: nama "${kunci}" diekspor dua modul dengan isi berbeda`,
        );
      }
      hasil[kunci] = nilai;
    }
  }
  return hasil;
}

export const calc = gabung(
  "calc",
  ahsp, calcAset, boq, hariKerja, calcKeuangan, kontrakBoq, opname, pembelian,
  calcPetty, statusBangun, tender,
);

export const domain = gabung("domain", enums, kolomEnum, templates);

export const tampilan = gabung(
  "tampilan",
  tampilanAset, tampilanEstimasi, grafik, keuanganProyek, tampilanKonstruksi,
  tampilanLandbank, tampilanMaster, tampilanPlanRealisasi, tampilanProyek,
  ringkasan, tampilanVendor,
);

export const adaptor = gabung(
  "adaptor",
  berkasAturan, formulir, identitas, kelompokTabel, rute, tabelAturan,
);

export const format = gabung("format", formatIndex);

export const kontrak = gabung(
  "kontrak",
  kontrakAdmin, kontrakBoqSpk, kontrakDasar, kontrakEquipment, kontrakEstimasi,
  kontrakKeuangan, kontrakKonstruksi, kontrakLandbank, kontrakMaster,
  kontrakPetty, kontrakPlanReal, kontrakVendor,
);
