import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

/**
 * Sejak Prisma 7, URL koneksi dan konfigurasi migrasi tinggal di sini,
 * bukan lagi di dalam blok `datasource` pada schema.prisma.
 *
 * Untuk pindah ke Postgres: ganti adapter di bawah ke @prisma/adapter-pg
 * dan ubah `provider` di prisma/schema.prisma menjadi "postgresql".
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
