import { prisma } from "@/lib/db";
import { filterProjectIdOpsional, filterProyek, type Pengguna } from "@/lib/auth/rbac";

/**
 * Pengambilan data untuk halaman Admin: proyek, peran, pengguna, dan jejak audit.
 *
 * Keempatnya diambil sekali jalan karena halaman Admin memuat seluruh tab
 * sekaligus — berpindah tab tidak memuat ulang dari server.
 */
export async function dataAdmin(u: Pengguna) {
  const [proyek, peran, users, log] = await Promise.all([
    prisma.project.findMany({
      where: filterProyek(u),
      orderBy: { kode: "asc" },
      select: {
        id: true, kode: true, nama: true, status: true, statusLahan: true,
        luasKavlingEfektif: true, luasSarana: true, luasPrasarana: true, luasRth: true,
        fases: {
          orderBy: { urutan: "asc" as const },
          select: { id: true, kode: true, nama: true, urutan: true, _count: { select: { units: true } } },
        },
        _count: { select: { units: true, infrastructures: true, contracts: true } },
      },
    }),
    prisma.role.findMany({
      orderBy: { nama: "asc" },
      select: {
        id: true, nama: true, grup: true,
        permissions: { select: { section: true, bolehUbah: true } },
        _count: { select: { users: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: { nama: "asc" },
      select: {
        id: true, nama: true, inisial: true, email: true, aktif: true, semuaProyek: true,
        roles: { select: { role: { select: { id: true, nama: true, grup: true } } } },
        aksesProyek: { select: { project: { select: { id: true, kode: true } } } },
      },
    }),
    // Jejak audit memakai penyaring yang membolehkan projectId kosong —
    // sebagian aksi (perubahan hak akses, status pengguna) tidak menempel
    // pada proyek mana pun.
    prisma.auditLog.findMany({
      where: filterProjectIdOpsional(u),
      orderBy: { waktu: "desc" },
      take: 60,
      select: {
        id: true, waktu: true, peran: true, objek: true, aksi: true,
        nilaiDari: true, nilaiKe: true,
        user: { select: { nama: true } },
        project: { select: { kode: true } },
      },
    }),
  ]);

  return { proyek, peran, users, log };
}
