import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehAksesProyek, bolehLihat, bolehUbah, filterProyek } from "@/lib/auth/rbac";
import { Badge, CardHead, InfoRow, Terbatas, WARNA_STATUS } from "@/components/ui";
import { FileRow } from "@/components/file-row";
import { unggahRevisi } from "../../../actions";
import { KontrakBacaSaja } from "@/components/kontrak-baca-saja";
import { rp, tanggalJam } from "@/lib/format";
import { EditDeskripsiSarpras, TabelBoqSarpras, TabelRapSarpras } from "./editors";

const pilihVersi = {
  select: { id: true, revisi: true, namaFile: true, ukuranByte: true, objectKey: true, diunggahPada: true },
  orderBy: { diunggahPada: "desc" as const },
};
const pilihDokumen = { select: { id: true, kategori: true, versions: pilihVersi } };

export default async function RincianSarpras({
  params,
}: {
  params: Promise<{ kode: string; kodeSarpras: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode, kodeSarpras } = await params;
  const kodeProyek = kode.toUpperCase();

  if (!bolehLihat(pengguna, "daftarSarpras")) {
    return (
      <div style={{ padding: 24 }}>
        <Link href={`/master/${kodeProyek}`} style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
          ← {kodeProyek}
        </Link>
        <div style={{ marginTop: 16 }}>
          <Terbatas apa="Detail sarana & prasarana" />
        </div>
      </div>
    );
  }

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const ubahHarga = bolehUbah(pengguna, "hargaRabRap");
  const ubahSarpras = bolehUbah(pengguna, "daftarSarpras");
  const ubahTeknis = bolehUbah(pengguna, "dokumenTeknis");
  const bolehDokumen = bolehLihat(pengguna, "dokumenTeknis");

  const item = await prisma.infrastructure.findUnique({
    where: { kode: decodeURIComponent(kodeSarpras).toUpperCase() },
    select: {
      id: true, kode: true, nama: true, jenis: true, volume: true,
      status: true, progress: true, projectId: true,
      project: { select: { kode: true, nama: true } },
      docModel3d: pilihDokumen,
      docGambarKerja: pilihDokumen,
      ...(bolehHarga
        ? {
            rab: true,
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
    },
  });

  if (!item || item.project.kode !== kodeProyek) notFound();
  if (!bolehAksesProyek(pengguna, item.projectId)) notFound();

  const kontrak = await prisma.contract.findMany({
    where: { infrastructures: { some: { infrastructureId: item.id } } },
    select: {
      id: true, nominal: true, retensiPct: true, deskripsi: true,
      vendor: { select: { nama: true } },
      expenses: { select: { total: true } },
      variationOrders: { select: { nominal: true, status: true } },
    },
  });

  // Riwayat perubahan item ini. Dibatasi ke proyek yang boleh diakses pengguna,
  // supaya log tidak menjadi celah untuk mengintip proyek lain.
  const riwayat = await prisma.auditLog.findMany({
    where: {
      project: filterProyek(pengguna),
      projectId: item.projectId,
      objek: { contains: item.nama },
    },
    orderBy: { waktu: "desc" },
    take: 8,
    select: {
      id: true, waktu: true, aksi: true, objek: true,
      nilaiDari: true, nilaiKe: true, peran: true,
      user: { select: { nama: true } },
    },
  });

  const boqItems = "boqItems" in item ? item.boqItems : [];
  const rapItems = "rapItems" in item ? item.rapItems : [];
  const rapUpah = "rapUpah" in item ? item.rapUpah : 0;

  const rab = boqItems.reduce((s, b) => s + b.volume * b.hargaSatuan, 0);
  const rapMaterial = rapItems.reduce((s, r) => s + r.volume * r.hargaSatuan, 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
        <Link href="/master" style={{ color: "inherit", textDecoration: "none" }}>Master Proyek</Link>
        {" / "}
        <Link href={`/master/${kodeProyek}`} style={{ color: "inherit", textDecoration: "none" }}>
          {item.project.nama}
        </Link>
        {" / "}
        <b style={{ color: "var(--text)" }}>{item.nama}</b>
      </div>

      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          flexWrap: "wrap", gap: 12, marginBottom: 16,
        }}
      >
        <div>
          <div className="eyebrow">Detail Data Sarana &amp; Prasarana</div>
          <h3 className="disp" style={{ margin: "4px 0 0", fontSize: 19 }}>{item.nama}</h3>
        </div>
        <Badge nilai={item.status} peta={WARNA_STATUS.bangun} />
      </div>

      {/* ---------- baris 1: Deskripsi | Dokumen ---------- */}
      <div className="grid grid2">
        <div className="card" style={{ padding: "16px 20px" }}>
          <CardHead
            judul="Deskripsi"
            aksi={
              ubahSarpras && (
                <EditDeskripsiSarpras
                  kodeProyek={kodeProyek}
                  data={{
                    id: item.id, nama: item.nama, jenis: item.jenis,
                    volume: item.volume, status: item.status, progress: item.progress,
                  }}
                />
              )
            }
          />
          <InfoRow label="Kode" nilai={item.kode} />
          <InfoRow label="Nama Item" nilai={item.nama} />
          <InfoRow label="Jenis" nilai={item.jenis} />
          <InfoRow label="Volume" nilai={item.volume} />
          <InfoRow label="Status Bangun" nilai={<Badge nilai={item.status} peta={WARNA_STATUS.bangun} />} />
          <InfoRow label="Progres" nilai={`${item.progress}%`} />
          {bolehHarga && <InfoRow label="RAB" nilai={rp(rab)} />}
          {bolehHarga && <InfoRow label="RAP" nilai={rp(rapMaterial + rapUpah)} />}
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Dokumen</div>
          {!bolehDokumen ? (
            <Terbatas apa="Dokumen teknis" />
          ) : (
            (
              [
                ["3D Model", item.docModel3d, "model3d"],
                ["Gambar Kerja", item.docGambarKerja, "gambarKerja"],
              ] as const
            ).map(([judul, dok, kategori]) => (
              <FileRow
                key={kategori}
                label={judul}
                dokumen={dok ? { id: dok.id, kategori: dok.kategori, versi: dok.versions } : null}
                bolehUbah={ubahTeknis}
                konteks={`${judul} · ${item.nama}`}
                pemilik={{ jenis: "sarpras", id: item.id, kategori }}
                aksiUnggah={unggahRevisi}
              />
            ))
          )}
        </div>
      </div>

      {/* ---------- kontrak ---------- */}
      <div className="card" style={{ padding: "16px 20px", marginTop: 16 }}>
        <KontrakBacaSaja
          daftar={kontrak}
          bolehHarga={bolehHarga}
          kosong="Belum ada kontrak vendor untuk item ini."
        />
      </div>

      {/* ---------- BOQ & RAP ---------- */}
      {!bolehHarga ? (
        <div style={{ marginTop: 16 }}>
          <Terbatas apa="Tabel BOQ dan RAP" />
        </div>
      ) : (
        <>
          <TabelBoqSarpras
            id={item.id}
            baris={boqItems}
            bolehHarga={bolehHarga}
            bolehUbah={ubahHarga}
            konteks={item.nama}
          />
          <TabelRapSarpras
            id={item.id}
            nama={item.nama}
            baris={rapItems}
            upah={rapUpah}
            bolehHarga={bolehHarga}
            bolehUbah={ubahHarga}
            konteks={item.nama}
          />
        </>
      )}

      {/* ---------- riwayat perubahan ---------- */}
      <div className="card" style={{ marginTop: 16, padding: "16px 20px" }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Riwayat Perubahan</div>
        {riwayat.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Belum ada perubahan tercatat untuk item ini.
          </div>
        ) : (
          riwayat.map((e) => (
            <div
              key={e.id}
              style={{
                display: "grid", gridTemplateColumns: "150px 1fr", gap: 10,
                padding: "7px 0", borderBottom: "1px solid var(--garis-halus)", fontSize: 12,
              }}
            >
              <div style={{ color: "var(--muted)" }}>{tanggalJam(e.waktu)}</div>
              <div>
                <b>{e.aksi}</b> · {e.objek}
                <div style={{ color: "var(--muted)", marginTop: 2 }}>
                  {e.nilaiDari != null ? (
                    <>
                      <span style={{ textDecoration: "line-through" }}>{e.nilaiDari}</span>
                      {" → "}
                      <b style={{ color: "var(--text)" }}>{e.nilaiKe}</b>
                    </>
                  ) : (
                    e.nilaiKe
                  )}
                  {" · oleh "}
                  {e.user?.nama ?? "—"} ({e.peran})
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
