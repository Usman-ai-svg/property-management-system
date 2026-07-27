/**
 * Penyemaian data demo.
 *
 * Jalankan: npm run db:reset   (hapus DB, buat ulang, semai)
 *
 * Perbedaan penting dari prototipe: unit di sini adalah RECORD SUNGGUHAN
 * beserta baris BOQ/RAP hasil snapshot — bukan hasil formula yang dihitung
 * ulang setiap render. Angka progres dan status memang masih dibangkitkan
 * dari rumus deterministik yang sama seperti artifact, semata supaya demo
 * terlihat identik; setelah dipakai, angka-angka itu diubah lewat aplikasi.
 */

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { buatBoqDariTemplate, buatRapDariTemplate, hitungUpahRap, rabAcuan, rapAcuan, totalBaris, boqSarprasDefault, rapGenerik } from "../src/lib/calc/boq";
import { parseUkuran } from "../src/lib/format";
import { alokasiPembayaran } from "../src/lib/calc/keuangan";
import {
  ACL_AWAL, ACL_UBAH, ASET, BIAYA_OPERASIONAL, BIAYA_UMUM, KERJA_TAMBAH, KONTRAK, LOG_AWAL,
  PORSI_BIAYA_SARPRAS, PORSI_BIAYA_UNIT, POS_HPP, PROYEK, ROLE_GRUP, SARPRAS, SEMUA_PERAN,
  TENDER, TIPE_UNIT, USERS, VENDOR, type Dok, tgl,
} from "./seed-data";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

/** Password seragam untuk seluruh akun demo. */
const PASSWORD_DEMO = "nanoland2026";

/** Ubah nama menjadi email kantor: "Andra Wijaya" → "andra.wijaya@nanoland.id" */
const emailDari = (nama: string) =>
  nama.toLowerCase().replace(/[^a-z\s]/g, "").trim().replace(/\s+/g, ".") + "@nanoland.id";

/**
 * Rincian pekerjaan contoh untuk BOQ SPK borongan.
 *
 * Bobotnya sengaja tidak rata — pekerjaan struktur jauh lebih mahal daripada
 * finishing. Justru ketimpangan itu yang membuat progres tertimbang terlihat
 * bedanya dari rata-rata sederhana saat demo.
 */
const BOQ_SPK = [
  { grup: "Persiapan", uraian: "Pembersihan lahan & bouwplank", satuan: "ls", volume: 1, bagian: 0.04 },
  { grup: "Struktur", uraian: "Pek. Pondasi batu kali", satuan: "m³", volume: 18, bagian: 0.16 },
  { grup: "Struktur", uraian: "Pek. Sloof, kolom & ring balok", satuan: "m³", volume: 9, bagian: 0.22 },
  { grup: "Struktur", uraian: "Pek. Rangka atap baja ringan", satuan: "m²", volume: 78, bagian: 0.18 },
  { grup: "Arsitektur", uraian: "Pek. Dinding bata & plesteran", satuan: "m²", volume: 210, bagian: 0.2 },
  { grup: "Arsitektur", uraian: "Pek. Lantai & keramik", satuan: "m²", volume: 60, bagian: 0.12 },
  { grup: "Finishing", uraian: "Pek. Pengecatan", satuan: "m²", volume: 240, bagian: 0.08 },
];

/**
 * Isi BOQ SPK beserta progres tiap barisnya.
 *
 * Progres per baris dibangkitkan dari progres unit yang SUDAH tersimpan,
 * dengan anggapan pekerjaan diselesaikan berurutan. Tujuannya supaya angka
 * demo tidak berubah begitu fitur ini masuk: progres unit hasil hitung ulang
 * tertimbang mendarat persis di angka yang sama seperti sebelumnya.
 *
 * Pengisian mengikuti NILAI KUMULATIF, bukan urutan baris. `fraksiBaris()`
 * yang lama memakai `i / n`, yang hanya benar bila semua baris berbobot sama —
 * padahal pekerjaan struktur jauh lebih mahal daripada pengecatan. Memakai
 * urutan baris di sini akan meleset sampai sepuluh poin dari progres unit.
 *
 * Yang berbeda hanyalah arah datanya. Setelah ini, angka barislah yang
 * sungguhan dan angka unit yang jadi turunan — bukan sebaliknya.
 */
async function isiBoqSpk(contractId: string, K: { nominal: number }) {
  const cakupan = await prisma.contractUnit.findMany({
    where: { contractId },
    select: { unit: { select: { id: true, progress: true } } },
  });
  if (cakupan.length === 0) return;

  // Nilai SPK dibagi rata ke seluruh unit, lalu dipecah menurut bobot pekerjaan.
  const nilaiPerUnit = K.nominal / cakupan.length;

  for (const { unit } of cakupan) {
    // Harga satuan dibulatkan lebih dulu supaya nilai yang dipakai di sini
    // sama persis dengan yang nanti dibaca aplikasi dari database.
    const baris = BOQ_SPK.map((b) => ({
      ...b,
      hargaSatuan: Math.round((nilaiPerUnit * b.bagian) / b.volume),
    }));
    const totalNilai = baris.reduce((s, b) => s + b.volume * b.hargaSatuan, 0);

    // Vendor borongan struktur biasanya berjalan lebih dulu daripada rata-rata
    // pekerjaan unit — finishing dan MEP menyusul belakangan. Progres SPK
    // karena itu sengaja dibuat lebih maju daripada progres konstruksi, supaya
    // data demo memperlihatkan bahwa keduanya memang angka yang BERBEDA:
    // Progress Vendor mengukur lingkup satu SPK, Progress Konstruksi mengukur
    // seluruh lingkup unit.
    const majuVendor = Math.min(100, Math.round(unit.progress * 1.3));
    const sasaran = totalNilai * (majuVendor / 100);

    let terkumpul = 0;
    await prisma.contractBoqItem.createMany({
      data: baris.map((b, i) => {
        const nilaiBaris = b.volume * b.hargaSatuan;
        // Isi baris ini sebanyak sisa sasaran yang masih bisa ditampungnya.
        const fraksi = nilaiBaris
          ? Math.max(0, Math.min(1, (sasaran - terkumpul) / nilaiBaris))
          : 0;
        terkumpul += nilaiBaris;
        return {
          contractId,
          unitId: unit.id,
          grup: b.grup,
          uraian: b.uraian,
          satuan: b.satuan,
          volume: b.volume,
          hargaSatuan: b.hargaSatuan,
          progress: Math.round(fraksi * 100),
          urutan: i + 1,
        };
      }),
    });
  }
}

/**
 * Isi progres tiap baris BOQ Master dari progres unit yang sudah tersimpan.
 *
 * Pengisian mengikuti NILAI KUMULATIF baris, bukan urutan baris, supaya
 * progres unit hasil hitung ulang tertimbang mendarat persis di angka lama —
 * angka demo tidak berubah oleh perpindahan sumber ini.
 *
 * Baris paling awal dibuat tuntas lebih dulu; itu mendekati urutan kerja
 * nyata (struktur sebelum finishing) dan membuat tabel opname terbaca masuk
 * akal saat demo.
 */
async function isiProgresBoqMaster() {
  const unit = await prisma.unit.findMany({
    select: {
      id: true, progress: true,
      boqItems: {
        orderBy: { urutan: "asc" },
        select: { id: true, volume: true, hargaSatuan: true },
      },
    },
  });

  for (const u of unit) {
    if (u.boqItems.length === 0) continue;
    const total = u.boqItems.reduce((s, b) => s + b.volume * b.hargaSatuan, 0);
    if (total === 0) continue;

    const sasaran = total * (u.progress / 100);
    // Opname "minggu lalu" diambil beberapa poin di belakang supaya kolom
    // penambahan minggu ini pada laporan tidak kosong saat demo.
    const sasaranLalu = total * (Math.max(0, u.progress - 7) / 100);

    let terkumpul = 0;
    for (const b of u.boqItems) {
      const nilai = b.volume * b.hargaSatuan;
      const isi = (batas: number) =>
        nilai ? Math.round(Math.max(0, Math.min(1, (batas - terkumpul) / nilai)) * 100) : 0;
      const progress = isi(sasaran);
      const progressLalu = isi(sasaranLalu);
      terkumpul += nilai;
      await prisma.unitBoqItem.update({
        where: { id: b.id },
        data: { progress, progressLalu },
      });
    }
  }

  const sarpras = await prisma.infrastructure.findMany({
    select: {
      id: true, progress: true,
      boqItems: {
        orderBy: { urutan: "asc" },
        select: { id: true, volume: true, hargaSatuan: true },
      },
    },
  });

  for (const s of sarpras) {
    if (s.boqItems.length === 0) continue;
    const total = s.boqItems.reduce((a, b) => a + b.volume * b.hargaSatuan, 0);
    if (total === 0) continue;

    const sasaran = total * (s.progress / 100);
    const sasaranLalu = total * (Math.max(0, s.progress - 7) / 100);

    let terkumpul = 0;
    for (const b of s.boqItems) {
      const nilai = b.volume * b.hargaSatuan;
      const isi = (batas: number) =>
        nilai ? Math.round(Math.max(0, Math.min(1, (batas - terkumpul) / nilai)) * 100) : 0;
      const progress = isi(sasaran);
      const progressLalu = isi(sasaranLalu);
      terkumpul += nilai;
      await prisma.infrastructureBoqItem.update({
        where: { id: b.id },
        data: { progress, progressLalu },
      });
    }
  }
}

/** Buat Document + DocumentVersion R1 dari metadata artifact. */
async function buatDokumen(kategori: string, dok: Dok | null | undefined): Promise<string | null> {
  if (!dok) return null;
  const d = await prisma.document.create({
    data: {
      kategori,
      judul: dok.file,
      versions: {
        create: {
          revisi: "R1",
          namaFile: dok.file,
          ukuranByte: parseUkuran(dok.size),
          diunggahPada: tgl(dok.tgl) ?? new Date(),
        },
      },
    },
  });
  return d.id;
}

async function main() {
  console.log("Menyemai data demo…\n");

  // --- bersihkan (urutan penting karena foreign key) ---
  await prisma.auditLog.deleteMany();
  await prisma.salesPayment.deleteMany();
  await prisma.expenseAllocation.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.operationalCost.deleteMany();
  await prisma.tenderParticipant.deleteMany();
  await prisma.tender.deleteMany();
  await prisma.variationOrder.deleteMany();
  await prisma.contractBoqItem.deleteMany();
  await prisma.contractUnit.deleteMany();
  await prisma.contractInfrastructure.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.progressRecord.deleteMany();
  await prisma.customWorkBoqItem.deleteMany();
  await prisma.customWorkRapItem.deleteMany();
  await prisma.customWork.deleteMany();
  await prisma.unitBoqItem.deleteMany();
  await prisma.unitRapItem.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.infrastructureBoqItem.deleteMany();
  await prisma.infrastructureRapItem.deleteMany();
  await prisma.infrastructure.deleteMany();
  await prisma.unitType.deleteMany();
  await prisma.phase.deleteMany();
  await prisma.bpHppItem.deleteMany();
  await prisma.bpOmzetItem.deleteMany();
  await prisma.bpOperasionalItem.deleteMany();
  await prisma.bpCashflowItem.deleteMany();
  await prisma.businessPlan.deleteMany();
  await prisma.marketComparableType.deleteMany();
  await prisma.marketComparable.deleteMany();
  await prisma.legality.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.userProjectAccess.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.roleSectionPermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
  await prisma.project.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();

  // ---------------------------------------------------------------------
  // 1. PERAN & HAK AKSES
  // ---------------------------------------------------------------------
  const roleId = new Map<string, string>();
  for (const nama of SEMUA_PERAN) {
    const r = await prisma.role.create({ data: { nama, grup: ROLE_GRUP[nama] } });
    roleId.set(nama, r.id);
  }

  let jmlIzin = 0;
  for (const [section, peranBoleh] of Object.entries(ACL_AWAL)) {
    for (const peran of peranBoleh) {
      const id = roleId.get(peran);
      if (!id) continue;
      await prisma.roleSectionPermission.create({
        data: { roleId: id, section, bolehUbah: (ACL_UBAH[section] ?? []).includes(peran) },
      });
      jmlIzin++;
    }
  }
  console.log(`  ${SEMUA_PERAN.length} peran, ${jmlIzin} baris izin`);

  // ---------------------------------------------------------------------
  // 2. PROYEK
  // ---------------------------------------------------------------------
  const projectId = new Map<string, string>();

  for (const P of PROYEK) {
    const analisaId = await buatDokumen("analisa", P.analisa);

    const p = await prisma.project.create({
      data: {
        kode: P.kode, nama: P.nama, status: P.status, statusLahan: P.statusLahan,
        alamat: P.lokasi.alamat, kelurahan: P.lokasi.kelurahan, kecamatan: P.lokasi.kecamatan,
        kota: P.lokasi.kota, provinsi: P.lokasi.provinsi, pinLat: P.lokasi.lat, pinLng: P.lokasi.lng,
        luasKavlingEfektif: P.luas.kavlingEfektif, luasSarana: P.luas.sarana,
        luasPrasarana: P.luas.prasarana, luasRth: P.luas.rth,
        hargaPerM2: P.biaya.hargaPerM2, biayaPembelian: P.biaya.pembelian,
        biayaNotaris: P.biaya.notaris, biayaBalikNama: P.biaya.balikNama, biayaLegalLain: P.biaya.legalLain,
        analisaDocId: analisaId,
      },
    });
    projectId.set(P.kode, p.id);

    for (const L of P.legalitas) {
      const dokId = await buatDokumen("legalitas", L.dok);
      await prisma.legality.create({
        data: { projectId: p.id, nib: L.nib, sertifikat: L.sertifikat, luas: L.luas, dokumenId: dokId },
      });
    }

    for (const M of P.market) {
      await prisma.marketComparable.create({
        data: {
          projectId: p.id, nama: M.nama, jarak: M.jarak,
          tipe: { create: M.tipe.map((t) => ({ tipe: t.tipe, jumlah: t.jml, luasUnit: t.luasUnit, luasLahan: t.luasLahan, harga: t.harga })) },
        },
      });
    }

    await prisma.businessPlan.create({
      data: {
        projectId: p.id,
        hpp: { create: P.bplan.hpp.map((h, i) => ({ nama: h.nama, nilai: h.v, urutan: i })) },
        omzet: { create: P.bplan.omzet.map((o, i) => ({ tipe: o.tipe, jumlah: o.jml, harga: o.harga, urutan: i })) },
        operasional: { create: P.bplan.operasional.map((o, i) => ({ nama: o.nama, nilai: o.v, urutan: i })) },
        cashflow: { create: P.bplan.cashflow.map((c, i) => ({ periode: c.periode, masuk: c.masuk, keluar: c.keluar, urutan: i })) },
      },
    });
  }
  console.log(`  ${PROYEK.length} proyek beserta legalitas, pembanding pasar & business plan`);

  // ---------------------------------------------------------------------
  // 3. FASE & TIPE UNIT
  // ---------------------------------------------------------------------
  const phaseId = new Map<string, string>();   // "NT4|F2" → id
  const typeId = new Map<string, string>();    // "NT4|TSL" → id

  for (const P of PROYEK) {
    const pid = projectId.get(P.kode)!;

    let urutan = 0;
    for (const kode of Object.keys(P.fases)) {
      const f = await prisma.phase.create({ data: { projectId: pid, kode, nama: `Fase ${kode.slice(1)}`, urutan: urutan++ } });
      phaseId.set(`${P.kode}|${kode}`, f.id);
    }

    for (const T of TIPE_UNIT[P.kode] ?? []) {
      const t = await prisma.unitType.create({
        data: {
          projectId: pid, kode: T.kode, nama: T.nama, luasBangunan: T.lb, luasTanah: T.lt,
          docModel3dId: await buatDokumen("model3d", T.docs.model3d),
          docGambarKerjaId: await buatDokumen("gambarKerja", T.docs.gambarKerja),
          docRenderId: await buatDokumen("render", T.docs.render),
          docSpekId: await buatDokumen("spek", T.docs.spek),
        },
      });
      typeId.set(`${P.kode}|${T.kode}`, t.id);
    }
  }
  console.log(`  ${phaseId.size} fase, ${typeId.size} tipe unit + dokumen teknis`);

  // ---------------------------------------------------------------------
  // 4. UNIT — dengan snapshot BOQ & RAP
  // ---------------------------------------------------------------------
  const unitId = new Map<string, string>();     // "NT4-F2-3" → id
  const realisasiUnit = new Map<string, number>();
  let jmlBoq = 0, jmlRap = 0;

  for (const P of PROYEK) {
    const pid = projectId.get(P.kode)!;
    const tipes = TIPE_UNIT[P.kode] ?? [];
    if (tipes.length === 0) continue;

    for (const [fase, n] of Object.entries(P.fases)) {
      // charCodeAt(1) = digit fase ('1'=49, '2'=50, …). Dipertahankan apa adanya
      // dari artifact supaya sebaran data demo persis sama.
      const kodeFase = fase.charCodeAt(1);

      for (let i = 1; i <= n; i++) {
        const kode = `${P.kode}-${fase}-${i}`;
        const T = tipes[(i + kodeFase) % tipes.length];

        let statusPembangunan = "Belum terbangun";
        let statusJual = "Tersedia";
        let progress = 0;

        if (P.status === "Selesai") {
          progress = 100;
          statusPembangunan = P.kode === "NT2" ? "Habis Masa Garansi" : "Serah Terima";
          statusJual = "Serah Terima";
        } else if (P.status === "Dalam Pembangunan") {
          progress = ((i * 17 + kodeFase * 9 + 23) % 78) + 15;
          statusPembangunan = progress >= 95 ? "Selesai" : "Progress";
          statusJual = i % 4 === 0 ? "Akad" : i % 7 === 0 ? "Booking" : "Tersedia";
        }

        const kt = KERJA_TAMBAH[kode];
        const nilaiTambah = kt ? kt.boq.reduce((s, b) => s + b.vol * b.harga, 0) : 0;
        const hargaJual = Math.round((rabAcuan(T.lb) + nilaiTambah) * 1.42);

        const boq = buatBoqDariTemplate(T.lb);
        const rap = buatRapDariTemplate(T.lb);

        const u = await prisma.unit.create({
          data: {
            kode, projectId: pid, phaseId: phaseId.get(`${P.kode}|${fase}`)!,
            unitTypeId: typeId.get(`${P.kode}|${T.kode}`)!, nomor: i,
            luasTanah: T.lt, statusPembangunan, statusJual, progress,
            hargaJual, rapUpah: hitungUpahRap(T.lb),
            boqItems: { create: boq },
            rapItems: { create: rap },
          },
        });
        unitId.set(kode, u.id);
        jmlBoq += boq.length;
        jmlRap += rap.length;

        // Kerja tambah
        if (kt) {
          // Kerja tambah yang belum punya rincian RAP sendiri diberi rincian
          // kasar dari nilainya, supaya tabel RAP-nya tidak kosong dan bisa
          // langsung disunting.
          const generik = kt.rap ? null : rapGenerik(Math.round(nilaiTambah * 0.9));

          await prisma.customWork.create({
            data: {
              unitId: u.id, judul: kt.judul,
              rapUpah: kt.rap?.upah ?? generik?.upah ?? 0,
              docDesainId: await buatDokumen("desain", kt.docs.desain),
              docModel3dId: await buatDokumen("model3d", kt.docs.model3d),
              docGambarKerjaId: await buatDokumen("gambarKerja", kt.docs.gambarKerja),
              boqItems: { create: kt.boq.map((b, k) => ({ uraian: b.uraian, satuan: b.sat, volume: b.vol, hargaSatuan: b.harga, spesifikasi: b.spek, urutan: k })) },
              rapItems: {
                create: kt.rap
                  ? kt.rap.groups.flatMap((g, gi) =>
                      g.items.map((it, ii) => ({
                        grup: g.nama, nama: it.nama, satuan: it.sat, volume: it.vol,
                        hargaSatuan: it.harga, keterangan: it.ket ?? null, urutan: gi * 100 + ii,
                      })),
                    )
                  : generik!.items,
              },
            },
          });
        }

        // Realisasi biaya — faktor deterministik seperti artifact
        const anggaran = rapAcuan(T.lb) + Math.round(nilaiTambah * 0.9);
        const faktor = 0.92 + ((i * 13 + kodeFase) % 24) / 100;
        realisasiUnit.set(kode, Math.round(anggaran * (progress / 100) * faktor));

        // Catatan progres: dua titik (minggu lalu & sekarang) supaya opname
        // mingguan punya pembanding yang nyata, bukan tebakan "progres − 7".
        if (progress > 0) {
          const kini = new Date("2026-07-20T00:00:00Z");
          const lalu = new Date(kini.getTime() - 7 * 864e5);
          await prisma.progressRecord.createMany({
            data: [
              { unitId: u.id, tanggal: lalu, progress: Math.max(0, progress - 7), catatan: "Opname mingguan" },
              { unitId: u.id, tanggal: kini, progress, catatan: "Opname mingguan" },
            ],
          });
        }

        // Penerimaan penjualan
        const terjual = statusJual === "Akad" || statusJual === "Serah Terima";
        if (terjual) {
          const porsi = statusJual === "Serah Terima" ? 1 : 0.4 + ((i * 11) % 45) / 100;
          await prisma.salesPayment.create({
            data: {
              unitId: u.id, tanggal: new Date("2026-06-15T00:00:00Z"),
              uraian: statusJual === "Serah Terima" ? "Pelunasan & serah terima" : "Pencairan KPR / akad",
              nominal: Math.round(hargaJual * porsi),
            },
          });
        }
      }
    }
  }
  console.log(`  ${unitId.size} unit, ${jmlBoq} baris BOQ + ${jmlRap} baris RAP (snapshot)`);

  // ---------------------------------------------------------------------
  // 5. SARANA & PRASARANA
  // ---------------------------------------------------------------------
  const infraId = new Map<string, string>();
  for (const [kodeProyek, list] of Object.entries(SARPRAS)) {
    const pid = projectId.get(kodeProyek);
    if (!pid) continue;
    for (const S of list) {
      // RAP sarpras ditaksir 90% dari RAB, lalu dipecah jadi rincian kasar —
      // sama seperti artifact. Sesudah tersimpan, rinciannya bisa disunting.
      const rap = rapGenerik(Math.round(S.rab * 0.9));

      const s = await prisma.infrastructure.create({
        data: {
          kode: S.id, projectId: pid, nama: S.nama, jenis: S.jenis, volume: S.vol,
          status: S.status, progress: S.progress, rab: S.rab, rapUpah: rap.upah,
          docModel3dId: await buatDokumen("model3d", S.docs.model3d),
          docGambarKerjaId: await buatDokumen("gambarKerja", S.docs.gambarKerja),
          boqItems: { create: boqSarprasDefault(S.nama, S.jenis, S.rab) },
          rapItems: { create: rap.items },
        },
      });
      infraId.set(S.id, s.id);
    }
  }
  console.log(`  ${infraId.size} item sarana & prasarana`);

  // ---------------------------------------------------------------------
  // 6. VENDOR, KONTRAK, TENDER
  // ---------------------------------------------------------------------
  const vendorId = new Map<string, string>();
  for (const V of VENDOR) {
    const v = await prisma.vendor.create({ data: V });
    vendorId.set(V.nama, v.id);
  }

  for (const K of KONTRAK) {
    const c = await prisma.contract.create({
      data: {
        kode: K.kode, projectId: projectId.get(K.proyek)!, vendorId: vendorId.get(K.vendor)!,
        jenis: K.jenis, deskripsi: K.deskripsi, nominal: K.nominal,
        retensiPct: K.retensiPct, jatuhTempoBln: K.jatuhTempoBln, mulai: tgl(K.mulai)!,
        variationOrders: { create: (K.vo ?? []).map((v) => ({ nomor: v.no, tanggal: tgl(v.tgl)!, uraian: v.uraian, nominal: v.nominal, status: v.status })) },
      },
    });

    for (const kodeUnit of (K as { units?: string[] }).units ?? []) {
      const uid = unitId.get(kodeUnit);
      if (!uid) continue;
      await prisma.contractUnit.create({
        data: { contractId: c.id, unitId: uid, nilaiOverride: K.override?.[kodeUnit] ?? null },
      });
    }
    for (const kodeSar of (K as { sarpras?: string[] }).sarpras ?? []) {
      const sid = infraId.get(kodeSar);
      if (!sid) continue;
      await prisma.contractInfrastructure.create({ data: { contractId: c.id, infrastructureId: sid } });
    }

    // Pembayaran vendor disimpan sebagai PENGELUARAN yang menunjuk kontrak,
    // bukan tabel tersendiri — satu uang, satu catatan. Pembebanannya dibagi
    // menurut porsi tiap unit/sarpras dalam kontrak, memakai pembagian yang
    // sama dengan yang dipakai halaman Keuangan.
    const cakupanUnit = await prisma.contractUnit.findMany({
      where: { contractId: c.id },
      select: { unitId: true, nilaiOverride: true },
    });
    const cakupanSarpras = await prisma.contractInfrastructure.findMany({
      where: { contractId: c.id },
      select: { infrastructureId: true, nilaiOverride: true },
    });

    for (const r of K.riwayat) {
      const porsi =
        K.jenis === "Unit"
          ? alokasiPembayaran(r.nominal, K.nominal, cakupanUnit).map((a) => ({
              unitId: a.unitId, infrastructureId: null, nominal: a.alokasi,
            }))
          : alokasiPembayaran(r.nominal, K.nominal, cakupanSarpras).map((a) => ({
              unitId: null, infrastructureId: a.infrastructureId, nominal: a.alokasi,
            }));
      if (porsi.length === 0) continue;

      await prisma.expense.create({
        data: {
          projectId: projectId.get(K.proyek)!,
          contractId: c.id,
          tanggal: tgl(r.tgl)!,
          peruntukan: K.jenis === "Unit" ? "Unit (rumah dijual)" : "Sarana & Prasarana",
          jenis: "Upah Borongan",
          metode: "Transfer",
          uraian: `${r.uraian} — ${K.kode} ${K.vendor}`,
          total: r.nominal,
          status: "Lunas",
          pic: "Sistem",
          alokasi: { create: porsi },
        },
      });
    }

    await isiBoqSpk(c.id, K);
  }

  for (const T of TENDER) {
    await prisma.tender.create({
      data: {
        kode: T.kode, projectId: projectId.get(T.proyek)!, pekerjaan: T.pekerjaan,
        tanggal: tgl(T.tgl)!, hps: T.hps, status: T.status,
        pemenangVendorId: T.pemenang ? vendorId.get(T.pemenang) ?? null : null,
        peserta: { create: T.peserta.map((p) => ({ vendorId: vendorId.get(p.vendor)!, nilai: p.nilai, dokumen: p.dok })) },
      },
    });
  }
  console.log(`  ${VENDOR.length} vendor, ${KONTRAK.length} kontrak, ${TENDER.length} tender`);

  // ---------------------------------------------------------------------
  // 7. EQUIPMENT
  // ---------------------------------------------------------------------
  for (const A of ASET) {
    await prisma.equipment.create({
      data: {
        kode: A.kode, nama: A.nama, kategori: A.kategori, merk: A.merk,
        jumlah: A.jumlah, satuan: A.satuan, kepemilikan: A.milik,
        vendorId: A.vendor ? vendorId.get(A.vendor) ?? null : null,
        projectId: projectId.get(A.lokasi) ?? null,
        penanggungJawab: A.pj, status: A.status,
        satuanPakai: A.satuanPakai, pemakaian: A.pakai,
        servisTerakhir: tgl(A.servisAkhir), servisBerikut: tgl(A.servisBerikut),
        nilai: A.nilai,
      },
    });
  }
  console.log(`  ${ASET.length} peralatan & aset`);

  // ---------------------------------------------------------------------
  // 8. BIAYA OPERASIONAL
  // ---------------------------------------------------------------------
  let jmlBiaya = 0;

  // Kontrak ditautkan lewat nama vendornya, seperti pada artifact.
  const kontrakPerVendor = new Map(
    (
      await prisma.contract.findMany({
        select: { id: true, projectId: true, vendor: { select: { nama: true } } },
      })
    ).map((k) => [`${k.projectId}|${k.vendor.nama}`, k.id]),
  );

  for (const B of BIAYA_UMUM) {
    const pid = projectId.get(B.proyek)!;
    // Biaya yang menyebut nomor unit ditautkan ke unitnya, supaya rincian
    // per unit di modul Keuangan tidak perlu menebak dari teks uraian.
    const unitIdTerkait = B.unit ? unitId.get(`${B.proyek}-${B.fase}-${B.unit}`) ?? null : null;

    await prisma.expense.create({
      data: {
        projectId: pid, tanggal: tgl(B.tgl)!,
        peruntukan: B.peruntukan, jenis: B.jenis, metode: B.metode,
        uraian: B.uraian, total: B.total, status: B.status,
        pic: B.pic, bukti: B.bukti || null,
        posHpp: POS_HPP[B.peruntukan],
        contractId: B.kontrak ? kontrakPerVendor.get(`${pid}|${B.kontrak}`) ?? null : null,
        // Satu pembayaran = satu baris; pembebanannya ada di alokasi.
        alokasi: { create: [{ unitId: unitIdTerkait, nominal: B.total }] },
      },
    });
    jmlBiaya++;
  }

  // Biaya yang menempel pada unit, diturunkan dari realisasinya
  for (const [kodeUnit, realisasi] of realisasiUnit) {
    if (realisasi <= 0) continue;
    const uid = unitId.get(kodeUnit)!;
    const kodeProyek = kodeUnit.split("-")[0];
    const nomor = Number(kodeUnit.split("-")[2]);

    for (const [jenis, porsi, metode, uraianList] of PORSI_BIAYA_UNIT) {
      const totalJenis = Math.round(realisasi * porsi);
      if (totalJenis < 100_000) continue;

      for (const [k, uraian] of uraianList.entries()) {
        const hari = ((nomor * 7 + k * 11) % 28) + 1;
        await prisma.expense.create({
          data: {
            projectId: projectId.get(kodeProyek)!,
            tanggal: new Date(Date.UTC(2026, (nomor + k) % 7, hari)),
            peruntukan: "Unit (rumah dijual)", jenis, metode, uraian,
            total: Math.round(totalJenis / uraianList.length),
            status: "Lunas", posHpp: POS_HPP["Unit (rumah dijual)"],
            alokasi: {
              create: [{ unitId: uid, nominal: Math.round(totalJenis / uraianList.length) }],
            },
          },
        });
        jmlBiaya++;
      }
    }
  }
  // Biaya yang menempel pada item sarana & prasarana. Realisasinya diturunkan
  // dari progres pekerjaan terhadap RAP-nya — bukan angka acak — supaya sejalan
  // dengan progres yang tampil di modul Konstruksi.
  for (const P of PROYEK) {
    for (const S of SARPRAS[P.kode] ?? []) {
      const iid = infraId.get(S.id);
      if (!iid || S.progress <= 0) continue;

      // RAP sarpras disemai 90% dari RAB, sama seperti saat itemnya dibuat.
      const realisasi = Math.round(S.rab * 0.9 * (S.progress / 100));
      const nomor = Number(S.id.split("-S")[1] ?? "1");

      for (const [jenis, porsi, metode, uraianList] of PORSI_BIAYA_SARPRAS) {
        const totalJenis = Math.round(realisasi * porsi);
        if (totalJenis < 100_000) continue;

        for (const [k, uraian] of uraianList.entries()) {
          const hari = ((nomor * 5 + k * 9) % 28) + 1;
          await prisma.expense.create({
            data: {
              projectId: projectId.get(P.kode)!,
              tanggal: new Date(Date.UTC(2026, (nomor + k) % 7, hari)),
              peruntukan: "Prasarana & Sarana", jenis, metode,
              uraian: `${uraian} · ${S.nama}`,
              total: Math.round(totalJenis / uraianList.length),
              status: "Lunas", posHpp: POS_HPP["Prasarana & Sarana"],
              alokasi: {
                create: [{
                  infrastructureId: iid,
                  nominal: Math.round(totalJenis / uraianList.length),
                }],
              },
            },
          });
          jmlBiaya++;
        }
      }
    }
  }

  for (const B of BIAYA_OPERASIONAL) {
    await prisma.operationalCost.create({
      data: {
        projectId: projectId.get(B.proyek)!, tanggal: tgl(B.tgl)!,
        kategori: B.kategori, uraian: B.uraian, nominal: B.nominal,
        status: B.status, pic: B.pic,
      },
    });
  }

  console.log(`  ${jmlBiaya} transaksi biaya, ${BIAYA_OPERASIONAL.length} biaya operasional`);

  // ---------------------------------------------------------------------
  // 9. PENGGUNA
  // ---------------------------------------------------------------------
  const passwordHash = await hashPassword(PASSWORD_DEMO);
  const userId = new Map<string, string>();

  for (const U of USERS) {
    const u = await prisma.user.create({
      data: {
        nama: U.nama, inisial: U.inisial, email: emailDari(U.nama),
        passwordHash, semuaProyek: U.semua,
        roles: { create: U.peran.filter((p) => roleId.has(p)).map((p) => ({ roleId: roleId.get(p)! })) },
        aksesProyek: {
          create: U.proyek.filter((k) => projectId.has(k)).map((k) => ({ projectId: projectId.get(k)! })),
        },
      },
    });
    userId.set(U.nama, u.id);
  }
  console.log(`  ${USERS.length} pengguna`);

  // ---------------------------------------------------------------------
  // 10. LOG PERUBAHAN
  // ---------------------------------------------------------------------
  for (const L of LOG_AWAL) {
    const [tanggalTeks, jam] = [L.waktu.slice(0, 11), L.waktu.slice(12)];
    const d = tgl(tanggalTeks);
    if (d && jam) {
      const [h, m] = jam.split(":").map(Number);
      d.setUTCHours(h, m);
    }
    await prisma.auditLog.create({
      data: {
        waktu: d ?? new Date(), userId: userId.get(L.oleh) ?? null, peran: L.peran,
        projectId: projectId.get(L.proyek) ?? null,
        objek: L.objek, aksi: L.aksi, nilaiDari: L.dari, nilaiKe: L.ke,
      },
    });
  }
  console.log(`  ${LOG_AWAL.length} entri log perubahan`);

  // ---------------------------------------------------------------------
  // Ringkasan
  // ---------------------------------------------------------------------
  const totalRab = await prisma.unitBoqItem.findMany({ select: { volume: true, hargaSatuan: true } });
  await isiProgresBoqMaster();

  console.log("\nSelesai.");
  console.log(`  Total RAB seluruh unit : Rp ${Math.round(totalBaris(totalRab)).toLocaleString("id-ID")}`);
  console.log(`\n  Login demo — password semua akun: ${PASSWORD_DEMO}`);
  for (const U of USERS.slice(0, 4)) {
    console.log(`    ${emailDari(U.nama).padEnd(30)} ${U.peran.join(", ")}`);
  }
  console.log(`    … dan ${USERS.length - 4} akun lain.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
