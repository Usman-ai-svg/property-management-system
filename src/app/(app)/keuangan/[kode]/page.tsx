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
  searchParams: Promise<{ donat?: string; unit?: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode } = await params;
  const { donat = "jenis", unit: unitDipilih } = await searchParams;
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

  // Unit yang sedang dibuka rinciannya. Dipegang di URL, bukan di state
  // komponen, supaya rincian sebuah unit bisa ditautkan langsung dan tetap
  // terbuka setelah halaman dimuat ulang.
  const unitRinci = unitDipilih
    ? proyek.units.find((u) => u.kode === unitDipilih.toUpperCase())
    : undefined;
  const alamatDasar = `/keuangan/${proyek.kode}?donat=${mode}`;

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
          keterangan="Klik nomor unit untuk melihat rincian per jenis biaya · Alokasi kontrak adalah bagian unit dari kontrak borongan yang sudah terbayar."
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
                    <td>
                      <Link
                        href={
                          unitRinci?.id === u.id
                            ? alamatDasar
                            : `${alamatDasar}&unit=${u.kode}#rincian-unit`
                        }
                        scroll={false}
                        style={{ fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}
                      >
                        {u.nomor}
                      </Link>
                    </td>
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

      {/* ---------- rincian biaya satu unit ---------- */}
      {unitRinci &&
        (() => {
          const tx = proyek.expenses.filter((e) => e.unitId === unitRinci.id);
          const rap = rapUnit(unitRinci);
          const terpakai = tx.reduce((s, e) => s + e.total, 0);
          // Pembagi dijaga agar tidak nol supaya bar tetap tergambar walau unit
          // ini belum punya transaksi sama sekali.
          const pembagi = terpakai || 1;

          const perJenis = Object.keys(WARNA_JENIS)
            .map((j) => ({
              jenis: j,
              nilai: tx.filter((e) => e.jenis === j).reduce((s, e) => s + e.total, 0),
            }))
            .filter((x) => x.nilai > 0)
            .sort((a, b) => b.nilai - a.nilai);

          return (
            <div
              id="rincian-unit"
              className="card"
              style={{ marginTop: 16, padding: "16px 20px", border: "1px solid var(--teal)" }}
            >
              <div
                style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", flexWrap: "wrap", gap: 10,
                }}
              >
                <div>
                  <div className="eyebrow">Rincian Biaya per Unit</div>
                  <div className="disp" style={{ fontWeight: 600, fontSize: 16, marginTop: 3 }}>
                    {proyek.nama} — Unit {unitRinci.nomor}{" "}
                    <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 13 }}>
                      · Fase {unitRinci.phase.kode} · {unitRinci.unitType.nama}
                    </span>
                  </div>
                </div>
                <Link
                  href={alamatDasar}
                  scroll={false}
                  style={{ color: "var(--muted)", fontSize: 12.5, textDecoration: "none" }}
                >
                  Tutup ×
                </Link>
              </div>

              <div className="grid grid4" style={{ gap: 14, margin: "14px 0" }}>
                {(
                  [
                    ["RAP Unit", rp(rap), false],
                    ["Total Pengeluaran", rp(terpakai), false],
                    ["Sisa Anggaran", rp(rap - terpakai), rap - terpakai < 0],
                    ["Terpakai", pct(terpakai / (rap || 1), 1), false],
                  ] as [string, string, boolean][]
                ).map(([label, nilai, merah]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: 0.5 }}>{label}</div>
                    <div className="num" style={{ fontSize: 15, color: merah ? "var(--red)" : "var(--ink)" }}>
                      {nilai}
                    </div>
                  </div>
                ))}
              </div>

              <div className="eyebrow" style={{ marginBottom: 8 }}>Pengeluaran per Jenis Biaya</div>
              {perJenis.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--muted)", padding: "4px 0 8px" }}>
                  Unit ini belum punya pengeluaran langsung yang tercatat.
                </div>
              ) : (
                perJenis.map((x) => (
                  <div
                    key={x.jenis}
                    style={{
                      display: "grid", gridTemplateColumns: "160px 1fr 190px",
                      gap: 12, alignItems: "center", padding: "6px 0",
                    }}
                  >
                    <div style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          width: 10, height: 10, borderRadius: 3,
                          background: WARNA_JENIS[x.jenis], flexShrink: 0,
                        }}
                      />
                      {x.jenis}
                    </div>
                    <Track nilai={(x.nilai / pembagi) * 100} tinggi={12} warna={WARNA_JENIS[x.jenis]} />
                    <div style={{ textAlign: "right", fontSize: 12.5 }}>
                      <b className="num">{rp(x.nilai)}</b>{" "}
                      <span style={{ color: "var(--muted)" }}>· {pct(x.nilai / pembagi, 1)}</span>
                    </div>
                  </div>
                ))
              )}

              <div className="eyebrow" style={{ margin: "16px 0 8px" }}>
                Transaksi Unit · {tx.length} entri
              </div>
              <div className="tablewrap" style={{ maxHeight: 260, overflowY: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Jenis</th>
                      <th style={{ minWidth: 200 }}>Keterangan</th>
                      <th>Metode</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tx.map((e) => (
                      <tr key={e.id}>
                        <td style={{ color: "var(--muted)" }}>{tanggal(e.tanggal)}</td>
                        <td>
                          <span style={{ color: WARNA_JENIS[e.jenis] ?? "#999", marginRight: 4 }}>■</span>
                          {e.jenis}
                        </td>
                        <td style={{ whiteSpace: "normal" }}>
                          {e.uraian}
                          {/* Sebagian besar transaksi per unit belum punya PIC;
                              barisnya disembunyikan alih-alih menulis "oleh —". */}
                          {e.pic && (
                            <div style={{ fontSize: 10, color: "var(--muted)" }}>oleh {e.pic}</div>
                          )}
                        </td>
                        <td style={{ color: "var(--muted)" }}>{e.metode}</td>
                        <td className="num" style={{ textAlign: "right" }}>{rp(e.total)}</td>
                        <td>
                          <Badge nilai={e.status} peta={WARNA_STATUS.bayar} />
                        </td>
                      </tr>
                    ))}
                    {tx.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ color: "var(--muted)", textAlign: "center", padding: 18 }}>
                          Belum ada transaksi yang dicatat langsung ke unit ini. Biaya yang
                          masuk lewat kontrak borongan muncul sebagai Alokasi Kontrak, bukan
                          sebagai transaksi unit.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

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
