/**
 * Angka pendukung grafik komposisi. Murni — tanpa framework, tanpa I/O.
 *
 * Yang ada di sini hanyalah aritmetika yang menentukan BESARNYA potongan.
 * Geometri gambarnya (jari-jari, keliling, sudut putar) tetap tinggal di
 * komponennya, karena itu memang urusan tampilan dan akan digambar ulang dengan
 * cara lain di ERP.
 */

/**
 * Pembagi untuk menghitung porsi tiap potongan.
 *
 * Mengembalikan 1 bila seluruh datanya nol, supaya pembagian tidak menghasilkan
 * NaN dan grafiknya tergambar kosong — bukan hilang sama sekali. Nilai negatif
 * ikut dijumlahkan apa adanya; grafik komposisi memang tidak dimaksudkan untuk
 * angka negatif, dan menyembunyikannya diam-diam akan menutupi data yang salah.
 */
export function pembagiProporsi(data: { nilai: number }[]): number {
  return data.reduce((s, d) => s + d.nilai, 0) || 1;
}

/** Porsi sebuah potongan terhadap keseluruhan, dalam pecahan 0–1. */
export function porsiPotongan(nilai: number, pembagi: number): number {
  return pembagi ? nilai / pembagi : 0;
}
