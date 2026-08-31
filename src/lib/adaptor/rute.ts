/**
 * ATURAN SEGMEN ALAMAT.
 *
 * Kode entitas — proyek, tipe unit, unit, sarana-prasarana, kontrak — dipakai
 * apa adanya sebagai satu potong alamat halaman, misalnya
 * `/master/NT2/tipe/36-72`. Masalahnya, kode di lapangan tidak selalu ramah
 * alamat. Tipe rumah di Indonesia lazim ditulis "36/72" atau "45/90", dan
 * kode fase kerap memuat garis miring seperti "F1/A". Garis miring yang
 * ditulis mentah ke alamat memecah satu segmen menjadi dua, jadi
 * `/master/NT2/tipe/36/72` tidak cocok dengan rute mana pun dan halamannya
 * berakhir 404 — padahal datanya ada.
 *
 * Sepasang fungsi di bawah menutup celah itu: `segmen` dipakai setiap kali
 * kode ditempel ke alamat, `bacaSegmen` dipakai setiap kali kode dibaca
 * kembali dari alamat. Keduanya harus selalu dipakai berpasangan.
 *
 * Catatan penting soal Next.js: parameter rute diserahkan MASIH TERSANDI.
 * Karena itu `bacaSegmen` membuka sandi tepat satu kali — bukan nol kali
 * (kode dengan garis miring tidak akan ketemu) dan bukan dua kali (kode yang
 * memuat tanda persen akan salah terbaca).
 */

/** Kode → satu segmen alamat yang aman. */
export function segmen(kode: string): string {
  return encodeURIComponent(kode);
}

/**
 * Satu segmen alamat → kode aslinya.
 *
 * Alamat bisa saja dirangkai tangan dan sandinya cacat, mis. `%E0%A4`.
 * `decodeURIComponent` melempar URIError untuk kasus itu, dan error yang
 * tidak tertangkap di komponen server berujung halaman 500. Yang benar di
 * sini adalah 404: alamatnya memang tidak menunjuk apa pun. Maka nilai
 * mentahnya dikembalikan, dan pencarian di basis data yang akan gagal wajar.
 */
export function bacaSegmen(nilai: string): string {
  try {
    return decodeURIComponent(nilai);
  } catch {
    return nilai;
  }
}

/**
 * Segmen alamat → kode proyek baku.
 *
 * Kode proyek disimpan dalam huruf besar, sementara alamat yang diketik
 * tangan sering huruf kecil. Dibakukan di satu tempat supaya tidak ada
 * halaman yang lupa melakukannya.
 */
export function kodeProyekDari(nilai: string): string {
  return bacaSegmen(nilai).toUpperCase();
}
