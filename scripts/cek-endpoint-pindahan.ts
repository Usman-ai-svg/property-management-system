/**
 * Verifikasi fungsional endpoint yang query-nya diturunkan ke src/lib/data/.
 *
 * Memindahkan query bukan perubahan kosmetik: kalau select atau blok hak akses
 * ikut tergeser, gejalanya tidak kelihatan di layar. Skrip ini memanggil kelima
 * endpointnya dengan id sungguhan dari basis data dan memastikan tak satu pun
 * menjawab 5xx, serta yang datanya ada memang menjawab 200.
 *
 * Jalankan dengan dev server hidup:  npx tsx scripts/cek-endpoint-pindahan.ts
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
  const kuki = await token();

  const seg = encodeURIComponent;
  const unit = await prisma.unit.findFirst({ select: { id: true } });
  const tipe = await prisma.unitType.findFirst({
    select: { kode: true, project: { select: { kode: true } } },
  });
  const rab = await prisma.rabEstimasi.findFirst({ select: { id: true } });
  const expense = await prisma.expense.findFirst({
    where: { buktiKey: { not: null } },
    select: { id: true },
  });
  const laporan = await prisma.pettyCashReport.findFirst({
    where: { buktiKey: { not: null } },
    select: { id: true },
  });

  // Bila datanya tidak ada di seed, 404 justru jawaban yang benar — yang
  // dinilai adalah endpointnya hidup dan tidak melempar 5xx.
  const kasus: [string, string, number[]][] = [
    [
      "halaman tipe unit (blok bolehHarga)",
      tipe ? `/master/${seg(tipe.project.kode)}/tipe/${seg(tipe.kode)}` : "",
      [200],
    ],
    ["ekspor BOQ unit", unit ? `/api/ekspor/boq?sasaran=unit&id=${unit.id}` : "", [200]],
    ["ekspor RAP unit", unit ? `/api/ekspor/rap?sasaran=unit&id=${unit.id}` : "", [200]],
    ["ekspor sasaran tak dikenal", "/api/ekspor/boq?sasaran=ngawur&id=x", [404]],
    ["template penawaran RAB", rab ? `/estimasi/${rab.id}/template` : "", [200]],
    ["bukti pengeluaran", expense ? `/api/bukti/${expense.id}` : "", [200, 404]],
    ["nota petty cash", laporan ? `/api/petty-bukti/${laporan.id}` : "", [200, 404]],
    ["bukti id ngawur", "/api/bukti/tidak-ada", [404]],
  ];

  console.log("");
  for (const [nama, jalur, harap] of kasus) {
    if (!jalur) {
      console.log("  LEWAT       (tidak ada datanya di seed)  " + nama);
      continue;
    }
    const r = await fetch(ASAL + jalur, {
      headers: { cookie: "nms_session=" + kuki },
      redirect: "manual",
    });
    const ok = harap.includes(r.status) && r.status < 500;
    if (!ok) gagal++;
    console.log(
      "  " + (ok ? "OK   " : "GAGAL") + " " + String(r.status).padEnd(3) +
        " (harap " + harap.join("/") + ")  " + nama,
    );
  }

  await prisma.$disconnect();
  console.log("");
  console.log(gagal === 0 ? "SEMUA LULUS" : gagal + " KASUS GAGAL");
  console.log("");
  process.exit(gagal === 0 ? 0 : 1);
}

utama();
