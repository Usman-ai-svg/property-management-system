import "dotenv/config";
import { buatMesinGdrive, konfigDariEnv } from "../src/lib/storage/gdrive";

/**
 * PEMERIKSA PENYIAPAN GOOGLE DRIVE.
 *
 * Memeriksa variabel lingkungan TIDAK cukup. Tiga variabel yang terisi lengkap
 * masih bisa gagal karena folder tujuannya belum dibagikan ke service account,
 * kunci privatnya terpotong saat disalin, atau Drive API belum diaktifkan di
 * project Google Cloud — dan ketiganya baru ketahuan saat orang pertama
 * mengunggah dokumen di produksi.
 *
 * Karena itu skrip ini benar-benar mencoba jalur lengkapnya: minta token,
 * unggah berkas kecil, baca lagi, bandingkan isinya, lalu hapus. Kalau berhasil
 * sampai akhir, Drive siap dipakai.
 *
 * Jalankan:  npm run cek:drive
 */

const HIJAU = "[32m";
const MERAH = "[31m";
const KUNING = "[33m";
const MATI = "[0m";

const ok = (pesan: string) => console.log(`${HIJAU}OK${MATI}    ${pesan}`);
const gagal = (pesan: string) => console.log(`${MERAH}GAGAL${MATI} ${pesan}`);
const info = (pesan: string) => console.log(`      ${pesan}`);

const NAMA_UJI = `cek-drive-${Date.now()}.txt`;
const ISI_UJI = `Berkas uji dari npm run cek:drive pada ${new Date().toISOString()}`;

function jelaskan(galat: unknown): string {
  const pesan = galat instanceof Error ? galat.message : String(galat);

  // 403 dari Drive hampir selalu berarti folder tujuan belum dibagikan ke
  // service account. Pesan Drive sendiri tidak menyebut itu sama sekali, dan
  // inilah kesalahan penyiapan yang paling sering terjadi.
  if (pesan.includes("403") || pesan.toLowerCase().includes("menolak")) {
    return (
      `${pesan}\n\n` +
      `      Yang paling sering: folder tujuan belum dibagikan ke service account.\n` +
      `      Buka folder Drive-nya, Share, tempelkan alamat GDRIVE_CLIENT_EMAIL,\n` +
      `      beri peran Editor. Lihat docs/setup-drive.md langkah 6.`
    );
  }
  if (pesan.includes("PKCS") || pesan.toLowerCase().includes("private key")) {
    return (
      `${pesan}\n\n` +
      `      Kunci privat biasanya terpotong saat disalin. Ia harus memuat baris\n` +
      `      BEGIN dan END, dan baris barunya ditulis sebagai \\n di berkas .env.`
    );
  }
  if (pesan.includes("404")) {
    return (
      `${pesan}\n\n` +
      `      GDRIVE_FOLDER_ID mungkin keliru. Ambil dari URL folder:\n` +
      `      drive.google.com/drive/folders/<INILAH_ID-NYA>`
    );
  }
  return pesan;
}

async function main() {
  console.log("\nMemeriksa penyiapan Google Drive…\n");

  // --- 1. konfigurasi ------------------------------------------------------
  const kurang = ["GDRIVE_CLIENT_EMAIL", "GDRIVE_PRIVATE_KEY", "GDRIVE_FOLDER_ID"]
    .filter((k) => !process.env[k]);

  if (kurang.length > 0) {
    gagal(`Variabel belum lengkap: ${kurang.join(", ")}`);
    info("Selama belum lengkap, aplikasi menulis berkas ke disk (STORAGE_ENGINE=lokal)");
    info("dan itu memang jalan penuh. Lihat docs/setup-drive.md.");
    process.exitCode = 1;
    return;
  }

  const konfig = konfigDariEnv();
  if (!konfig) {
    gagal("Konfigurasi tidak terbaca meski ketiga variabel terisi.");
    process.exitCode = 1;
    return;
  }
  ok(`Tiga variabel terisi · service account ${konfig.clientEmail}`);
  info(`folder tujuan ${konfig.folderId}`);

  if (process.env.STORAGE_ENGINE !== "gdrive") {
    console.log(
      `${KUNING}CATATAN${MATI} STORAGE_ENGINE belum bernilai "gdrive", jadi berkas BARU masih`,
    );
    info("ditulis ke disk. Pemeriksaan di bawah tetap dijalankan.");
  }

  const mesin = buatMesinGdrive(konfig);
  let objectKey: string | null = null;

  try {
    // --- 2. unggah ---------------------------------------------------------
    const data = new TextEncoder().encode(ISI_UJI);
    const hasil = await mesin.simpan(data.buffer as ArrayBuffer, NAMA_UJI);
    objectKey = hasil.objectKey;
    ok(`Unggah berhasil · ${hasil.ukuranByte} byte · kunci ${hasil.objectKey}`);

    // --- 3. baca lagi ------------------------------------------------------
    const kembali = await mesin.baca(hasil.objectKey.replace(/^gdrive:/, ""));
    const isi = kembali.toString("utf8");
    if (isi !== ISI_UJI) {
      gagal("Isi berkas yang terbaca BERBEDA dari yang diunggah.");
      info(`dikirim : ${ISI_UJI}`);
      info(`terbaca : ${isi}`);
      process.exitCode = 1;
      return;
    }
    ok("Baca ulang berhasil, isinya sama persis");
  } catch (galat) {
    gagal(jelaskan(galat));
    process.exitCode = 1;
  } finally {
    // --- 4. bersihkan ------------------------------------------------------
    // Dijalankan juga saat langkah sebelumnya gagal: berkas uji yang tertinggal
    // di folder produksi lebih mengganggu daripada berguna.
    if (objectKey) {
      try {
        await mesin.hapus(objectKey.replace(/^gdrive:/, ""));
        ok("Berkas uji dihapus kembali");
      } catch (galat) {
        gagal(`Berkas uji TIDAK terhapus — hapus manual: ${NAMA_UJI}`);
        info(jelaskan(galat));
        process.exitCode = 1;
      }
    }
  }

  if (!process.exitCode) {
    console.log(`\n${HIJAU}Drive siap dipakai.${MATI}`);
    console.log("Setel STORAGE_ENGINE=gdrive supaya berkas baru tersimpan di sana.\n");
  } else {
    console.log(`\n${MERAH}Drive belum siap.${MATI} Aplikasi tetap jalan dengan penyimpanan disk.\n`);
  }
}

main();
