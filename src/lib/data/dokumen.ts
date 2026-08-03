import { prisma } from "@/lib/db";

/**
 * Pengambilan data dokumen untuk endpoint unduhan.
 *
 * Sebuah `Document` bisa menempel pada banyak jenis induk — legalitas proyek,
 * tipe unit, sarpras, atau kerja tambah. Karena itu seluruh relasi induknya
 * ikut di-SELECT: pemanggil perlu tahu proyek mana pemiliknya sebelum boleh
 * menyajikan berkasnya.
 */
export async function versiDokumen(versiId: string) {
  return prisma.documentVersion.findUnique({
    where: { id: versiId },
    select: {
      namaFile: true, objectKey: true, ukuranByte: true,
      document: {
        select: {
          legality: { select: { projectId: true } },
          projectAnalisa: { select: { id: true } },
          unitTypeModel3d: { select: { projectId: true } },
          unitTypeGambarKerjaPdf: { select: { projectId: true } },
          unitTypeGambarKerjaDwg: { select: { projectId: true } },
          unitTypeRender: { select: { projectId: true } },
          unitTypeSpek: { select: { projectId: true } },
          infraModel3d: { select: { projectId: true } },
          infraGambarKerjaPdf: { select: { projectId: true } },
          infraGambarKerjaDwg: { select: { projectId: true } },
          ktDesain: { select: { unit: { select: { projectId: true } } } },
          ktModel3d: { select: { unit: { select: { projectId: true } } } },
          ktGambarKerjaPdf: { select: { unit: { select: { projectId: true } } } },
          ktGambarKerjaDwg: { select: { unit: { select: { projectId: true } } } },
          ktRab: { select: { unit: { select: { projectId: true } } } },
        },
      },
    },
  });
}

/**
 * Kumpulkan id proyek pemilik dokumen dari relasi mana pun yang terisi.
 *
 * Dipisah dari query supaya bisa diuji tanpa basis data, dan supaya aturannya
 * ikut terbawa saat modul ini diserap ERP.
 */
export function proyekPemilikDokumen(
  d: NonNullable<Awaited<ReturnType<typeof versiDokumen>>>["document"],
): string[] {
  return [
    d.legality?.projectId,
    d.projectAnalisa?.id,
    d.unitTypeModel3d?.projectId,
    d.unitTypeGambarKerjaPdf?.projectId,
    d.unitTypeGambarKerjaDwg?.projectId,
    d.unitTypeRender?.projectId,
    d.unitTypeSpek?.projectId,
    ...d.infraModel3d.map((x) => x.projectId),
    ...d.infraGambarKerjaPdf.map((x) => x.projectId),
    ...d.infraGambarKerjaDwg.map((x) => x.projectId),
    ...d.ktDesain.map((x) => x.unit.projectId),
    ...d.ktModel3d.map((x) => x.unit.projectId),
    ...d.ktGambarKerjaPdf.map((x) => x.unit.projectId),
    ...d.ktGambarKerjaDwg.map((x) => x.unit.projectId),
    ...d.ktRab.map((x) => x.unit.projectId),
  ].filter((x): x is string => !!x);
}
