import { segmen } from "@/lib/adaptor/rute";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehUbah } from "@/lib/auth/rbac";
import { dataKeuangan, komposisi, WARNA_JENIS } from "@/lib/data/keuangan";
import { rp, rpRingkas, tanggal } from "@/lib/format";
import { Donut, LegendaDonut, RvsRAP } from "@/components/charts";
import { TrenChart } from "@/components/tren-chart";
import { BarisKpi, Kartu, TabelHead } from "@/components/ui";
import { CatatPengeluaran } from "./catat";
import { Tabel } from "@/components/kartu-tabel";

export default async function DashboardKeuangan({
  searchParams,
}: {
  searchParams: Promise<{ donat?: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { donat = "jenis" } = await searchParams;
  const mode = donat === "peruntukan" ? "peruntukan" : "jenis";

  const bolehCatat = bolehUbah(pengguna, "keuangan");
  const { proyek, tren, expenses, proyekUntukForm } = await dataKeuangan(pengguna, bolehCatat);

  const batas = new Date(Date.now() - 30 * 864e5);
  const total30 = expenses.filter((e) => e.tanggal >= batas).reduce((s, e) => s + e.total, 0);

  const aktif = proyek.filter((p) => p.status === "Dalam Pembangunan").length;
  const over = proyek.filter((p) => p.rap && p.realisasi / p.rap > 1).length;
  const komp = komposisi(expenses, mode);

  const kpi: [string, string][] = [
    ["Total Pengeluaran (30 hari)", rp(total30)],
    ["Proyek Aktif", `${aktif} / ${proyek.length}`],
    ["Melebihi RAP", String(over)],
    ["Kategori Terbesar", komp[0]?.label ?? "—"],
  ];

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 10, marginBottom: 8,
        }}
      >
        <div>
          <div className="eyebrow">Manajemen Proyek · Keuangan Proyek</div>
          <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>Keuangan Proyek</h2>
        </div>
        {bolehCatat && (
          <CatatPengeluaran
            proyek={proyekUntukForm.map((p) => ({
              id: p.id, nama: p.nama,
              units: p.units.map((u) => ({ id: u.id, label: `${u.phase.kode}-${u.nomor}` })),
              sarpras: p.infrastructures.map((s) => ({ id: s.id, label: `${s.nama} · ${s.jenis}` })),
            }))}
          />
        )}
      </div>

      <BarisKpi kpi={kpi} />

      <Kartu atas={16}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Tren Pengeluaran · 12 bulan</div>
        <TrenChart data={tren} />
      </Kartu>

      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        <TabelHead
          judul="Pengeluaran per Proyek"
          keterangan="Klik nama proyek untuk membuka rincian pengeluarannya · diurut dari yang paling boros."
        />
        <Tabel
          kolom={[
            { label: "Proyek" },
            { label: "Nilai Kontrak", rata: "kanan" },
            { label: "RAP", rata: "kanan" },
            { label: "Realisasi", rata: "kanan" },
            { label: "% vs RAP", minLebar: 210 },
          ]}
        >
          {[...proyek]
            .filter((p) => p.jumlahUnit)
            .sort((a, b) => (b.rap ? b.realisasi / b.rap : 0) - (a.rap ? a.realisasi / a.rap : 0))
            .map((p) => (
              <tr key={p.id}>
                <td>
                  <Link
                    href={`/keuangan/${segmen(p.kode)}`}
                    style={{ fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}
                  >
                    {p.nama}
                  </Link>
                  <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                    {p.kode} · {p.statusLahan}
                  </div>
                </td>
                <td style={{ textAlign: "right" }}>{rp(p.nilaiKontrak)}</td>
                <td style={{ textAlign: "right", color: "var(--muted)" }}>{rp(p.rap)}</td>
                <td style={{ textAlign: "right" }}>{rp(p.realisasi)}</td>
                <td>
                  <RvsRAP realisasi={p.realisasi} rap={p.rap} denganLabel />
                </td>
              </tr>
            ))}
        </Tabel>
      </div>

      <div className="grid grid2" style={{ marginTop: 16 }}>
        <Kartu>
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
            <Donut data={komp} />
            <LegendaDonut data={komp} />
          </div>
        </Kartu>

        <Kartu>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Aktivitas Terbaru</div>
          <div style={{ maxHeight: 300, overflow: "auto" }}>
            {expenses.slice(0, 8).map((e) => (
              <div
                key={e.id}
                style={{
                  display: "grid", gridTemplateColumns: "34px 1fr auto", gap: 10,
                  alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--garis-halus)",
                }}
              >
                <div
                  style={{
                    width: 30, height: 30, borderRadius: 8, background: "var(--ink)",
                    color: "#fff", display: "grid", placeItems: "center",
                    fontSize: 10, fontWeight: 600,
                  }}
                >
                  {(e.pic ?? "—").split(" ").map((x) => x[0]).join("").slice(0, 2)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5 }}>
                    <b>{(e.pic ?? "Seseorang").split(" ")[0]}</b> mencatat {e.uraian}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {e.project.nama} ·{" "}
                    <span style={{ color: WARNA_JENIS[e.jenis] ?? "var(--muted)" }}>■</span> {e.jenis}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="num" style={{ fontSize: 12.5 }}>{rpRingkas(e.total)}</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{tanggal(e.tanggal)}</div>
                </div>
              </div>
            ))}
            {expenses.length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Belum ada pengeluaran tercatat.</div>
            )}
          </div>
        </Kartu>
      </div>
    </div>
  );
}
