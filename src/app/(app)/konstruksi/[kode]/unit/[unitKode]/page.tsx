import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehAksesProyek, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { duaTitikProgres } from "@/lib/data/konstruksi";
import { susunOpname } from "@/lib/calc/opname";
import { Badge, Terbatas, WARNA_STATUS } from "@/components/ui";
import { TabelMingguan } from "@/components/tabel-mingguan";
import { UbahProgres } from "@/components/ubah-progres";
import { ubahProgresUnit } from "../../../actions";
import { progresDikendalikanSpk } from "@/lib/data/progres-spk";

export default async function OpnameUnit({
  params,
}: {
  params: Promise<{ kode: string; unitKode: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode, unitKode } = await params;
  const kodeProyek = kode.toUpperCase();

  const unit = await prisma.unit.findUnique({
    where: { kode: decodeURIComponent(unitKode).toUpperCase() },
    select: {
      id: true, kode: true, nomor: true, progress: true, statusPembangunan: true,
      projectId: true,
      phase: { select: { kode: true } },
      project: { select: { kode: true, nama: true } },
      unitType: { select: { nama: true } },
      boqItems: {
        orderBy: { urutan: "asc" },
        select: { grup: true, uraian: true, satuan: true, volume: true, hargaSatuan: true },
      },
    },
  });

  if (!unit || unit.project.kode !== kodeProyek) notFound();
  if (!bolehAksesProyek(pengguna, unit.projectId)) notFound();

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const bolehProgres = bolehLihat(pengguna, "progress");
  const ubahProgres = bolehUbah(pengguna, "progress");

  // Progres unit yang sudah dirinci lewat BOQ SPK adalah nilai turunan.
  // Menimpanya manual hanya bertahan sampai opname berikutnya menuliskannya
  // ulang, jadi tombolnya ditiadakan dan alasannya dijelaskan.
  const dariSpk = await progresDikendalikanSpk(unit.id);

  if (!bolehProgres) {
    return (
      <div style={{ padding: 24 }}>
        <Link href={`/konstruksi/${kodeProyek}`} style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
          ← {unit.project.nama}
        </Link>
        <div style={{ marginTop: 16 }}>
          <Terbatas apa="Rincian progress konstruksi" />
        </div>
      </div>
    );
  }

  const titik = await duaTitikProgres({ unitId: unit.id }, unit.progress);
  const baris = susunOpname(unit.boqItems, titik.lalu, titik.kini);

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Konstruksi</div>
      <h2 className="disp" style={{ margin: "4px 0 14px", fontSize: 20 }}>Detail Progress Unit</h2>

      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
        <Link href="/konstruksi" style={{ color: "inherit", textDecoration: "none" }}>Konstruksi</Link>
        {" / "}
        <Link href={`/konstruksi/${kodeProyek}`} style={{ color: "inherit", textDecoration: "none" }}>
          {unit.project.nama}
        </Link>
        {" / "}
        <b style={{ color: "var(--text)" }}>Unit {unit.nomor}</b>
      </div>

      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          flexWrap: "wrap", gap: 12, marginBottom: 14,
        }}
      >
        <div>
          <div className="eyebrow">
            Fase {unit.phase.kode} · {unit.unitType.nama}
          </div>
          <h3 className="disp" style={{ margin: "4px 0 0", fontSize: 19 }}>Unit {unit.nomor}</h3>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Badge nilai={unit.statusPembangunan} peta={WARNA_STATUS.bangun} />
          {ubahProgres && !dariSpk && (
            <UbahProgres id={unit.id} nilai={unit.progress} aksi={ubahProgresUnit} />
          )}
          {dariSpk && (
            <span
              className="chip"
              title="Progres dihitung dari baris BOQ pada SPK, tertimbang nilai tiap pekerjaan"
              style={{ background: "var(--rona-teal2)", color: "var(--teal)" }}
            >
              {unit.progress}% · dari opname SPK
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          fontSize: 11.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.6,
        }}
      >
        Pembanding &ldquo;minggu lalu&rdquo; diambil dari catatan opname sebelumnya
        {titik.lalu === 0 && titik.kini > 0 ? " — unit ini baru punya satu catatan, jadi seluruh progres dihitung sebagai penambahan minggu ini." : "."}
      </div>

      <TabelMingguan baris={baris} bolehHarga={bolehHarga} />
    </div>
  );
}
