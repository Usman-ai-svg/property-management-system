/**
 * KONTRAK — BOQ SPK dan opname progresnya.
 *
 * Modul ini setengah jalan sudah berbentuk kontrak sebelum Kelompok B:
 * `periksaBarisBoqSpk` di `calc/kontrak-boq.ts` sudah murni dan sudah dipanggil
 * seperti kontrak. Yang ditambahkan di sini adalah lapisan masukannya —
 * identitas baris, syarat berkas impor, dan bentuk kiriman progres — supaya
 * seluruh aksi modul ini punya tipe masukan yang tertulis.
 *
 * Pemeriksaan baris sendiri TIDAK ditulis ulang di sini; ia diteruskan dari
 * `calc`. Menyalinnya akan melahirkan aturan kembar, persis yang sedang
 * diberesi Kelompok A.
 */

import { periksaBarisBoqSpk } from "@/lib/calc/kontrak-boq";
import { progresSah } from "@/lib/calc/opname";
import { pertamaGagal, wajibTeks, type Galat } from "./dasar";

export { periksaBarisBoqSpk };

/** Satu baris template BOQ pada sebuah SPK. */
export interface MasukanBarisBoqSpk {
  contractId: string;
  grup: string;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
}

export function periksaTambahBarisBoqSpk(m: MasukanBarisBoqSpk): Galat {
  return pertamaGagal(
    wajibTeks(m.contractId, "Id kontrak"),
    periksaBarisBoqSpk(m),
  );
}

export interface MasukanUbahBarisBoqSpk extends Omit<MasukanBarisBoqSpk, "contractId"> {
  id: string;
}

export function periksaUbahBarisBoqSpk(m: MasukanUbahBarisBoqSpk): Galat {
  return pertamaGagal(wajibTeks(m.id, "Id baris BOQ"), periksaBarisBoqSpk(m));
}

export const periksaHapusBarisBoqSpk = (m: { id: string }): Galat =>
  wajibTeks(m.id, "Id baris BOQ");

// ---------------------------------------------------------------------------
// Override per objek
// ---------------------------------------------------------------------------

/**
 * Penyesuaian sebuah baris template untuk SATU objek.
 *
 * Field yang bernilai null berarti "ikut template" — itulah warisan
 * field-level yang membuat perubahan template menurun ke objek yang belum
 * menyesuaikan field tersebut. Karena itu null harus dibedakan dari nol, dan
 * hanya field terisi yang ikut diperiksa.
 */
export interface MasukanOverrideBoq {
  boqItemId: string;
  objek: string;
  uraian: string | null;
  satuan: string | null;
  volume: number | null;
  hargaSatuan: number | null;
}

export function periksaUbahOverrideBoq(m: MasukanOverrideBoq): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.boqItemId, "Id baris BOQ"),
    wajibTeks(m.objek, "Objek tujuan"),
  );
  if (dasar) return dasar;

  return periksaBarisBoqSpk({
    uraian: m.uraian === null ? undefined : m.uraian,
    volume: m.volume ?? 0,
    hargaSatuan: m.hargaSatuan ?? 0,
  });
}

export function periksaResetOverrideBoq(m: { boqItemId: string; objek: string }): Galat {
  return pertamaGagal(
    wajibTeks(m.boqItemId, "Id baris BOQ"),
    wajibTeks(m.objek, "Objek tujuan"),
  );
}

// ---------------------------------------------------------------------------
// Impor Excel
// ---------------------------------------------------------------------------

export interface KonteksImporBoq {
  adaBerkas: boolean;
  /** Banyaknya baris pekerjaan yang terbaca dari berkas. */
  jumlahBaris: number;
}

/**
 * Impor bersifat semua-atau-tidak-sama-sekali; yang diperiksa di sini adalah
 * syarat sebelum satu baris pun ditulis. Berkas yang terbaca tapi kosong
 * ditolak, bukan diterima sebagai "impor nol baris" — hampir selalu berarti
 * kolomnya tidak dikenali, bukan berkasnya memang kosong.
 */
export function periksaImporBoqSpk(
  m: { contractId: string },
  konteks: KonteksImporBoq,
): Galat {
  const id = wajibTeks(m.contractId, "Id kontrak");
  if (id) return id;
  if (!konteks.adaBerkas) return "Pilih berkas Excel lebih dulu.";
  if (konteks.jumlahBaris === 0) return "Tidak ada baris pekerjaan yang terbaca.";
  return null;
}

// ---------------------------------------------------------------------------
// Opname progres
// ---------------------------------------------------------------------------

/** Satu baris kiriman opname: id baris beserta persen capaiannya. */
export interface BarisProgres {
  id: string;
  persen: number;
}

export interface MasukanSimpanProgres {
  contractId: string;
  objek: string;
  baris: BarisProgres[];
}

/**
 * Kiriman progres harus lengkap dan seluruhnya masuk akal.
 *
 * Progres di luar rentang DITOLAK, bukan dijepit: opname adalah dasar
 * penagihan vendor, dan angka nyeleneh berarti ada yang salah — memperbaikinya
 * diam-diam akan menyembunyikan kesalahan itu ke dalam tagihan.
 */
export function periksaSimpanProgresBoqSpk(
  m: MasukanSimpanProgres,
  namaBaris: (id: string) => string,
): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.contractId, "Id kontrak"),
    wajibTeks(m.objek, "Objek tujuan"),
  );
  if (dasar) return dasar;

  for (const b of m.baris) {
    if (!progresSah(b.persen)) {
      return `Progres "${namaBaris(b.id)}" harus di antara 0 dan 100 persen.`;
    }
  }
  return null;
}
