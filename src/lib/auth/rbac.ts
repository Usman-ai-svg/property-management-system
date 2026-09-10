import { cache } from "react";
import { prisma } from "@/lib/db";
import { ambilSession } from "./session";
import type { Section } from "@/lib/domain/enums";
import { gabungIzin, type Pengguna } from "@/lib/adaptor/identitas";

/**
 * PENEGAKAN HAK AKSES DI SISI SERVER.
 *
 * Prototipe artifact menyembunyikan data terbatas lewat `can(acl, role, sec)`
 * di komponen React — data tetap dikirim ke browser, hanya tidak digambar.
 * Siapa pun yang membuka DevTools bisa membacanya. Untuk angka RAB/RAP dan
 * business plan, itu kebocoran yang sesungguhnya.
 *
 * Aturan di modul ini:
 *
 *   1. Data yang tidak boleh dilihat TIDAK PERNAH di-SELECT dari database.
 *      Bukan diambil lalu dibuang — memang tidak diambil.
 *   2. Setiap query dibatasi ke proyek yang boleh diakses pengguna.
 *   3. Komponen UI hanya menerima apa yang sudah lolos saringan ini.
 */

/**
 * Bentuk `Pengguna` didefinisikan di `src/lib/adaptor/identitas.ts` — di
 * sanalah kontrak titik sambung login dinyatakan. Diekspor ulang di sini
 * supaya pemanggil lama tidak perlu berubah.
 */
export type { Pengguna };

/**
 * Muat pengguna aktif beserta jabatan dan izinnya.
 *
 * Dibungkus `cache()` supaya beberapa komponen server dalam satu request
 * berbagi hasil yang sama, bukan memukul database berulang kali.
 */
export const ambilPengguna = cache(async (): Promise<Pengguna | null> => {
  const session = await ambilSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId, aktif: true },
    select: {
      id: true,
      nama: true,
      semuaProyek: true,
      roles: { select: { role: { select: { nama: true } } } },
      aksesProyek: { select: { projectId: true } },
    },
  });
  if (!user) return null;

  const jabatan = user.roles.map((r) => r.role.nama);

  // Izin adalah GABUNGAN seluruh jabatan yang dipegang, dengan tingkat
  // tertinggi yang menang. Tidak ada lagi "peran yang sedang aktif": sumbu
  // izinnya jabatan, dan seseorang memegang jabatannya sekaligus.
  //
  // Dibaca ulang tiap permintaan, bukan disimpan di token, supaya pencabutan
  // hak berlaku seketika — bukan setelah orangnya keluar dan masuk lagi.
  const baris = jabatan.length
    ? await prisma.roleSectionPermission.findMany({
        where: { jabatan: { in: jabatan }, bolehLihat: true },
        select: { section: true, bolehUbah: true },
      })
    : [];

  return {
    id: user.id,
    nama: user.nama,
    jabatan,
    semuaProyek: user.semuaProyek,
    proyekIds: user.aksesProyek.map((a) => a.projectId),
    izin: gabungIzin(baris),
  };
});

/** Apakah pengguna boleh melihat sebuah sub-bagian. */
export const bolehLihat = (u: Pengguna | null, sec: Section): boolean =>
  !!u && u.izin.has(sec);

/** Apakah pengguna boleh mengubah sebuah sub-bagian. */
export const bolehUbah = (u: Pengguna | null, sec: Section): boolean =>
  !!u && u.izin.get(sec) === true;

/** Lempar error bila tidak berhak melihat. Dipakai di awal Server Action. */
export function wajibLihat(u: Pengguna | null, sec: Section): asserts u is Pengguna {
  if (!bolehLihat(u, sec)) {
    throw new Error(`Akses ditolak: jabatan "${u?.jabatan.join(", ") || "tamu"}" tidak berhak melihat "${sec}".`);
  }
}

/** Lempar error bila tidak berhak mengubah. */
export function wajibUbah(u: Pengguna | null, sec: Section): asserts u is Pengguna {
  if (!bolehUbah(u, sec)) {
    throw new Error(`Akses ditolak: jabatan "${u?.jabatan.join(", ") || "tamu"}" tidak berhak mengubah "${sec}".`);
  }
}

/**
 * Klausa `where` pembatas proyek, untuk disisipkan ke setiap query.
 *
 * Mengembalikan `{}` bila pengguna berhak atas semua proyek, atau
 * `{ id: { in: [...] } }` bila dibatasi. Pengguna tanpa akses proyek apa pun
 * mendapat `{ id: { in: [] } }` — yang menghasilkan nol baris, bukan semua baris.
 */
export function filterProyek(u: Pengguna): { id?: { in: string[] } } {
  return u.semuaProyek ? {} : { id: { in: u.proyekIds } };
}

/** Versi untuk tabel yang punya kolom `projectId` (unit, kontrak, biaya, dst). */
export function filterProjectId(u: Pengguna): { projectId?: { in: string[] } } {
  return u.semuaProyek ? {} : { projectId: { in: u.proyekIds } };
}

/** Apakah pengguna boleh menyentuh proyek tertentu. */
export const bolehAksesProyek = (u: Pengguna, projectId: string): boolean =>
  u.semuaProyek || u.proyekIds.includes(projectId);

/**
 * Klausa untuk tabel yang `projectId`-nya boleh kosong — jejak audit misalnya,
 * karena sebagian aksi (perubahan hak akses, status pengguna) tidak menempel
 * pada proyek mana pun.
 *
 * Ditulis lewat kolom projectId, bukan filter relasi: `{ project: {} }` tidak
 * berarti "proyek mana saja" bagi Prisma dan justru menyaring habis hasilnya.
 */
export function filterProjectIdOpsional(
  u: Pengguna,
): { OR: ({ projectId: null } | { projectId: { in: string[] } })[] } | Record<string, never> {
  if (u.semuaProyek) return {};
  return { OR: [{ projectId: null }, { projectId: { in: u.proyekIds } }] };
}

/**
 * Bangun `select` Prisma untuk Unit sesuai hak akses.
 *
 * Inilah wujud nyata aturan nomor 1: bila pengguna tidak berhak atas
 * "hargaRabRap", kolom hargaJual dan rapUpah tidak ikut di-SELECT, dan relasi
 * boqItems/rapItems tidak ikut diambil. Angkanya tidak pernah meninggalkan
 * database, apalagi sampai ke browser.
 */
export function selectUnit(u: Pengguna) {
  const bolehHarga = bolehLihat(u, "hargaRabRap");

  return {
    id: true,
    kode: true,
    nomor: true,
    luasTanah: true,
    statusPembangunan: true,
    statusJual: true,
    progress: true,
    projectId: true,
    phase: { select: { kode: true } },
    unitType: { select: { kode: true, nama: true, luasBangunan: true, luasTanah: true } },
    ...(bolehHarga
      ? {
          hargaJual: true,
          rapUpah: true,
          boqItems: {
            select: { grup: true, uraian: true, satuan: true, volume: true, hargaSatuan: true, spesifikasi: true },
            orderBy: { urutan: "asc" as const },
          },
          rapItems: {
            select: { grup: true, kategori: true, nama: true, satuan: true, volume: true, hargaSatuan: true, keterangan: true },
            orderBy: { urutan: "asc" as const },
          },
        }
      : {}),
  };
}
