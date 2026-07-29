import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, FileText, X } from "lucide-react";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehLihat, filterProyek } from "@/lib/auth/rbac";
import { luasTotal } from "@/lib/data/proyek";
import { m2, pct, rp } from "@/lib/format";
import { Badge, TabelHead, Terbatas, Track, WARNA_STATUS } from "@/components/ui";
import { Tabel } from "@/components/kartu-tabel";
import { PlanRealisasiPanel } from "./plan-realisasi-panel";

export default async function Landbank({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; proyek?: string; pv?: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { tab = "portofolio", proyek: proyekParam, pv } = await searchParams;
  const tabAktif =
    tab === "banding" ? "banding" : tab === "pvr" ? "pvr" : "portofolio";

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const bolehBp = bolehLihat(pengguna, "businessPlan");

  const proyek = await prisma.project.findMany({
    where: filterProyek(pengguna),
    orderBy: { kode: "asc" },
    select: {
      id: true, kode: true, nama: true, statusLahan: true,
      kecamatan: true, kota: true,
      luasKavlingEfektif: true, luasSarana: true, luasPrasarana: true, luasRth: true,
      analisaDocId: true,
      _count: { select: { units: true } },
      ...(bolehHarga
        ? {
            hargaPerM2: true, biayaPembelian: true, biayaNotaris: true,
            biayaBalikNama: true, biayaLegalLain: true,
          }
        : {}),
    },
  });

  // Business plan diambil terpisah dan hanya bila peran berhak — sekaligus
  // menghindari pelebaran tipe akibat relasi bersyarat di dalam select.
  const rencana = bolehBp
    ? await prisma.businessPlan.findMany({
        where: { project: filterProyek(pengguna) },
        select: {
          projectId: true,
          hpp: { select: { nilai: true } },
          omzet: { select: { jumlah: true, harga: true } },
          operasional: { select: { nilai: true } },
        },
      })
    : [];

  const rencanaPerProyek = new Map(rencana.map((r) => [r.projectId, r]));

  const baris = proyek.map((p) => {
    const total = luasTotal(p);
    const b = p as Partial<{
      hargaPerM2: number; biayaPembelian: number; biayaNotaris: number;
      biayaBalikNama: number; biayaLegalLain: number;
    }>;
    const perolehan = bolehHarga
      ? (b.biayaPembelian ?? 0) + (b.biayaNotaris ?? 0) + (b.biayaBalikNama ?? 0) + (b.biayaLegalLain ?? 0)
      : 0;

    const bp = rencanaPerProyek.get(p.id);
    const omzet = bp ? bp.omzet.reduce((s, o) => s + o.jumlah * o.harga, 0) : 0;
    const hpp = bp ? bp.hpp.reduce((s, h) => s + h.nilai, 0) : 0;
    const ops = bp ? bp.operasional.reduce((s, o) => s + o.nilai, 0) : 0;
    const laba = omzet - hpp - ops;

    return {
      ...p,
      luasTotal: total,
      rasioEfektif: total ? p.luasKavlingEfektif / total : 0,
      hargaPerM2: b.hargaPerM2 ?? 0,
      perolehan,
      punyaBp: !!bp,
      omzet, hpp, ops, laba,
      margin: omzet ? laba / omzet : 0,
    };
  });

  const kpi: [string, string][] = [
    ["Total Proyek", String(baris.length)],
    ["Total Luas Lahan", m2(baris.reduce((s, p) => s + p.luasTotal, 0))],
    ["Total Biaya Perolehan", bolehHarga ? rp(baris.reduce((s, p) => s + p.perolehan, 0)) : "—"],
    [
      "Rata Kavling Efektif",
      baris.length ? pct(baris.reduce((s, p) => s + p.rasioEfektif, 0) / baris.length, 1) : "—",
    ],
  ];

  const indikator: [string, (p: (typeof baris)[number]) => string, boolean][] = [
    ["Luas Total", (p) => m2(p.luasTotal), true],
    ["Kavling Efektif", (p) => m2(p.luasKavlingEfektif), true],
    ["Rasio Efektif", (p) => pct(p.rasioEfektif, 1), true],
    ["Unit Terdaftar", (p) => `${p._count.units} unit`, true],
    ["Harga per m²", (p) => rp(p.hargaPerM2), bolehHarga],
    ["Total Perolehan Lahan", (p) => rp(p.perolehan), bolehHarga],
    ["Rencana Omset", (p) => rp(p.omzet), bolehBp],
    ["Rencana HPP", (p) => rp(p.hpp), bolehBp],
    ["Rencana Biaya Operasional", (p) => rp(p.ops), bolehBp],
    ["Rencana Laba Bersih", (p) => rp(p.laba), bolehBp],
    ["Margin Rencana", (p) => pct(p.margin, 1), bolehBp],
  ];

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Landbank · rencana proyek</div>
      <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>Landbank</h2>

      <div className="tabbar" style={{ margin: "14px 0 18px" }}>
        <Link href="?tab=portofolio" className={"tab" + (tabAktif === "portofolio" ? " active" : "")}>
          Dashboard Portofolio
        </Link>
        <Link href="?tab=banding" className={"tab" + (tabAktif === "banding" ? " active" : "")}>
          Perbandingan Proyek
        </Link>
        {bolehBp && (
          <Link href="?tab=pvr" className={"tab" + (tabAktif === "pvr" ? " active" : "")}>
            Plan vs Realisasi
          </Link>
        )}
      </div>

      {tabAktif === "portofolio" && (
        <>
          <div className="grid grid4">
            {kpi.map(([label, nilai]) => (
              <div key={label} className="card kpi">
                <div className="eyebrow">{label}</div>
                <div className="v" style={{ fontSize: 15 }}>{nilai}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
            <TabelHead
              judul="Portofolio Lahan"
              keterangan="Klik nama proyek untuk membuka studi kelayakan dan business plan-nya."
            />
            <Tabel
              kolom={[
                { label: "Proyek" },
                { label: "Kecamatan / Kota" },
                { label: "Kavling Efektif", rata: "kanan" },
                { label: "Luas Total", rata: "kanan" },
                { label: "Rasio Efektif", minLebar: 120 },
                bolehHarga && { label: "Harga / m²", rata: "kanan" },
                { label: "Analisis Lahan", rata: "tengah" },
                { label: "Business Plan", rata: "tengah" },
                { label: "Status" },
              ]}
            >
              {baris.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/landbank/${p.kode}`}
                      style={{ fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}
                    >
                      {p.nama}
                    </Link>
                    <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{p.kode}</div>
                  </td>
                  <td style={{ color: "var(--muted)" }}>
                    {p.kecamatan}, {p.kota}
                  </td>
                  <td style={{ textAlign: "right" }}>{m2(p.luasKavlingEfektif)}</td>
                  <td style={{ textAlign: "right" }}>{m2(p.luasTotal)}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Track nilai={p.rasioEfektif * 100} tinggi={9} warna="var(--brass)" />
                      <span style={{ fontSize: 10.5, color: "var(--muted)", width: 36, textAlign: "right" }}>
                        {pct(p.rasioEfektif, 1)}
                      </span>
                    </div>
                  </td>
                  {bolehHarga && (
                    <td className="num" style={{ textAlign: "right" }}>{rp(p.hargaPerM2)}</td>
                  )}
                  <td style={{ textAlign: "center" }}>
                    {p.analisaDocId ? (
                      <FileText size={14} style={{ color: "var(--teal)" }} />
                    ) : (
                      <X size={14} style={{ color: "var(--rona-ikon)" }} />
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {p.punyaBp ? (
                      <Check size={14} style={{ color: "var(--green)" }} />
                    ) : (
                      <X size={14} style={{ color: "var(--rona-ikon)" }} />
                    )}
                  </td>
                  <td>
                    <Badge nilai={p.statusLahan} peta={WARNA_STATUS.lahan} />
                  </td>
                </tr>
              ))}
            </Tabel>
          </div>
        </>
      )}

      {tabAktif === "banding" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <TabelHead
            judul="Perbandingan Proyek"
            keterangan={
              bolehBp
                ? "Termasuk proyeksi laba & margin rencana."
                : "Proyeksi laba & margin tidak ditampilkan untuk peran Anda."
            }
          />
          <Tabel
            kolom={[
              { label: "Indikator" },
              ...baris.map((p) => ({ label: p.nama, rata: "kanan" as const })),
            ]}
          >
            {indikator
              .filter(([, , tampil]) => tampil)
              .map(([label, ambil]) => (
                <tr key={label}>
                  <td style={{ fontWeight: 600 }}>{label}</td>
                  {baris.map((p) => (
                    <td
                      key={p.id}
                      className="num"
                      style={{
                        textAlign: "right",
                        color: label === "Margin Rencana" ? "var(--green)" : "inherit",
                      }}
                    >
                      {ambil(p)}
                    </td>
                  ))}
                </tr>
              ))}
          </Tabel>
        </div>
      )}

      {tabAktif === "pvr" &&
        (bolehBp ? (
          <PlanRealisasiPanel pengguna={pengguna} kodeParam={proyekParam} subParam={pv} />
        ) : (
          <Terbatas apa="Perbandingan rencana dan realisasi" />
        ))}
    </div>
  );
}
