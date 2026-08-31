/**
 * Repro alamat bergaris miring.
 *
 * Membuat data uji yang penamaannya seperti di lapangan — tipe rumah "36/72",
 * yang garis miringnya memecah satu segmen alamat menjadi dua — lalu memanggil
 * halamannya lewat HTTP dan memastikan jawabannya 200, bukan 404.
 *
 * Gejala bug ini hanya muncul pada data tertentu: seluruh kode contoh di seed
 * ramah alamat, jadi tanpa data seperti ini semua halaman terlihat sehat.
 *
 * Data ujinya dihapus lagi di akhir, termasuk bila ada yang gagal di tengah.
 *
 * Jalankan dengan dev server hidup:  npx tsx scripts/repro-slash.ts
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { SignJWT } from "jose";

const ASAL = process.env.REPRO_ASAL ?? "http://localhost:3000";
const KODE_TIPE = "36/72";

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

async function ambil(jalur: string, kuki: string) {
  const r = await fetch(ASAL + jalur, {
    headers: { cookie: "nms_session=" + kuki },
    redirect: "manual",
  });
  return r.status;
}

let tipeId: string | null = null;
let gagal = 0;

async function utama() {
  try {
  const proyek = await prisma.project.findFirst({ select: { id: true, kode: true } });
  if (!proyek) throw new Error("tak ada proyek di basis data");

  const tipe = await prisma.unitType.create({
    data: {
      projectId: proyek.id,
      kode: KODE_TIPE,
      nama: "Tipe Uji Garis Miring",
      luasBangunan: 36,
      luasTanah: 72,
    },
    select: { id: true },
  });
  tipeId = tipe.id;

  const kuki = await token();
  const p = encodeURIComponent(proyek.kode);
  const t = encodeURIComponent(KODE_TIPE);

  // Sandi cacat dijawab 400 oleh Next.js sendiri — URI rusak ditolak sebelum
  // sampai ke halaman. Yang penting bukan angka persisnya melainkan bahwa ia
  // TIDAK 500: alamatnya memang tidak menunjuk apa pun, jadi menolak dengan
  // wajar sudah benar. Karena itu 400 dan 404 sama-sama diterima di sini.
  const kasus: [string, string, number[]][] = [
    ["tipe bergaris miring, tersandi benar", "/master/" + p + "/tipe/" + t, [200]],
    ["proyek induknya masih normal", "/master/" + p, [200]],
    ["bentuk LAMA tanpa sandi — inilah bugnya", "/master/" + p + "/tipe/" + KODE_TIPE, [404]],
    ["sandi cacat — ditolak wajar, bukan 500", "/master/" + p + "/tipe/%E0%A4", [400, 404]],
  ];

  console.log("");
  console.log("Proyek uji: " + proyek.kode + '   Tipe uji: "' + KODE_TIPE + '"');
  console.log("");

  for (const [nama, jalur, harap] of kasus) {
    const status = await ambil(jalur, kuki);
    const ok = harap.includes(status);
    if (!ok) gagal++;
    const tanda = ok ? "OK   " : "GAGAL";
    console.log(
      "  " + tanda + " " + String(status).padEnd(3) + " (harap " + harap.join("/") + ")  " + nama,
    );
    console.log("         " + jalur);
  }
} finally {
  if (tipeId) {
    await prisma.unitType.delete({ where: { id: tipeId } });
    console.log("");
    console.log("Data uji dibersihkan.");
  }
  await prisma.$disconnect();
  }

  console.log("");
  console.log(gagal === 0 ? "SEMUA LULUS" : gagal + " KASUS GAGAL");
  console.log("");
  process.exit(gagal === 0 ? 0 : 1);
}

utama();
