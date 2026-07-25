/**
 * Hapus berkas database demo sebelum dibuat ulang.
 *
 * Dipakai oleh `npm run db:reset`. Ditulis sebagai skrip Node, bukan `rm -f`,
 * karena `rm` tidak ada di Windows — dan bukan `prisma db push --force-reset`,
 * karena perintah itu menghapus isi database apa pun yang sedang ditunjuk
 * DATABASE_URL, termasuk Postgres produksi bila variabelnya salah arah.
 *
 * Menghapus berkas hanya berlaku untuk SQLite. Bila DATABASE_URL sudah
 * menunjuk ke server database, skrip ini tidak melakukan apa-apa dan
 * memberitahukannya.
 */

import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

if (!url.startsWith("file:")) {
  console.log(
    `DATABASE_URL menunjuk ke server database, bukan berkas SQLite.\n` +
      `Tidak ada berkas yang dihapus. Reset database server harus dilakukan sendiri.`,
  );
  process.exit(0);
}

const akar = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const berkas = path.resolve(akar, url.slice("file:".length));

// SQLite bisa meninggalkan berkas pendamping saat aplikasi berhenti mendadak.
for (const akhiran of ["", "-journal", "-wal", "-shm"]) {
  rmSync(berkas + akhiran, { force: true });
}

console.log(`Database lama dihapus: ${path.relative(akar, berkas)}`);
