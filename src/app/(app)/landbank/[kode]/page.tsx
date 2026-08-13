import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Lock, MapPin } from "lucide-react";
import { ambilPengguna, bolehAksesProyek, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { businessPlanProyek, detailLandbank } from "@/lib/data/landbank";
import { luasTotal, ringkasRencana } from "@/lib/tampilan/landbank";
import { m2, pct, rp } from "@/lib/format";
import { Badge, CardHead, InfoRow, Kartu, TabelHead, WARNA_STATUS } from "@/components/ui";
import { FileRow } from "@/components/file-row";
import { unggahRevisi } from "../../master/actions";
import {
  FormCashflow, FormPembanding, FormPosHpp, FormPosOmzet, FormPosOperasional,
  HapusCashflow, HapusPembanding, HapusPosHpp, HapusPosOmzet, HapusPosOperasional,
} from "../editors-bp";
import { EditBiayaLahan } from "./editors";
import { Tabel } from "@/components/kartu-tabel";

const BP_TAB = [
  ["hpp", "Rencana HPP"],
  ["omzet", "Rencana Omset"],
  ["ops", "Rencana Biaya Operasional"],
  ["laba", "Rencana Laba"],
  ["cash", "Rencana Cashflow"],
] as const;


export default async function DetailLandbank({
  params,
  searchParams,
}: {
  params: Promise<{ kode: string }>;
  searchParams: Promise<{ tab?: string; bp?: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode } = await params;
  const { tab = "fs", bp = "hpp" } = await searchParams;
  const kodeProyek = kode.toUpperCase();
  const tabAktif = tab === "bp" ? "bp" : "fs";
  const bpAktif = BP_TAB.some(([t]) => t === bp) ? bp : "hpp";

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const ubahHarga = bolehUbah(pengguna, "hargaRabRap");
  const bolehBp = bolehLihat(pengguna, "businessPlan");
  const bolehUbahBp = bolehUbah(pengguna, "businessPlan");
  const ubahTeknis = bolehUbah(pengguna, "dokumenTeknis");

  const proyek = await detailLandbank(kodeProyek, bolehHarga);

  if (!proyek) notFound();
  if (!bolehAksesProyek(pengguna, proyek.id)) notFound();

  // Business plan diambil terpisah, dan hanya bila peran berhak — menyisipkan
  // relasi lewat select bersyarat membuat Prisma kehilangan tipe pastinya.
  const rencana = bolehBp ? await businessPlanProyek(proyek.id) : null;

  const total = luasTotal(proyek);
  const b = proyek as Partial<{
    hargaPerM2: number; biayaPembelian: number; biayaNotaris: number;
    biayaBalikNama: number; biayaLegalLain: number;
  }>;
  const perolehan = bolehHarga
    ? (b.biayaPembelian ?? 0) + (b.biayaNotaris ?? 0) + (b.biayaBalikNama ?? 0) + (b.biayaLegalLain ?? 0)
    : 0;

  const {
    hpp: totalHpp, omzet: totalOmzet, ops: totalOps,
  } = ringkasRencana(rencana ?? undefined);
  const labaKotor = totalOmzet - totalHpp;
  const labaBersih = labaKotor - totalOps;

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Landbank · rencana proyek</div>
      <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>Landbank</h2>

      <Link
        href="/landbank"
        style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none", display: "inline-block", margin: "12px 0 10px" }}
      >
        ← Kembali ke portofolio
      </Link>

      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          flexWrap: "wrap", gap: 12, marginBottom: 14,
        }}
      >
        <div>
          <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <MapPin size={12} />
            {proyek.kecamatan}, {proyek.kota}
          </div>
          <h3 className="disp" style={{ margin: "4px 0 0", fontSize: 19 }}>{proyek.nama}</h3>
        </div>
        <Badge nilai={proyek.status} peta={WARNA_STATUS.proyek} />
      </div>

      <div className="tabbar" style={{ marginBottom: 16 }}>
        <Link href="?tab=fs" className={"tab" + (tabAktif === "fs" ? " active" : "")}>
          Feasibility Study
        </Link>
        <Link href="?tab=bp" className={"tab" + (tabAktif === "bp" ? " active" : "")}>
          Business Plan
        </Link>
      </div>

      {/* ================= FEASIBILITY STUDY ================= */}
      {tabAktif === "fs" && (
        <>
          <div className="grid grid2">
            <Kartu>
              <CardHead judul="Luas & Perolehan Lahan" aksi={
                bolehHarga && ubahHarga ? (
                  <EditBiayaLahan
                    kode={kodeProyek}
                    biaya={{
                      hargaPerM2: b.hargaPerM2 ?? 0,
                      biayaPembelian: b.biayaPembelian ?? 0,
                      biayaNotaris: b.biayaNotaris ?? 0,
                      biayaBalikNama: b.biayaBalikNama ?? 0,
                      biayaLegalLain: b.biayaLegalLain ?? 0,
                    }}
                  />
                ) : undefined
              } />
              <InfoRow label="Luas Total" nilai={m2(total)} />
              <InfoRow label="Kavling Efektif" nilai={`${m2(proyek.luasKavlingEfektif)} · ${total ? pct(proyek.luasKavlingEfektif / total, 1) : "—"}`} />
              {bolehHarga ? (
                <>
                  <InfoRow label="Harga per m²" nilai={rp(b.hargaPerM2 ?? 0)} />
                  <InfoRow label="Biaya Pembelian" nilai={rp(b.biayaPembelian ?? 0)} />
                  <InfoRow label="Notaris" nilai={rp(b.biayaNotaris ?? 0)} />
                  <InfoRow label="Balik Nama" nilai={rp(b.biayaBalikNama ?? 0)} />
                  <InfoRow label="Legal Lain-lain" nilai={rp(b.biayaLegalLain ?? 0)} />
                  <div
                    style={{
                      display: "flex", justifyContent: "space-between", paddingTop: 10,
                      marginTop: 4, borderTop: "1px solid var(--line)", fontSize: 13,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Total Perolehan Lahan</span>
                    <span className="num" style={{ fontSize: 15 }}>{rp(perolehan)}</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: "var(--muted)", paddingTop: 10 }}>
                  Angka biaya perolehan tidak ditampilkan untuk peran Anda.
                </div>
              )}
            </Kartu>

            <Kartu>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Analisis Lahan</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                Dilampirkan sebagai dokumen PDF.
              </div>
              <FileRow
                label="Dokumen Analisis Lahan"
                dokumen={
                  proyek.analisaDoc
                    ? {
                        id: proyek.analisaDoc.id,
                        kategori: proyek.analisaDoc.kategori,
                        versi: proyek.analisaDoc.versions,
                      }
                    : null
                }
                bolehUbah={ubahTeknis}
                konteks={`Analisis Lahan · ${proyek.nama}`}
                pemilik={{ jenis: "proyek", id: proyek.id, kategori: "analisa" }}
                aksiUnggah={unggahRevisi}
              />
            </Kartu>
          </div>

          <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
            <TabelHead
              judul="Market Research"
              keterangan={`Proyek pembanding radius ±5 km · ${proyek.marketComparables.length} proyek`}
              aksi={bolehUbahBp && <FormPembanding kodeProyek={proyek.kode} />}
            />
            <Tabel
              tinggiMaks={400}
              kolom={[
                { label: "Nama Proyek" },
                { label: "Jumlah Unit", rata: "kanan" },
                { label: "Tipe Unit" },
                { label: "Luas Unit", rata: "kanan" },
                { label: "Luas Lahan", rata: "kanan" },
                { label: "Harga", rata: "kanan" },
                bolehUbahBp && { lebar: 74 },
              ]}
              kosong="Belum ada proyek pembanding."
            >
              {proyek.marketComparables.flatMap((mp) =>
                mp.tipe.map((t, i) => (
                  <tr key={t.id}>
                    {i === 0 && (
                      <td
                        rowSpan={mp.tipe.length}
                        style={{ verticalAlign: "top", borderRight: "1px solid var(--garis-halus)" }}
                      >
                        <div style={{ fontWeight: 600 }}>{mp.nama}</div>
                        <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                          ± {mp.jarak.toLocaleString("id-ID")} km
                        </div>
                      </td>
                    )}
                    <td style={{ textAlign: "right" }}>{t.jumlah}</td>
                    <td>{t.tipe}</td>
                    <td style={{ textAlign: "right" }}>{t.luasUnit} m²</td>
                    <td style={{ textAlign: "right" }}>{t.luasLahan} m²</td>
                    <td className="num" style={{ textAlign: "right" }}>{rp(t.harga)}</td>
                    {bolehUbahBp && (
                      <td>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <FormPembanding
                            kodeProyek={proyek.kode}
                            data={{
                              id: t.id, nama: mp.nama, jarak: mp.jarak, tipe: t.tipe,
                              jumlah: t.jumlah, luasUnit: t.luasUnit,
                              luasLahan: t.luasLahan, harga: t.harga,
                            }}
                          />
                          <HapusPembanding id={t.id} nama={`${mp.nama} · ${t.tipe}`} />
                        </div>
                      </td>
                    )}
                  </tr>
                )),
              )}
            </Tabel>
          </div>
        </>
      )}

      {/* ================= BUSINESS PLAN ================= */}
      {tabAktif === "bp" &&
        (!bolehBp || !rencana ? (
          <div className="card" style={{ padding: 34, textAlign: "center", color: "var(--muted)" }}>
            <Lock size={18} />
            <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.6 }}>
              {bolehBp
                ? "Proyek ini belum punya business plan."
                : "Business Plan hanya dapat diakses oleh peran yang dicentang di Admin → Kelola Hak Akses."}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid4" style={{ marginBottom: 16 }}>
              {(
                [
                  ["Rencana Omset", rp(totalOmzet)],
                  ["Rencana HPP", rp(totalHpp)],
                  ["Rencana Laba Bersih", rp(labaBersih)],
                  ["Margin Rencana", totalOmzet ? pct(labaBersih / totalOmzet, 1) : "—"],
                ] as [string, string][]
              ).map(([label, nilai]) => (
                <div key={label} className="card kpi">
                  <div className="eyebrow">{label}</div>
                  <div className="v" style={{ fontSize: 15 }}>{nilai}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
              {BP_TAB.map(([id, label]) => (
                <Link
                  key={id}
                  href={`?tab=bp&bp=${id}`}
                  className={"pill" + (bpAktif === id ? " active" : "")}
                >
                  {label}
                </Link>
              ))}
            </div>

            {bpAktif === "hpp" && (
              <div className="card" style={{ overflow: "hidden" }}>
                {bolehUbahBp && (
                  <TabelHead judul="Rencana HPP" aksi={<FormPosHpp businessPlanId={rencana.id} />} />
                )}
                <Tabel
                  kolom={[
                    { label: "Komponen" },
                    { label: "Anggaran", rata: "kanan" },
                    { label: "Porsi", rata: "kanan" },
                    bolehUbahBp && { lebar: 74 },
                  ]}
                >
                {rencana.hpp.map((h) => (
                  <tr key={h.id}>
                    <td>{h.nama}</td>
                    <td className="num" style={{ textAlign: "right" }}>{rp(h.nilai)}</td>
                    <td style={{ textAlign: "right", color: "var(--muted)" }}>
                      {totalHpp ? pct(h.nilai / totalHpp, 1) : "—"}
                    </td>
                    {bolehUbahBp && (
                      <td>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <FormPosHpp businessPlanId={rencana.id} pos={h} />
                          <HapusPosHpp id={h.id} nama={h.nama} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, background: "var(--rona-baris)" }}>
                  <td>TOTAL HPP</td>
                  <td className="num" style={{ textAlign: "right" }}>{rp(totalHpp)}</td>
                  <td style={{ textAlign: "right" }}>100%</td>
                  {bolehUbahBp && <td />}
                </tr>
                </Tabel>
              </div>
            )}

            {bpAktif === "omzet" && (
              <div className="card" style={{ overflow: "hidden" }}>
                {bolehUbahBp && (
                  <TabelHead judul="Rencana Omset" aksi={<FormPosOmzet businessPlanId={rencana.id} />} />
                )}
                <Tabel
                  kolom={[
                    { label: "Tipe Unit" },
                    { label: "Jumlah", rata: "kanan" },
                    { label: "Harga Satuan", rata: "kanan" },
                    { label: "Subtotal", rata: "kanan" },
                    bolehUbahBp && { lebar: 74 },
                  ]}
                >
                {rencana.omzet.map((o) => (
                  <tr key={o.id}>
                    <td>{o.tipe}</td>
                    <td style={{ textAlign: "right" }}>{o.jumlah}</td>
                    <td className="num" style={{ textAlign: "right" }}>{rp(o.harga)}</td>
                    <td className="num" style={{ textAlign: "right" }}>{rp(o.jumlah * o.harga)}</td>
                    {bolehUbahBp && (
                      <td>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <FormPosOmzet businessPlanId={rencana.id} pos={o} />
                          <HapusPosOmzet id={o.id} tipe={o.tipe} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, background: "var(--rona-baris)" }}>
                  <td colSpan={3}>TOTAL OMSET</td>
                  <td className="num" style={{ textAlign: "right" }}>{rp(totalOmzet)}</td>
                  {bolehUbahBp && <td />}
                </tr>
                </Tabel>
              </div>
            )}

            {bpAktif === "ops" && (
              <div className="card" style={{ overflow: "hidden" }}>
                {bolehUbahBp && (
                  <TabelHead
                    judul="Rencana Biaya Operasional"
                    keterangan="Nama pos dipakai untuk mencocokkan biaya operasional yang dicatat di Plan vs Realisasi."
                    aksi={<FormPosOperasional businessPlanId={rencana.id} />}
                  />
                )}
                <Tabel
                  kolom={[
                    { label: "Komponen" },
                    { label: "Anggaran", rata: "kanan" },
                    { label: "Porsi terhadap Omset", rata: "kanan" },
                    bolehUbahBp && { lebar: 74 },
                  ]}
                >
                {rencana.operasional.map((o) => (
                  <tr key={o.id}>
                    <td>{o.nama}</td>
                    <td className="num" style={{ textAlign: "right" }}>{rp(o.nilai)}</td>
                    <td style={{ textAlign: "right", color: "var(--muted)" }}>
                      {totalOmzet ? pct(o.nilai / totalOmzet, 1) : "—"}
                    </td>
                    {bolehUbahBp && (
                      <td>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <FormPosOperasional businessPlanId={rencana.id} pos={o} />
                          <HapusPosOperasional id={o.id} nama={o.nama} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, background: "var(--rona-baris)" }}>
                  <td>TOTAL OPERASIONAL</td>
                  <td className="num" style={{ textAlign: "right" }}>{rp(totalOps)}</td>
                  <td style={{ textAlign: "right" }}>
                    {totalOmzet ? pct(totalOps / totalOmzet, 1) : "—"}
                  </td>
                  {bolehUbahBp && <td />}
                </tr>
                </Tabel>
              </div>
            )}

            {bpAktif === "laba" && (
              <Tabel kolom={[]} kelasBungkus="card tablewrap">
                {(
                  [
                    ["Rencana Omset", totalOmzet, "var(--ink)"],
                    ["Harga Pokok Penjualan", -totalHpp, "var(--muted)"],
                    ["Laba Kotor", labaKotor, "var(--teal)"],
                    ["Biaya Operasional", -totalOps, "var(--muted)"],
                    ["Laba Bersih", labaBersih, "var(--green)"],
                  ] as [string, number, string][]
                ).map(([label, nilai, warna], i) => (
                  <tr
                    key={label}
                    style={{
                      fontWeight: i === 2 || i === 4 ? 700 : 400,
                      background: i === 4 ? "var(--rona-baris)" : undefined,
                    }}
                  >
                    <td>{label}</td>
                    <td className="num" style={{ textAlign: "right", color: warna }}>
                      {nilai < 0 ? "−" : ""}
                      {rp(Math.abs(nilai))}
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td>Margin Laba Bersih</td>
                  <td className="num" style={{ textAlign: "right", color: "var(--green)" }}>
                    {totalOmzet ? pct(labaBersih / totalOmzet, 1) : "—"}
                  </td>
                </tr>
              </Tabel>
            )}

            {bpAktif === "cash" && (
              <div className="card" style={{ overflow: "hidden" }}>
                {bolehUbahBp && (
                  <TabelHead judul="Rencana Cashflow" aksi={<FormCashflow businessPlanId={rencana.id} />} />
                )}
                <Tabel
                  kolom={[
                    { label: "Periode" },
                    { label: "Kas Masuk", rata: "kanan" },
                    { label: "Kas Keluar", rata: "kanan" },
                    { label: "Net", rata: "kanan" },
                    { label: "Kumulatif", rata: "kanan" },
                    bolehUbahBp && { lebar: 74 },
                  ]}
                >
                {rencana.cashflow.map((c, i) => {
                  const net = c.masuk - c.keluar;
                  const kumulatif = rencana.cashflow
                    .slice(0, i + 1)
                    .reduce((s, x) => s + (x.masuk - x.keluar), 0);
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.periode}</td>
                      <td className="num" style={{ textAlign: "right" }}>{rp(c.masuk)}</td>
                      <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>
                        {rp(c.keluar)}
                      </td>
                      <td
                        className="num"
                        style={{ textAlign: "right", color: net >= 0 ? "var(--green)" : "var(--red)" }}
                      >
                        {net < 0 ? "−" : ""}
                        {rp(Math.abs(net))}
                      </td>
                      <td
                        className="num"
                        style={{
                          textAlign: "right",
                          color: kumulatif >= 0 ? "var(--ink)" : "var(--red)",
                          fontWeight: 600,
                        }}
                      >
                        {kumulatif < 0 ? "−" : ""}
                        {rp(Math.abs(kumulatif))}
                      </td>
                      {bolehUbahBp && (
                        <td>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <FormCashflow businessPlanId={rencana.id} baris={c} />
                            <HapusCashflow id={c.id} periode={c.periode} />
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                </Tabel>
              </div>
            )}
          </>
        ))}
    </div>
  );
}
