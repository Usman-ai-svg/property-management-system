/**
 * Verifikasi dua rute bukti yang query-nya diturunkan ke src/lib/data/.
 *
 * Seed tidak punya berkas bukti, jadi kedua rute itu tak pernah benar-benar
 * terpanggil oleh uji biasa. Skrip ini membuat data uji ber-`buktiKey`, lalu
 * membaca ISI pesannya — bukan cuma status — karena "baris tidak ditemukan" dan
 * "berkas tidak ada di penyimpanan" sama-sama 404. Yang membedakan keduanya
 * justru membuktikan fungsi pengambil datanya mengembalikan baris yang benar.
 *
 * Data ujinya dihapus lagi di akhir.
 *
 * Jalankan dengan dev server hidup:  npx tsx scripts/cek-bukti-pindahan.ts
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { SignJWT } from "jose";

const ASAL = process.env.REPRO_ASAL ?? "http://localhost:3000";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  }),
});

async function token() {
  const admin = await prisma.user.findFirst({
    where: { roles: { some: { role: { nama: { contains: "Administrator" } } } } },
    select: { id: true, nama: true, roles: { select: { role: { select: { nama: true } } } } },
  });
  if (!admin) throw new Error("tak ada user Administrator");
  const peran = admin.roles.map((r) => r.role.nama);
  return new SignJWT({ userId: admin.id, nama: admin.nama, peranAktif: peran[0], peran })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
}

async function utama() {
  let gagal = 0;
  let expenseId: string | null = null;
  let laporanId: string | null = null;

  try {
    const kuki = await token();
    const proyek = await prisma.project.findFirst({ select: { id: true } });
    if (!proyek) throw new Error("tak ada proyek");

    const expense = await prisma.expense.create({
      data: {
        projectId: proyek.id,
        tanggal: new Date(),
        peruntukan: "Unit (rumah dijual)",
        jenis: "Material",
        metode: "Transfer",
        uraian: "Uji rute bukti",
        total: 1000,
        bukti: "nota-uji.pdf",
        buktiKey: "kunci-uji-yang-tidak-ada",
      },
      select: { id: true },
    });
    expenseId = expense.id;

    const dana = await prisma.pettyCashFund.findFirst({ select: { id: true } });
    if (dana) {
      const laporan = await prisma.pettyCashReport.create({
        data: {
          fundId: dana.id,
          periode: "Uji",
          bukti: "nota-gabungan-uji.pdf",
          buktiKey: "kunci-uji-yang-tidak-ada",
        },
        select: { id: true },
      });
      laporanId = laporan.id;
    }

    const kasus: [string, string, string][] = [
      [
        "bukti pengeluaran — baris KETEMU, berkas tak ada",
        "/api/bukti/" + expenseId,
        "penyimpanan",
      ],
      ["bukti pengeluaran — baris tak ada", "/api/bukti/ngawur", "tidak ditemukan"],
    ];
    if (laporanId) {
      kasus.push([
        "nota petty cash — baris KETEMU, berkas tak ada",
        "/api/petty-bukti/" + laporanId,
        "penyimpanan",
      ]);
      kasus.push(["nota petty cash — baris tak ada", "/api/petty-bukti/ngawur", "tidak ditemukan"]);
    }

    console.log("");
    for (const [nama, jalur, cocok] of kasus) {
      const r = await fetch(ASAL + jalur, {
        headers: { cookie: "nms_session=" + kuki },
        redirect: "manual",
      });
      const teks = await r.text();
      const ok = r.status < 500 && teks.toLowerCase().includes(cocok);
      if (!ok) gagal++;
      console.log(
        "  " + (ok ? "OK   " : "GAGAL") + " " + r.status + "  " + nama,
      );
      console.log('         pesan: "' + teks.slice(0, 60) + '"');
    }
  } finally {
    if (laporanId) await prisma.pettyCashReport.delete({ where: { id: laporanId } });
    if (expenseId) await prisma.expense.delete({ where: { id: expenseId } });
    console.log("");
    console.log("Data uji dibersihkan.");
    await prisma.$disconnect();
  }

  console.log("");
  console.log(gagal === 0 ? "SEMUA LULUS" : gagal + " KASUS GAGAL");
  console.log("");
  process.exit(gagal === 0 ? 0 : 1);
}

utama();
