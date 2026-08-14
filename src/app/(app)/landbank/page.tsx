import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, FileText, X } from "lucide-react";
import { ambilPengguna, bolehLihat } from "@/lib/auth/rbac";
import { dataLandbank } from "@/lib/data/landbank";
import { rataRasioEfektif, susunBarisLandbank } from "@/lib/tampilan/landbank";
import { m2, pct, rp } from "@/lib/format";
import { Badge, TabelHead, Track, WARNA_STATUS } from "@/components/ui";
import { Tabel } from "@/components/kartu-tabel";
import { Perbandingan, type BarisIndikator } from "./perbandingan";

export default async function Landbank() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const bolehBp = bolehLihat(pengguna, "businessPlan");

  const { proyek, rencana } = await dataLandbank(pengguna);

  const baris = susunBarisLandbank(proyek, rencana);

  const kpi: [string, string][] = [
    ["Total Proyek", String(baris.length)],
    ["Total Luas Lahan", m2(baris.reduce((s, p) => s + p.luasTotal, 0))],
    ["Total Biaya Perolehan", bolehHarga ? rp(baris.reduce((s, p) => s + p.perolehan, 0)) : "—"],
    [
      "Rata Kavling Efektif",
      baris.length ? pct(rataRasioEfektif(baris), 1) : "—",
    ],
  ];

  // Baris indikator disusun di server (fungsi format tak bisa menyeberang ke
  // klien), lalu komponen Perbandingan hanya menyaring KOLOM proyek.
  const defIndikator: [string, (p: (typeof baris)[number]) => string, boolean, boolean?][] = [
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
    ["Margin Rencana", (p) => pct(p.margin, 1), bolehBp, true],
  ];

  const indikator: BarisIndikator[] = defIndikator
    .filter(([, , tampil]) => tampil)
    .map(([label, ambil, , sorotHijau]) => ({
      label,
      sorotHijau,
      nilai: Object.fromEntries(baris.map((p) => [p.id, ambil(p)])),
    }));

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Landbank · rencana proyek</div>
      <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>Landbank</h2>

      <div style={{ fontSize: 12.5, color: "var(--muted)", margin: "6px 0 18px", lineHeight: 1.5 }}>
        Portofolio lahan sekaligus perbandingan antar proyek — dalam satu halaman.
      </div>

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
                <Badge nilai={p.status} peta={WARNA_STATUS.proyek} />
              </td>
            </tr>
          ))}
        </Tabel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Perbandingan
          proyek={baris.map((p) => ({ id: p.id, nama: p.nama }))}
          indikator={indikator}
          keterangan={
            (bolehBp
              ? "Termasuk proyeksi laba & margin rencana."
              : "Proyeksi laba & margin tidak ditampilkan untuk peran Anda.") +
            " Pilih proyek yang ingin dibandingkan."
          }
        />
      </div>
    </div>
  );
}
