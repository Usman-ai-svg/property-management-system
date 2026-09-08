/**
 * Perhitungan pembelian material (PO). Murni — tanpa I/O, tanpa framework.
 *
 * Sebuah PO punya DUA sumbu yang bergerak sendiri-sendiri: barangnya sudah
 * datang atau belum (`Pembelian.status` = Draft/Diterima), dan sudah dibayar
 * berapa (Σ pembayaran terhadap nilai nota). Keduanya tidak saling menunggu —
 * DP boleh dibayar sebelum barang datang, dan barang boleh datang sebelum
 * dibayar sepeser pun.
 */

/** Nilai sebuah PO dari baris-barisnya. */
export function totalPembelian(items: { qty: number; harga: number }[]): number {
  return items.reduce((s, it) => s + it.qty * it.harga, 0);
}

/** Yang sudah dibayarkan untuk sebuah PO. */
export function terbayarPembelian(pembayaran: { total: number }[]): number {
  return pembayaran.reduce((s, e) => s + e.total, 0);
}

/**
 * Hutang berjalan sebuah PO.
 *
 * CATATAN PERILAKU: kelebihan bayar menghasilkan angka NEGATIF, dan itu memang
 * yang terjadi sekarang di kedua halaman. Menjepitnya ke nol akan mengubah
 * angka yang tampil, jadi tidak dilakukan di sini — apakah kelebihan bayar
 * seharusnya mungkin sama sekali adalah pertanyaan invarian (Kelompok B5),
 * bukan pertanyaan tampilan.
 */
export function hutangPembelian(total: number, terbayar: number): number {
  return total - terbayar;
}

export type StatusPembelianTampil = "Draft" | "DP" | "Dibayar Penuh" | "Diterima" | "Lunas";

/**
 * Label status gabungan dari dua sumbu itu.
 *
 *   Belum diterima : Draft (belum bayar) · DP (sebagian) · Dibayar Penuh (lunas di muka)
 *   Sudah diterima : Diterima (masih ada sisa) · Lunas (sisa habis)
 *
 * Bentuk lima keadaan ini dulu hanya hidup di halaman Keuangan; halaman Pemasok
 * punya turunannya sendiri yang cuma mengenal "Lunas", sehingga PO yang sama
 * bisa tampil berbeda tergantung dari mana dilihat. Yang bertingkat lima ini
 * yang benar — "Dibayar Penuh" (uang sudah keluar, barang belum datang) adalah
 * keadaan berisiko yang memang perlu terlihat.
 */
export function statusPembelian(
  diterima: boolean,
  total: number,
  terbayar: number,
): StatusPembelianTampil {
  const lunasBayar = total > 0 && terbayar >= total;
  if (diterima) return lunasBayar ? "Lunas" : "Diterima";
  if (terbayar <= 0) return "Draft";
  return lunasBayar ? "Dibayar Penuh" : "DP";
}
