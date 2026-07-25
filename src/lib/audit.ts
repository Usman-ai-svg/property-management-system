import { prisma } from "@/lib/db";
import type { Pengguna } from "@/lib/auth/rbac";

/**
 * Pencatatan jejak audit.
 *
 * Setiap perubahan data dicatat beserta nilai sebelum dan sesudahnya. Ini
 * bukan pelengkap: perubahan harga satuan oleh QS menggeser RAB, dan tanpa
 * catatan siapa-mengubah-apa-kapan, angka itu tidak bisa dipertanggungjawabkan.
 *
 * Tabel audit_logs bersifat append-only — tidak ada fungsi di sini yang
 * memperbarui atau menghapus.
 */

export interface CatatanPerubahan {
  pengguna: Pengguna;
  projectId?: string | null;
  /** Objek yang diubah, mis. "Unit F2-3 · RAB" */
  objek: string;
  aksi: string;
  dari?: string | null;
  ke?: string | null;
}

export async function catat(c: CatatanPerubahan): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: c.pengguna.id,
      peran: c.pengguna.peranAktif,
      projectId: c.projectId ?? null,
      objek: c.objek,
      aksi: c.aksi,
      nilaiDari: c.dari ?? null,
      nilaiKe: c.ke ?? null,
    },
  });
}

/** Label yang enak dibaca untuk nama field teknis. */
export type PetaLabel = Record<string, string>;

/** Pemformat nilai per field, mis. supaya rupiah tampil sebagai "Rp 1.250.000". */
export type PetaFormat = Record<string, (v: unknown) => string>;

const bawaan = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "(kosong)";
  if (typeof v === "number") return v.toLocaleString("id-ID");
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
};

/**
 * Bandingkan dua objek dan catat satu baris log untuk tiap field yang berubah.
 *
 * Satu baris per field, bukan satu baris berisi seluruh objek — supaya
 * pertanyaan "siapa yang menaikkan harga keramik" bisa dijawab langsung
 * tanpa membaca diff panjang.
 */
export async function catatDiff(opts: {
  pengguna: Pengguna;
  projectId?: string | null;
  objek: string;
  sebelum: Record<string, unknown>;
  sesudah: Record<string, unknown>;
  label?: PetaLabel;
  format?: PetaFormat;
}): Promise<number> {
  const { pengguna, projectId, objek, sebelum, sesudah, label = {}, format = {} } = opts;
  const baris: CatatanPerubahan[] = [];

  for (const kunci of Object.keys(sesudah)) {
    const lama = sebelum[kunci];
    const baru = sesudah[kunci];

    // Bandingkan lewat representasi terformatnya supaya 1000 dan "1000"
    // tidak dianggap berbeda.
    const f = format[kunci] ?? bawaan;
    const teksLama = f(lama);
    const teksBaru = f(baru);
    if (teksLama === teksBaru) continue;

    baris.push({
      pengguna,
      projectId,
      objek: `${objek} · ${label[kunci] ?? kunci}`,
      aksi: "Ubah nilai",
      dari: teksLama,
      ke: teksBaru,
    });
  }

  if (baris.length === 0) return 0;

  await prisma.auditLog.createMany({
    data: baris.map((b) => ({
      userId: b.pengguna.id,
      peran: b.pengguna.peranAktif,
      projectId: b.projectId ?? null,
      objek: b.objek,
      aksi: b.aksi,
      nilaiDari: b.dari ?? null,
      nilaiKe: b.ke ?? null,
    })),
  });

  return baris.length;
}

/** Format rupiah untuk nilai dalam log. */
export const rpLog = (v: unknown): string =>
  v === null || v === undefined ? "(kosong)" : "Rp " + Number(v).toLocaleString("id-ID");
