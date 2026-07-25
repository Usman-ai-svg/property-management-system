import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehAksesProyek, bolehLihat } from "@/lib/auth/rbac";
import { komposisi, rapUnit, WARNA_JENIS } from "@/lib/data/keuangan";
import { alokasiKontrak, ringkasKontrak } from "@/lib/calc/keuangan";
import { pct, rp, tanggal } from "@/lib/format";
import { Donut, LegendaDonut, RvsRAP } from "@/components/charts";
import { Badge, TabelHead, Terbatas, Track, WARNA_STATUS } from "@/components/ui";

export default async function KeuanganProyek({
  params,
  searchParams,
}: {
  params: Promise<{ kode: string }>;
  searchParams: Promise<{ donat?: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode } = await params;
  const { donat = "jenis" } = await searchParams;
  const mode = donat === "peruntukan" ? "peruntukan" : "jenis";
  const kodeProyek = kode.toUpperCase();

  if (!bolehLihat(pengguna, "keuangan")) {
    return (
      <div style={{ padding: 24 }}>
        <Terbatas apa="Keuangan proyek" />
      </div>
    );
  }

  const proyek = await prisma.project.findUnique({
    where: { kode: kodeProyek },
    select: {
      id: true, kode: true, nama: true, statusLahan: true,
      units: {
        orderBy: [{ phase: { urutan: "asc" } }, { nomor: "asc" }],
        select: {
          id: true, kode: true, nomor: true, hargaJual: true, rapUpah: true,
          phase: { select: { kode: true } },
          unitType: { select: { nama: true } },
          rapItems: { select: { volume: true, hargaSatuan: true } },
          expenses: { select: { total: true } },
        },
      },
      expenses: {
        orderBy: { tanggal: "desc" },
        select: {
          id: true, tanggal: true, jenis: true, peruntukan: true, metode: true,
          uraian: true, total: true, status: true, pic: true, bukti: true, unitId: true,
          contract: { select: { vendor: { select: { nama: true } } } },
        },
      },
    },
  });

  if (!proyek) notFound();
  if (!bolehAksesProyek(pengguna, proyek.id)) notFound();

  // Alokasi kontrak ke unit: bagian unit dari kontrak borongan yang sudah
  // terbayar. Kontrak yang mencakup beberapa unit dibagi rata, kecuali unit
  // yang punya nilai override sendiri.
  const kontrakUnit = await prisma.contract.findMany({
    where: { projectId: proyek.id, jenis: "Unit" },
    select: {
      id: true, nominal: true, retensiPct: true,
      pembayaran: { select: { nominal: true } },
      variationOrders: { select: { nominal: true, status: true } },
      units: { select: { unitId: true, nilaiOverride: true } },
    },
  });

  const alokasiPerUnit = new Map<string, number>();
  for (const k of kontrakUnit) {
    const r = ringkasKontrak(k);
    const porsiTerbayar = r.nilaiEfektif ? r.terbayar / r.nilaiEfektif : 0;
    for (const a of alokasiKontrak(r.nilaiEfektif, k.units)) {
      alokasiPerUnit.set(a.unitId, (alokasiPerUnit.get(a.unitId) ?? 0) + a.alokasi * porsiTerbayar);
    }
  }

  const totalRap = proyek.units.reduce((s, u) => s + rapUnit(u), 0);
  const totalRealisasi = proyek.expenses.reduce((s, e) => s + e.total, 0);
  const nilaiKontrak = proyek.units.reduce((s, u) => s + u.hargaJual, 0);
  const levelProyek = proyek.expenses.filter((e) => !e.unitId).reduce((s, e) => s + e.total, 0);
  const komp = komposisi(proyek.expenses, mode);

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Keuangan Proyek</div>
      <h2 className="disp" style={{ margin: "4px 0 14px", fontSize: 20 }}>{proyek.nama}</h2>

      <Link
        href="/keuangan"
        style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none", display: "inline-block", marginBottom: 10 }}
      >
        ← Kembali ke daftar
      </Link>

      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          flexWrap: "wrap", gap: 12, marginBottom: 16,
        }}
      >
        <Badge nilai={proyek.statusLahan} peta={WARNA_STATUS.lahan} />
        <div style={{ display: "flex", gap: 26, textAlign: "right" }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1 }}>NILAI KONTRAK</div>
            <div className="num">{rp(nilaiKontrak)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1 }}>RAP</div>
            <div className="num">{rp(totalRap)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid2">
        <div className="card" style={{ padding: "16px 20px" }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Realisasi vs RAP</div>
          <div className="num" style={{ fontSize: 20, color: "var(--ink)", marginBottom: 8 }}>
            {rp(totalRealisasi)}
          </div>
          <RvsRAP realisasi={totalRealisasi} rap={totalRap} denganLabel />
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 8, gap: 8, flexWrap: "wrap",
            }}
          >
            <div className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Breakdown Kategori</div>
            <div style={{ display: "flex", gap: 4 }}>
              <Link href="?donat=jenis" className={"pill" + (mode === "jenis" ? " active" : "")}>Jenis</Link>
              <Link href="?donat=peruntukan" className={"pill" + (mode === "peruntukan" ? " active" : "")}>
                Peruntukan
              </Link>
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <Donut data={komp} ukuran={130} />
            <LegendaDonut data={komp} />
          </div>
        </div>
      </div>

      {/* ---------- pengeluaran per unit ---------- */}
      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        <TabelHead
          judul={`Pengeluaran per Unit · ${proyek.units.length} unit`}
          keterangan="Alokasi kontrak adalah bagian unit dari kontrak borongan yang sudah terbayar."
        />
        <div className="tablewrap" style={{ maxHeight: 380, overflowY: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th>Fase</th>
                <th>Tipe</th>
                <th style={{ textAlign: "right" }}>RAP</th>
                <th style={{ textAlign: "right" }}>Pengeluaran Langsung</th>
                <th style={{ textAlign: "right" }}>Alokasi Kontrak</th>
                <th style={{ textAlign: "right" }}>Total Realisasi</th>
                <th style={{ minWidth: 150 }}>% vs RAP</th>
              </tr>
            </thead>
            <tbody>
              {proyek.units.map((u) => {
                const rap = rapUnit(u);
                const langsung = u.expenses.reduce((s, e) => s + e.total, 0);
                const alokasi = alokasiPerUnit.get(u.id) ?? 0;
                const total = langsung + alokasi;
                const rasio = rap ? total / rap : 0;

                return (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.nomor}</td>
                    <td>{u.phase.kode}</td>
                    <td>{u.unitType.nama}</td>
                    <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>{rp(rap)}</td>
                    <td className="num" style={{ textAlign: "right" }}>{langsung ? rp(langsung) : "—"}</td>
                    <td className="num" style={{ textAlign: "right" }}>
                      {alokasi ? rp(Math.round(alokasi)) : "—"}
                    </td>
                    <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>
                      {rp(Math.round(total))}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Track
                          nilai={rasio * 100}
                          tinggi={9}
                          warna={rasio > 1 ? "var(--red)" : rasio > 0.9 ? "var(--amber)" : "var(--teal)"}
                        />
                        <span
                          style={{
                            fontSize: 10.5, width: 38, textAlign: "right",
                            color: rasio > 1 ? "var(--red)" : "var(--muted)",
                          }}
                        >
                          {pct(rasio, 1)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 700, background: "#f6f9fa" }}>
                <td colSpan={4}>Biaya level proyek (belum dialokasikan ke unit)</td>
                <td className="num" style={{ textAlign: "right" }} colSpan={3}>{rp(levelProyek)}</td>
                <td style={{ fontSize: 10.5, fontWeight: 400, color: "var(--muted)", whiteSpace: "normal" }}>
                  perijinan, prasarana, pengolahan lahan
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- transaksi ---------- */}
      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        <TabelHead
          judul={`Transaksi · ${proyek.expenses.length} entri`}
          keterangan="Kontrak vendor dikelola di modul Vendor Management."
        />
        <div className="tablewrap" style={{ maxHeight: 360, overflowY: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Jenis</th>
                <th>Keterangan</th>
                <th>Bukti</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {proyek.expenses.map((e) => (
                <tr key={e.id}>
                  <td style={{ color: "var(--muted)" }}>{tanggal(e.tanggal)}</td>
                  <td>
                    <span style={{ color: WARNA_JENIS[e.jenis] ?? "var(--muted)", marginRight: 4 }}>■</span>
                    {e.jenis}
                  </td>
                  <td>
                    <div>{e.uraian}</div>
                    <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                      oleh {e.pic ?? "—"}
                      {e.contract ? ` · ${e.contract.vendor.nama}` : ""}
                    </div>
                  </td>
                  <td>
                    {e.bukti ? (
                      <span style={{ color: "var(--teal)", fontSize: 11 }}>📎 {e.bukti}</span>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>
                    )}
                  </td>
                  <td className="num" style={{ textAlign: "right" }}>{rp(e.total)}</td>
                  <td>
                    <Badge nilai={e.status} peta={WARNA_STATUS.bayar} />
                  </td>
                </tr>
              ))}
              {proyek.expenses.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 22 }}>
                    Belum ada transaksi tercatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
