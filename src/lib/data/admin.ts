import { prisma } from "@/lib/db";
import { filterProjectIdOpsional, filterProyek, type Pengguna } from "@/lib/auth/rbac";

/**
 * Pengambilan data untuk halaman Admin: proyek, peran, pengguna, dan jejak audit.
 *
 * Keempatnya diambil sekali jalan karena halaman Admin memuat seluruh tab
 * sekaligus — berpindah tab tidak memuat ulang dari server.
 */
export async function dataAdmin(u: Pengguna) {
  const [proyek, peran, matriks, users, log] = await Promise.all([
    // Hanya id/kode/nama: daftar proyek di halaman Admin sekarang cuma dipakai
    // menyusun akses proyek pengguna di tab Kelola User. Pembuatan dan
    // penyuntingan proyek sudah pindah ke Master Proyek.
    prisma.project.findMany({
      where: filterProyek(u),
      orderBy: { kode: "asc" },
      select: { id: true, kode: true, nama: true },
    }),
    prisma.role.findMany({
      orderBy: { nama: "asc" },
      select: { id: true, nama: true, grup: true, _count: { select: { users: true } } },
    }),
    // Matriks izin dikunci ke NAMA peran, bukan id — jadi ia diambil terpisah
    // lalu ditempelkan, bukan lewat relasi. Bentuk itu yang membuat isinya bisa
    // ditempel apa adanya ke ERP, tempat tabel Role tidak ada.
    prisma.roleSectionPermission.findMany({
      select: { roleNama: true, section: true, bolehUbah: true },
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

  const izinPeran = new Map<string, { section: string; bolehUbah: boolean }[]>();
  for (const p of matriks) {
    const daftar = izinPeran.get(p.roleNama);
    if (daftar) daftar.push(p);
    else izinPeran.set(p.roleNama, [p]);
  }

  return {
    proyek,
    peran: peran.map((r) => ({ ...r, permissions: izinPeran.get(r.nama) ?? [] })),
    users,
    log,
  };
}
