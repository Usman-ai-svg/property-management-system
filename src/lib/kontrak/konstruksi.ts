/**
 * KONTRAK — Konstruksi (progres dan opname).
 *
 * Empat aksi, dan semuanya menulis PROGRES — angka yang menentukan berapa yang
 * boleh ditagihkan vendor dan seberapa jauh proyek dianggap jalan. Sama seperti
 * modul uang, pemeriksaannya menolak, bukan memperbaiki diam-diam.
 */

import { progresSah } from "@/lib/calc/opname";
import { angkaRentang, pertamaGagal, wajibTeks, type Galat } from "./dasar";

export interface MasukanUbahProgresManual {
  id: string;
  progress: number;
}

export interface KonteksProgresManual {
  /**
   * Objek ini sudah punya baris BOQ Master.
   *
   * Kalau sudah, progresnya DIHITUNG dari baris-baris itu dan tidak boleh
   * ditimpa satu angka manual: angka manualnya akan tertulis ulang pada opname
   * berikutnya, sehingga penggunanya mengira sudah tersimpan padahal tidak.
   */
  punyaBoq: boolean;
  /** Nama objeknya untuk pesan: "unit" atau "item". */
  sebutan: string;
}

export function periksaUbahProgresManual(
  m: MasukanUbahProgresManual,
  konteks: KonteksProgresManual,
): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.id, "Id objek"),
    angkaRentang(m.progress, 0, 100, "Progres"),
  );
  if (dasar) return dasar;

  if (konteks.punyaBoq) {
    return (
      `Progres ${konteks.sebutan} ini dihitung dari BOQ Master Proyek. Isi lewat tabel opname ` +
      `di halaman ${konteks.sebutan}, karena angka manual akan tertulis ulang pada opname berikutnya.`
    );
  }
  return null;
}

/** Satu baris kiriman opname. */
export interface BarisOpnameMasuk {
  id: string;
  persen: number;
}

export interface MasukanSimpanOpname {
  objekId: string;
  baris: BarisOpnameMasuk[];
}

export interface KonteksSimpanOpname {
  /**
   * Jumlah id dan jumlah nilai yang terkirim sama.
   *
   * Kalau berbeda, form yang dikirim berasal dari halaman versi lama — dan
   * memasangkan id ke nilai yang salah berarti progres tertulis di baris yang
   * keliru tanpa ada galat apa pun.
   */
  kirimanLengkap: boolean;
}

export function periksaSimpanOpname(
  m: MasukanSimpanOpname,
  konteks: KonteksSimpanOpname,
  namaBaris: (id: string) => string,
): Galat {
  const id = wajibTeks(m.objekId, "Id objek");
  if (id) return id;
  if (!konteks.kirimanLengkap) {
    return "Data opname tidak lengkap. Muat ulang halaman lalu coba lagi.";
  }
  for (const b of m.baris) {
    if (!progresSah(b.persen)) {
      return `Progres "${namaBaris(b.id)}" harus di antara 0 dan 100 persen.`;
    }
  }
  return null;
}
