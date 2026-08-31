import { kodeProyekDari } from "@/lib/adaptor/rute";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Lock, MapPin } from "lucide-react";
import { ambilPengguna, bolehAksesProyek, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { businessPlanProyek, detailLandbank } from "@/lib/data/landbank";
import { planVsRealisasi } from "@/lib/data/plan-real";
import {
  kelompokKuartal, labelKuartal, luasTotal, ringkasRencana,
  totalKategoriHpp, totalKategoriOps,
} from "@/lib/tampilan/landbank";
import { warnaSerapan } from "@/lib/tampilan/plan-realisasi";
import { hargaAllIn, hargaPpn, m2, pct, periodeBulan, rp, tanggal } from "@/lib/format";
import { Badge, CardHead, InfoRow, Kartu, TabelHead, WARNA_STATUS } from "@/components/ui";
import { MenuAksi } from "@/components/form";
import { FileRow } from "@/components/file-row";
import { unggahRevisi } from "../../master/actions";
import {
  FormCashflow, FormHargaDasarUnit, FormPembanding,
  HapusCashflow, HapusPembanding, ResetHargaDasarUnit,
} from "../editors-bp";
import { EditBiayaLahan } from "./editors";
import { Tabel } from "@/components/kartu-tabel";
import { GrafikCashflow } from "../grafik-cashflow";
import { TabelRencanaBp } from "../tabel-rencana";
import { CatatPencairan } from "../bayar-jual";

const BP_TAB = [
  ["hpp", "Rencana HPP"],
  ["omzet", "Rencana Omset"],
  ["ops", "Rencana Biaya Operasional"],
  ["laba", "Rencana Laba"],
  ["cash", "Rencana Cashflow"],
] as const;

/**
 * Baris ringkasan plan vs realisasi dalam bentuk line-bar.
 *
 * Batang menunjukkan capaian realisasi terhadap rencana. Untuk pos biaya
 * (HPP) lebih kecil lebih baik; untuk pendapatan & laba lebih besar lebih baik —
 * warnanya mengikuti arah "baik" itu.
 */
function RingkasBar({
  label, plan, real, jenis,
}: {
  label: string;
  plan: number;
  real: number;
  jenis: "rev" | "cost" | "pct";
}) {
  const rasio = plan ? real / plan : real > 0 ? 1 : 0;
  const baik = jenis === "cost" ? real <= plan : real >= plan;
  const warnaBaik = baik ? "var(--green)" : jenis === "cost" ? "var(--red)" : "var(--amber)";
  const fmt = (v: number) => (jenis === "pct" ? pct(v, 1) : rp(v));
  const selisih = real - plan;
  const Panah = baik ? ArrowUpRight : ArrowDownRight;

  // Batang diverging: garis nol di tengah. Capaian positif tumbuh ke kanan,
  // realisasi minus (rugi / margin negatif) tumbuh ke kiri dengan warna merah,
  // jadi tak lagi tampak sebagai batang kosong. Lebar isi dibatasi ±100% dari
  // tiap sisi, tetapi label persen selalu memakai nilai capaian sesungguhnya.
  const minus = rasio < 0;
  const isi = Math.max(-1, Math.min(1, rasio)); // fraksi lebar setengah-track
  const warnaIsi = minus ? "var(--red)" : warnaBaik;
  const pctCapaian = Math.round(rasio * 100);

  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: "128px 1fr minmax(180px, 230px)", gap: 14,
        alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--garis-halus)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            position: "relative", flex: 1, height: 22,
            background: "var(--rona-abu)", borderRadius: 6, overflow: "hidden",
          }}
        >
          {/* Garis nol — batas untung/rugi */}
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--line)", opacity: 0.6 }} />
          {/* Isi capaian: ke kanan bila positif, ke kiri (merah) bila minus */}
          <div
            style={{
              position: "absolute", top: 3, bottom: 3, borderRadius: 4, background: warnaIsi,
              left: `${50 + Math.min(isi, 0) * 50}%`,
              width: `${Math.abs(isi) * 50}%`,
            }}
          />
        </div>
        <span
          className="num"
          style={{ width: 52, flexShrink: 0, textAlign: "right", fontSize: 12, fontWeight: 700, color: minus ? "var(--red)" : "var(--text)" }}
        >
          {pctCapaian}%
        </span>
      </div>
      <div style={{ textAlign: "right", fontSize: 12 }}>
        <div className="num">
          <span style={{ fontWeight: 600 }}>{fmt(real)}</span>
          <span style={{ color: "var(--muted)", fontWeight: 400 }}> / {fmt(plan)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: baik ? "var(--green)" : "var(--red)" }}>
          <Panah size={12} />
          {fmt(Math.abs(selisih))}
        </div>
      </div>
    </div>
  );
}

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
  const kodeProyek = kodeProyekDari(kode);
  const tabAktif = tab === "bp" ? "bp" : "fs";
  const bpAktif = BP_TAB.some(([t]) => t === bp) ? bp : "hpp";

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const ubahHarga = bolehUbah(pengguna, "hargaRabRap");
  const bolehBp = bolehLihat(pengguna, "businessPlan");
  const bolehUbahBp = bolehUbah(pengguna, "businessPlan");
  const bolehCatatCair = bolehUbah(pengguna, "keuangan");
  const ubahTeknis = bolehUbah(pengguna, "dokumenTeknis");

  const proyek = await detailLandbank(kodeProyek, bolehHarga);

  if (!proyek) notFound();
  if (!bolehAksesProyek(pengguna, proyek.id)) notFound();

  // Business plan diambil terpisah, dan hanya bila peran berhak — menyisipkan
  // relasi lewat select bersyarat membuat Prisma kehilangan tipe pastinya.
  // Realisasi (Plan vs Realisasi) kini melebur ke tab Business Plan, jadi
  // datanya ikut diambil di sini untuk mengisi kolom realisasi & bar serapan.
  const rencana = bolehBp ? await businessPlanProyek(proyek.id) : null;
  const pvr = bolehBp && rencana ? await planVsRealisasi(pengguna, kodeProyek) : null;

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

  // Peta realisasi per kategori — dicocokkan lewat NAMA kategori, sama seperti
  // yang dipakai Plan vs Realisasi (lihat SUMBER_HPP di lib/data/plan-real.ts).
  const progres = pvr?.progres ?? 0;
  const realHpp = new Map((pvr?.biaya ?? []).map((c) => [c.nama, c]));
  const realOps = new Map((pvr?.ops ?? []).map((o) => [o.nama, o.real]));
  const saleUnit = new Map((pvr?.sales ?? []).map((s) => [s.id, s]));
  const melampaui = (pvr?.biaya ?? []).filter(
    (c) => c.plan && warnaSerapan(c.real / c.plan, progres) === "var(--red)",
  ).length;

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

      {/* ================= BUSINESS PLAN (+ realisasi) ================= */}
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
            <div>
              <div className="eyebrow">Business Plan · rencana vs realisasi</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                Rencana dari Business Plan · realisasi dari data unit, kontrak &amp; pengeluaran yang tercatat.
              </div>
            </div>

            <Kartu atas={14}>
              <div className="eyebrow" style={{ marginBottom: 2 }}>Ringkasan · Rencana vs Realisasi</div>
              <RingkasBar label="HPP" plan={pvr?.hppPlan ?? totalHpp} real={pvr?.hppReal ?? 0} jenis="cost" />
              <RingkasBar label="Penjualan" plan={pvr?.penjualanPlan ?? totalOmzet} real={pvr?.penjualanReal ?? 0} jenis="rev" />
              <RingkasBar label="Laba Bersih" plan={pvr?.labaBersihPlan ?? labaBersih} real={pvr?.labaBersihReal ?? 0} jenis="rev" />
              <RingkasBar label="Margin" plan={pvr?.marginPlan ?? (totalOmzet ? labaBersih / totalOmzet : 0)} real={pvr?.marginReal ?? 0} jenis="pct" />
            </Kartu>

            <div style={{ fontSize: 12, color: "var(--muted)", margin: "12px 0 14px" }}>
              Progres fisik rata-rata {pct(progres, 1)}
              {melampaui > 0 && ` · ${melampaui} pos HPP menyerap lebih cepat dari progresnya`}
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

            {/* --------------- HPP: satu tabel, per kategori --------------- */}
            {bpAktif === "hpp" && (
              <TabelRencanaBp
                jenis="hpp"
                businessPlanId={rencana.id}
                bolehUbah={bolehUbahBp}
                progres={progres}
                totalPlan={totalHpp}
                totalReal={pvr?.hppReal ?? 0}
                kategori={rencana.hpp.map((k) => {
                  const r = realHpp.get(k.nama);
                  return {
                    id: k.id, nama: k.nama,
                    plan: totalKategoriHpp(k.rows), real: r?.real ?? 0, sumber: r?.sumber,
                    rows: k.rows.map((row) => ({
                      id: row.id, uraian: row.uraian, satuan: row.satuan, volume: row.volume, harga: row.harga,
                    })),
                  };
                })}
              />
            )}

            {/* --------------- OMSET (+ realisasi pencairan) --------------- */}
            {bpAktif === "omzet" && (
              <div className="card" style={{ overflow: "hidden" }}>
                <TabelHead
                  judul="Rencana Omset & Realisasi Penjualan"
                  keterangan="Harga dasar rencana (non-PPN) bisa disunting; Harga+PPN (11%) & All-In (+10%) otomatis. Realisasi = pencairan yang tercatat per unit."
                  aksi={
                    bolehCatatCair && pvr && pvr.sales.length > 0 && (
                      <CatatPencairan
                        units={pvr.sales.map((s) => ({
                          id: s.id, no: s.no, tipe: s.tipe,
                          plafon: s.target, sudahCair: s.sudahCair, riwayat: s.penerimaan,
                        }))}
                      />
                    )
                  }
                />
                <Tabel
                  tinggiMaks={520}
                  kolom={[
                    { label: "Unit" },
                    { label: "Tipe" },
                    { label: "LB", rata: "kanan" },
                    { label: "LT", rata: "kanan" },
                    { label: "Harga Dasar", rata: "kanan" },
                    { label: "Harga + PPN", rata: "kanan" },
                    { label: "All-In", rata: "kanan" },
                    { label: "Realisasi Cair", minLebar: 190 },
                    { label: "Status" },
                    bolehUbahBp && { lebar: 56 },
                  ]}
                  kosong="Proyek ini belum punya unit."
                >
                  {rencana.omzet.map((u) => {
                    const s = saleUnit.get(u.unitId);
                    const cair = s?.sudahCair ?? 0;
                    const adaPembayaran = !!(s && s.penerimaan.length > 0);
                    return (
                      <tr key={u.unitId}>
                        <td style={{ fontWeight: 600 }}>{u.no}</td>
                        <td>{u.tipe}</td>
                        <td style={{ textAlign: "right" }}>{u.lb} m²</td>
                        <td style={{ textAlign: "right" }}>{u.lt} m²</td>
                        <td className="num" style={{ textAlign: "right" }}>{rp(u.hargaDasar)}</td>
                        <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>
                          {rp(hargaPpn(u.hargaDasar))}
                        </td>
                        <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>
                          {rp(hargaAllIn(u.hargaDasar))}
                        </td>
                        <td>
                          {adaPembayaran ? (
                            <div style={{ display: "grid", gap: 2, fontSize: 11 }}>
                              {s!.penerimaan.map((p, i) => (
                                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                  <span style={{ color: "var(--muted)" }}>Cair ke-{i + 1} · {tanggal(p.tanggal)}</span>
                                  <span className="num">{rp(p.nominal)}</span>
                                </div>
                              ))}
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, borderTop: "1px solid var(--garis-halus)", paddingTop: 3, marginTop: 1, fontWeight: 600 }}>
                                <span>Total cair</span>
                                <span className="num" style={{ color: "var(--green)" }}>{rp(cair)}</span>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <Badge nilai={s?.akad ? "Akad" : "Tersedia"} peta={WARNA_STATUS.jual} />
                        </td>
                        {bolehUbahBp && (
                          <td>
                            <MenuAksi>
                              <FormHargaDasarUnit businessPlanId={rencana.id} unit={u} />
                              {u.dioverride && <ResetHargaDasarUnit unitId={u.unitId} no={u.no} />}
                            </MenuAksi>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  <tr style={{ fontWeight: 700, background: "var(--rona-baris)" }}>
                    <td colSpan={4}>TOTAL · {rencana.omzet.length} unit</td>
                    <td className="num" style={{ textAlign: "right" }}>{rp(totalOmzet)}</td>
                    <td className="num" style={{ textAlign: "right" }}>
                      {rp(rencana.omzet.reduce((s, u) => s + hargaPpn(u.hargaDasar), 0))}
                    </td>
                    <td className="num" style={{ textAlign: "right" }}>
                      {rp(rencana.omzet.reduce((s, u) => s + hargaAllIn(u.hargaDasar), 0))}
                    </td>
                    <td className="num" style={{ textAlign: "right" }}>
                      <span style={{ color: "var(--green)" }}>{rp(pvr?.penjualanReal ?? 0)}</span>
                      <span style={{ color: "var(--muted)", fontWeight: 400 }}> cair</span>
                    </td>
                    <td />
                    {bolehUbahBp && <td />}
                  </tr>
                </Tabel>
              </div>
            )}

            {/* --------------- OPERASIONAL: satu tabel, per kategori --------------- */}
            {bpAktif === "ops" && (
              <TabelRencanaBp
                jenis="ops"
                businessPlanId={rencana.id}
                bolehUbah={bolehUbahBp}
                progres={progres}
                totalPlan={totalOps}
                totalReal={pvr?.opsReal ?? 0}
                projectId={proyek.id}
                namaProyek={proyek.nama}
                kategori={rencana.operasional.map((k) => ({
                  id: k.id, nama: k.nama,
                  plan: totalKategoriOps(k.rows), real: realOps.get(k.nama) ?? 0,
                  rows: k.rows.map((row) => ({
                    id: row.id, uraian: row.nama, satuan: row.satuan, volume: row.volume, harga: row.harga,
                  })),
                }))}
              />
            )}

            {/* --------------- LABA: plan vs realisasi --------------- */}
            {bpAktif === "laba" && (
              <div className="card" style={{ overflow: "hidden" }}>
                <TabelHead judul="Rencana Laba · Plan vs Realisasi" />
                <Tabel
                  kolom={[
                    { label: "Pos" },
                    { label: "Plan", rata: "kanan" },
                    { label: "Realisasi", rata: "kanan" },
                    { label: "Selisih", rata: "kanan" },
                  ]}
                >
                  {(
                    [
                      ["Rencana Omset", pvr?.penjualanPlan ?? totalOmzet, pvr?.penjualanReal ?? 0, false],
                      ["Harga Pokok Penjualan (HPP)", -(pvr?.hppPlan ?? totalHpp), -(pvr?.hppReal ?? 0), true],
                      ["Laba Kotor", pvr?.labaKotorPlan ?? labaKotor, pvr?.labaKotorReal ?? 0, false],
                      ["Biaya Operasional", -(pvr?.opsPlan ?? totalOps), -(pvr?.opsReal ?? 0), true],
                      ["Laba Bersih", pvr?.labaBersihPlan ?? labaBersih, pvr?.labaBersihReal ?? 0, false],
                    ] as [string, number, number, boolean][]
                  ).map(([label, plan, real, pengurang], i) => (
                    <tr
                      key={label}
                      style={{
                        fontWeight: i === 2 || i === 4 ? 700 : 400,
                        background: i === 4 ? "var(--rona-baris)" : undefined,
                      }}
                    >
                      <td style={{ color: pengurang ? "var(--muted)" : "inherit" }}>{label}</td>
                      <td className="num" style={{ textAlign: "right" }}>
                        {plan < 0 ? "−" : ""}{rp(Math.abs(plan))}
                      </td>
                      <td className="num" style={{ textAlign: "right" }}>
                        {real < 0 ? "−" : ""}{rp(Math.abs(real))}
                      </td>
                      <td
                        style={{
                          textAlign: "right", fontSize: 11, fontWeight: 600,
                          color: real - plan >= 0 ? "var(--green)" : "var(--red)",
                        }}
                      >
                        {real - plan >= 0 ? "+" : "−"}{rp(Math.abs(real - plan))}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700 }}>
                    <td>Margin Laba Bersih</td>
                    <td className="num" style={{ textAlign: "right" }}>
                      {pct(pvr?.marginPlan ?? (totalOmzet ? labaBersih / totalOmzet : 0), 1)}
                    </td>
                    <td className="num" style={{ textAlign: "right" }}>{pct(pvr?.marginReal ?? 0, 1)}</td>
                    <td
                      style={{
                        textAlign: "right", fontSize: 11, fontWeight: 600,
                        color: (pvr?.marginReal ?? 0) >= (pvr?.marginPlan ?? 0) ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {pct((pvr?.marginReal ?? 0) - (pvr?.marginPlan ?? 0), 1)}
                    </td>
                  </tr>
                </Tabel>
              </div>
            )}

            {/* --------------- CASHFLOW: grup Tahun → Kuartal --------------- */}
            {bpAktif === "cash" && (
              <>
                {rencana.cashflow.length > 0 && (
                  <Kartu>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>Grafik Rencana Cashflow per Bulan</div>
                    <GrafikCashflow
                      data={rencana.cashflow.map((c) => ({ periode: c.periode, masuk: c.masuk, keluar: c.keluar }))}
                    />
                  </Kartu>
                )}
                <div className="card" style={{ overflow: "hidden", marginTop: rencana.cashflow.length > 0 ? 16 : 0 }}>
                  <TabelHead
                    judul="Rencana Cashflow · per Kuartal"
                    keterangan="Dikelompokkan per tahun lalu per kuartal, dengan subtotal. Rincian bulanan tetap tampil."
                    aksi={bolehUbahBp && <FormCashflow businessPlanId={rencana.id} />}
                  />
                  <Tabel
                    kolom={[
                      { label: "Periode" },
                      { label: "Kas Masuk", rata: "kanan" },
                      { label: "Kas Keluar", rata: "kanan" },
                      { label: "Net", rata: "kanan" },
                      { label: "Kumulatif", rata: "kanan" },
                      bolehUbahBp && { lebar: 74 },
                    ]}
                    kosong="Belum ada periode cashflow."
                  >
                    {kelompokKuartal(rencana.cashflow).flatMap((t) => [
                      ...t.kuartal.flatMap((q) => [
                        <tr key={`q-${t.tahun}-${q.kuartal}`} style={{ background: "var(--rona-abu)" }}>
                          <td style={{ fontWeight: 700 }}>{labelKuartal(t.tahun, q.kuartal)}</td>
                          <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>{rp(q.masuk)}</td>
                          <td className="num" style={{ textAlign: "right", fontWeight: 600, color: "var(--muted)" }}>{rp(q.keluar)}</td>
                          <td
                            className="num"
                            style={{ textAlign: "right", fontWeight: 600, color: q.net >= 0 ? "var(--green)" : "var(--red)" }}
                          >
                            {q.net < 0 ? "−" : ""}{rp(Math.abs(q.net))}
                          </td>
                          <td />
                          {bolehUbahBp && <td />}
                        </tr>,
                        ...q.bulan.map((c) => (
                          <tr key={c.id ?? c.periode}>
                            <td style={{ paddingLeft: 26 }}>{periodeBulan(c.periode)}</td>
                            <td className="num" style={{ textAlign: "right" }}>{rp(c.masuk)}</td>
                            <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>{rp(c.keluar)}</td>
                            <td
                              className="num"
                              style={{ textAlign: "right", color: c.net >= 0 ? "var(--green)" : "var(--red)" }}
                            >
                              {c.net < 0 ? "−" : ""}{rp(Math.abs(c.net))}
                            </td>
                            <td
                              className="num"
                              style={{ textAlign: "right", color: c.kumulatif >= 0 ? "var(--ink)" : "var(--red)", fontWeight: 600 }}
                            >
                              {c.kumulatif < 0 ? "−" : ""}{rp(Math.abs(c.kumulatif))}
                            </td>
                            {bolehUbahBp && (
                              <td>
                                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                  <FormCashflow businessPlanId={rencana.id} baris={{ id: c.id ?? "", periode: c.periode, masuk: c.masuk, keluar: c.keluar }} />
                                  <HapusCashflow id={c.id ?? ""} periode={c.periode} />
                                </div>
                              </td>
                            )}
                          </tr>
                        )),
                      ]),
                      <tr key={`y-${t.tahun}`} style={{ fontWeight: 700, background: "var(--rona-baris)" }}>
                        <td>Total {t.tahun}</td>
                        <td className="num" style={{ textAlign: "right" }}>{rp(t.masuk)}</td>
                        <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>{rp(t.keluar)}</td>
                        <td
                          className="num"
                          style={{ textAlign: "right", color: t.net >= 0 ? "var(--green)" : "var(--red)" }}
                        >
                          {t.net < 0 ? "−" : ""}{rp(Math.abs(t.net))}
                        </td>
                        <td
                          className="num"
                          style={{ textAlign: "right", color: t.kumulatifAkhir >= 0 ? "var(--ink)" : "var(--red)" }}
                        >
                          {t.kumulatifAkhir < 0 ? "−" : ""}{rp(Math.abs(t.kumulatifAkhir))}
                        </td>
                        {bolehUbahBp && <td />}
                      </tr>,
                    ])}
                  </Tabel>
                </div>
              </>
            )}
          </>
        ))}
    </div>
  );
}
