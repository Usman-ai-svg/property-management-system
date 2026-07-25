import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma Client tunggal.
 *
 * Di mode dev, Next melakukan hot-reload berkali-kali; tanpa cache di
 * globalThis, tiap reload akan membuka koneksi baru sampai kehabisan.
 *
 * Untuk pindah ke Postgres: ganti adapter ini dengan `PrismaPg` dari
 * @prisma/adapter-pg, dan ubah `provider` di prisma/schema.prisma.
 */
const buatClient = () =>
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
    }),
  });

const g = globalThis as unknown as { prisma?: ReturnType<typeof buatClient> };

export const prisma = g.prisma ?? buatClient();

if (process.env.NODE_ENV !== "production") g.prisma = prisma;
