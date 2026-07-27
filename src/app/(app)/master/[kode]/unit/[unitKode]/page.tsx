import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehAksesProyek, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { Badge, CardHead, InfoRow, Terbatas, WARNA_STATUS } from "@/components/ui";
import { FileRow } from "@/components/file-row";
import { unggahRevisi } from "../../../actions";
import { KontrakBacaSaja } from "@/components/kontrak-baca-saja";
import { rp } from "@/lib/format";
import {
  EditDeskripsiUnit, HapusKerjaTambah, TabelBoqKt, TabelBoqUnit,
  TabelRapKt, TabelRapUnit, TambahKerjaTambah, UbahJudulKerjaTambah,
} from "./editors";

const pilihVersi = {
  select: { id: true, revisi: true, namaFile: true, ukuranByte: true, objectKey: true, diunggahPada: true },
  orderBy: { diunggahPada: "desc" as const },
};
const pilihDokumen = { select: { id: true, kategori: true, versions: pilihVersi } };

export default async function RincianUnit({
  params,
}: {
  params: Promise<{ kode: string; unitKode: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode, unitKode } = await params;
  const kodeProyek = kode.toUpperCase();

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const ubahHarga = bolehUbah(pengguna, "hargaRabRap");
  const ubahData = bolehUbah(pengguna, "daftarUnit");
  const ubahProgres = bolehUbah(pengguna, "progress");

  const ubahTeknis = bolehUbah(pengguna, "dokumenTeknis");
  const bolehDokumen = bolehLihat(pengguna, "dokumenTeknis");

  const unit = await prisma.unit.findUnique({
    where: { kode: decodeURIComponent(unitKode).toUpperCase() },
    select: {
      id: true, kode: true, nomor: true, luasTanah: true, projectId: true,
      phaseId: true, unitTypeId: true,
      statusPembangunan: true, statusJual: true, progress: true,
      // Jumlah baris BOQ SPK menentukan apakah progres unit ini turunan
      // dari opname atau masih diisi manual.
      _count: { select: { boqSpk: true } },
      phase: { select: { kode: true } },
      project: {
        select: {
          kode: true, nama: true,
          fases: { select: { id: true, kode: true }, orderBy: { urutan: "asc" } },
          unitTypes: {
            select: { id: true, nama: true, luasBangunan: true },
            orderBy: { luasBangunan: "asc" },
          },
        },
      },
      unitType: {
        select: {
          kode: true, nama: true, luasBangunan: true,
          docModel3d: pilihDokumen,
          docGambarKerja: pilihDokumen,
          docRender: pilihDokumen,
          docSpek: pilihDokumen,
        },
      },
      ...(bolehHarga
        ? {
            hargaJual: true,
            rapUpah: true,
            boqItems: {
              orderBy: { urutan: "asc" as const },
              select: {
                id: true, grup: true, uraian: true, satuan: true,
                volume: true, hargaSatuan: true, spesifikasi: true,
              },
            },
            rapItems: {
              orderBy: { urutan: "asc" as const },
              select: {
                id: true, grup: true, nama: true, satuan: true,
                volume: true, hargaSatuan: true, keterangan: true,
              },
            },
          }
        : {}),
      customWorks: {
        orderBy: { judul: "asc" as const },
        select: {
          id: true, judul: true, rapUpah: true,
          docDesain: pilihDokumen,
          docModel3d: pilihDokumen,
          docGambarKerja: pilihDokumen,
          boqItems: {
            orderBy: { urutan: "asc" as const },
            select: {
              id: true, uraian: true, satuan: true, volume: true,
              hargaSatuan: true, spesifikasi: true,
            },
          },
          rapItems: {
            orderBy: { urutan: "asc" as const },
            select: {
              id: true, grup: true, nama: true, satuan: true,
              volume: true, hargaSatuan: true, keterangan: true,
            },
          },
        },
      },
    },
  });

  if (!unit || unit.project.kode !== kodeProyek) notFound();
  if (!bolehAksesProyek(pengguna, unit.projectId)) notFound();

  // Progres unit hanya punya satu sumber. Bila unit ini sudah dirinci lewat
  // BOQ SPK, angkanya turunan dari opname dan isian manualnya ditiadakan —
  // sama seperti di halaman Konstruksi.
  const dariSpk = unit._count.boqSpk > 0;

  const kontrak = await prisma.contract.findMany({
    where: { units: { some: { unitId: unit.id } } },
    select: {
      id: true, nominal: true, retensiPct: true, deskripsi: true,
      vendor: { select: { nama: true } },
      pembayaran: { select: { nominal: true } },
      variationOrders: { select: { nominal: true, status: true } },
    },
  });

  const label = `${unit.phase.kode}-${unit.nomor}`;
  const kts = unit.customWorks;
  const konteksImpor = `Unit ${unit.nomor} · ${unit.unitType.nama}`;

  const boqItems = "boqItems" in unit ? unit.boqItems : [];
  const rapItems = "rapItems" in unit ? unit.rapItems : [];
  const rapUpah = "rapUpah" in unit ? unit.rapUpah : 0;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
        <Link href="/master" style={{ color: "inherit", textDecoration: "none" }}>Master Proyek</Link>
        {" / "}
        <Link href={`/master/${kodeProyek}`} style={{ color: "inherit", textDecoration: "none" }}>
          {unit.project.nama}
        </Link>
        {" / "}
        <b style={{ color: "var(--text)" }}>Unit {unit.nomor}</b>
      </div>

      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          flexWrap: "wrap", gap: 12, marginBottom: 16,
        }}
      >
        <div>
          <div className="eyebrow">Detail Data Unit · database per unit</div>
          <h3 className="disp" style={{ margin: "4px 0 0", fontSize: 19 }}>
            {unit.project.nama} — Unit {unit.nomor}
          </h3>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Badge nilai={unit.statusPembangunan} peta={WARNA_STATUS.bangun} />
          <Badge nilai={unit.statusJual} peta={WARNA_STATUS.jual} />
        </div>
      </div>

      {/* ---------- baris 1: Deskripsi | Dokumen ---------- */}
      <div className="grid grid2">
        <div className="card" style={{ padding: "16px 20px" }}>
          <CardHead
            judul="Deskripsi Unit"
            aksi={
              (ubahProgres || ubahData) && (
                <EditDeskripsiUnit
                  unit={{
                    id: unit.id, nomor: unit.nomor, luasTanah: unit.luasTanah,
                    phaseId: unit.phaseId, unitTypeId: unit.unitTypeId,
                    statusPembangunan: unit.statusPembangunan,
                    statusJual: unit.statusJual, progress: unit.progress,
                    dariSpk,
                  }}
                  fases={unit.project.fases}
                  tipes={unit.project.unitTypes}
                />
              )
            }
          />
          <InfoRow label="Kode Unit" nilai={unit.kode} />
          <InfoRow label="Fase" nilai={unit.phase.kode} />
          <InfoRow label="Tipe" nilai={unit.unitType.nama} />
          <InfoRow label="Luas Bangunan" nilai={`${unit.unitType.luasBangunan} m²`} />
          <InfoRow label="Luas Tanah" nilai={`${unit.luasTanah} m²`} />
          <InfoRow
            label="Progres"
            nilai={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {unit.progress}%
                <span style={{ fontSize: 10.5, fontWeight: 400, color: "var(--muted)" }}>
                  {dariSpk ? "dari opname SPK" : "sama dengan Konstruksi"}
                </span>
              </span>
            }
          />
          <InfoRow
            label="Status Bangun"
            nilai={<Badge nilai={unit.statusPembangunan} peta={WARNA_STATUS.bangun} />}
          />
          <InfoRow
            label="Status Jual"
            nilai={<Badge nilai={unit.statusJual} peta={WARNA_STATUS.jual} />}
          />
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Dokumen Unit</div>
          {!bolehDokumen ? (
            <Terbatas apa="Dokumen teknis" />
          ) : (
            <>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>
                Diturunkan dari Tipe Unit {unit.unitType.nama} · unggah revisi menyimpan versi lama.
              </div>
              {(
                [
                  ["3D Model", unit.unitType.docModel3d, "model3d"],
                  ["Gambar Kerja", unit.unitType.docGambarKerja, "gambarKerja"],
                  ["Render", unit.unitType.docRender, "render"],
                  ["Spesifikasi Material", unit.unitType.docSpek, "spek"],
                ] as const
              ).map(([judul, dok, kategori]) => (
                <FileRow
                  key={kategori}
                  label={judul}
                  dokumen={dok ? { id: dok.id, kategori: dok.kategori, versi: dok.versions } : null}
                  bolehUbah={ubahTeknis}
                  konteks={`${judul} · Tipe ${unit.unitType.nama}`}
                  pemilik={{ jenis: "tipeUnit", id: unit.unitTypeId, kategori }}
                  aksiUnggah={unggahRevisi}
                />
              ))}

              {kts.map((kt) => (
                <div key={kt.id}>
                  <div className="eyebrow" style={{ margin: "14px 0 4px" }}>Dokumen Kerja Tambah</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{kt.judul}</div>
                  {(
                    [
                      ["Desain (disetujui)", kt.docDesain, "desain"],
                      ["3D Model", kt.docModel3d, "model3d"],
                      ["Gambar Kerja", kt.docGambarKerja, "gambarKerja"],
                    ] as const
                  ).map(([judul, dok, kategori]) => (
                    <FileRow
                      key={kategori}
                      label={judul}
                      dokumen={dok ? { id: dok.id, kategori: dok.kategori, versi: dok.versions } : null}
                      bolehUbah={ubahTeknis}
                      konteks={`${judul} · ${kt.judul}`}
                      pemilik={{ jenis: "kerjaTambah", id: kt.id, kategori }}
                      aksiUnggah={unggahRevisi}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ---------- baris 2: Konfigurasi | Kontrak ---------- */}
      <div className="grid grid2" style={{ marginTop: 16 }}>
        <div className="card" style={{ padding: "16px 20px" }}>
          <div
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 8, gap: 8,
            }}
          >
            <div className="eyebrow">Konfigurasi Unit</div>
            {kts.length > 0 ? (
              <span className="chip" style={{ background: "var(--rona-amber)", color: "var(--amber)" }}>
                Custom · {kts.length} kerja tambah
              </span>
            ) : (
              <span className="chip" style={{ background: "var(--rona-abu)", color: "var(--muted)" }}>
                Default
              </span>
            )}
          </div>

          {kts.length === 0 && (
            <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 10 }}>
              Unit Default memakai BOQ, RAB, dan RAP tipe standar tanpa tambahan.
            </div>
          )}

          {kts.map((kt) => (
            <div
              key={kt.id}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                gap: 8, padding: "7px 0", borderBottom: "1px solid var(--garis-halus)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{kt.judul}</div>
                {bolehHarga && (
                  <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                    {rp(kt.boqItems.reduce((s, b) => s + b.volume * b.hargaSatuan, 0))}
                  </div>
                )}
              </div>
              {ubahData && (
                <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                  <UbahJudulKerjaTambah id={kt.id} judul={kt.judul} />
                  <HapusKerjaTambah id={kt.id} judul={kt.judul} />
                </div>
              )}
            </div>
          ))}

          {ubahData && (
            <div style={{ marginTop: 10 }}>
              <TambahKerjaTambah unitId={unit.id} />
            </div>
          )}
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <KontrakBacaSaja
            daftar={kontrak}
            bolehHarga={bolehHarga}
            kosong="Unit ini belum tercakup kontrak vendor mana pun."
          />
        </div>
      </div>

      {/* ---------- RAB & RAP unit ---------- */}
      {!bolehHarga ? (
        <div style={{ marginTop: 16 }}>
          <Terbatas apa="Tabel RAB dan RAP unit" />
        </div>
      ) : (
        <>
          <TabelBoqUnit
            unitId={unit.id}
            judul={`Tabel RAB Unit · dasar Tipe ${unit.unitType.nama}`}
            baris={boqItems}
            bolehHarga={bolehHarga}
            bolehUbah={ubahHarga}
            konteks={konteksImpor}
          />

          <TabelRapUnit
            unitId={unit.id}
            baris={rapItems}
            upah={rapUpah}
            bolehHarga={bolehHarga}
            bolehUbah={ubahHarga}
            konteks={konteksImpor}
            keterangan={`Rencana Anggaran Pelaksana — Tipe ${unit.unitType.nama} (LB ${unit.unitType.luasBangunan} m²)`}
          />

          {kts.map((kt) => (
            <div key={kt.id} style={{ marginTop: 20, paddingTop: 16, borderTop: "2px solid var(--line)" }}>
              <TabelBoqKt
                ktId={kt.id}
                judul={kt.judul}
                baris={kt.boqItems}
                bolehHarga={bolehHarga}
                bolehUbah={ubahHarga}
                konteks={`Unit ${unit.nomor} · ${kt.judul}`}
              />
              <TabelRapKt
                ktId={kt.id}
                judul={kt.judul}
                baris={kt.rapItems}
                upah={kt.rapUpah}
                bolehHarga={bolehHarga}
                bolehUbah={ubahHarga}
                konteks={`Unit ${unit.nomor} · ${kt.judul}`}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
