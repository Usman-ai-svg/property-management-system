/**
 * Migrasi data lama: pembayaran kontrak vendor dulu menulis `peruntukan` dengan
 * teks di luar enum ("Unit" / "Sarana & Prasarana") dan tanpa `posHpp`, sehingga
 * luput dari laporan realisasi & komposisi biaya. Skrip ini menyelaraskan baris
 * Expense lama ke enum resmi PERUNTUKAN_BIAYA dan mengisi posHpp dari POS_HPP.
 *
 * Idempoten — aman dijalankan berulang. Jalankan pada DB dev yang sudah tersemai
 * tanpa reset:  tsx scripts/migrasi-peruntukan-kontrak.ts
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { POS_HPP } from "../src/lib/domain/enums";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

// Teks lama → enum resmi.
const PETA_PERUNTUKAN: Record<string, keyof typeof POS_HPP> = {
  "Unit": "Unit (rumah dijual)",
  "Sarana & Prasarana": "Prasarana & Sarana",
};

async function main() {
  let ubahEnum = 0;
  for (const [lama, baru] of Object.entries(PETA_PERUNTUKAN)) {
    const r = await prisma.expense.updateMany({
      where: { peruntukan: lama },
      data: { peruntukan: baru, posHpp: POS_HPP[baru] },
    });
    ubahEnum += r.count;
  }

  // Isi posHpp yang masih kosong pada baris dengan peruntukan yang sudah benar
  // (mis. pembayaran kontrak dari seed lama yang enum-nya benar tapi posHpp null).
  let isiPos = 0;
  for (const [peruntukan, pos] of Object.entries(POS_HPP)) {
    const r = await prisma.expense.updateMany({
      where: { peruntukan, posHpp: null },
      data: { posHpp: pos },
    });
    isiPos += r.count;
  }

  console.log(`✔ ${ubahEnum} baris peruntukan lama diselaraskan; ${isiPos} baris posHpp terisi`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
