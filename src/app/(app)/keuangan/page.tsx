import { redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehUbah } from "@/lib/auth/rbac";
import { dataKeuangan, komposisi, pintuBayar, WARNA_JENIS } from "@/lib/data/keuangan";
import { rp, rpRingkas, tanggal } from "@/lib/format";
import { RvsRAP } from "@/components/charts";
import { TrenChart } from "@/components/tren-chart";
import { BarisKpi, Kartu, TabelHead } from "@/components/ui";
import { CatatPembayaran } from "./catat-pembayaran";
import { BreakdownKategori } from "./breakdown-kategori";
import { Tabel } from "@/components/kartu-tabel";

export default async function DashboardKeuangan() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const bolehCatat = bolehUbah(pengguna, "keuangan");
  const { proyek, tren, expenses, hutang } = await dataKeuangan(pengguna);
  const proyekBayar = bolehCatat ? await pintuBayar(pengguna) : [];

  const batas = new Date(Date.now() - 30 * 864e5);
  const total30 = expenses.filter((e) => e.tanggal >= batas).reduce((s, e) => s + e.total, 0);

  const aktif = proyek.filter((p) => p.status === "Dalam Pembangunan").length;
  const over = proyek.filter((p) => p.rap && p.realisasi / p.rap > 1).length;
  // Kedua komposisi dihitung di server; peralihan Jenis/Peruntukan di kartu
  // Breakdown murni state klien, jadi tak ada muat ulang yang melompatkan scroll.
  const kompJenis = komposisi(expenses, "jenis");
  const kompPeruntukan = komposisi(expenses, "peruntukan");

  // Hutang berjalan: total sisa untuk KPI, dan proyek yang lewat tenggat untuk
  // menandai baris tabel dengan lencana pengingat.
  const sisaHutang = hutang.reduce((s, h) => s + h.sisa, 0);
  const proyekTelatHutang = new Set(
    hutang.filter((h) => h.jatuhTempo === "lewat").map((h) => h.kodeProyek),
  );

  const kpi: [string, string][] = [
    // Akrual: "Biaya" (bukan "Pengeluaran") karena memuat hutang sejak timbul,
    // sebelum kasnya keluar. Arus kas nyata menyusul sebagai laporan terpisah.
    ["Total Biaya (30 hari)", rp(total30)],
    ["Sisa Hutang", rp(sisaHutang)],
    ["Melebihi RAP", String(over)],
    ["Proyek Aktif", `${aktif} / ${proyek.length}`],
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
        {bolehCatat && <CatatPembayaran proyek={proyekBayar} />}
      </div>

      <BarisKpi kpi={kpi} />

      <Kartu atas={16}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Tren Biaya · 12 bulan · termasuk hutang saat timbul
        </div>
        <TrenChart data={tren} />
      </Kartu>

      {hutang.length > 0 && <KartuHutang hutang={hutang} />}

      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        <TabelHead
          judul="Pengeluaran per Proyek"
          keterangan="Klik nama proyek untuk membuka rincian pengeluarannya · urutan mengikuti Master Proyek."
        />
        <Tabel
          kolom={[
            { label: "Proyek" },
            { label: "RAB", rata: "kanan" },
            { label: "RAP", rata: "kanan" },
            { label: "Realisasi", rata: "kanan" },
            { label: "% vs RAP", minLebar: 210 },
          ]}
        >
          {proyek
            .filter((p) => p.jumlahUnit)
            .map((p) => (
              <tr key={p.id}>
                <td>
                  <Link
                    href={`/keuangan/${p.kode}`}
                    style={{ fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}
                  >
                    {p.nama}
                  </Link>
                  <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                    {p.kode} · {p.statusLahan}
                    {proyekTelatHutang.has(p.kode) && (
                      <span
                        className="chip"
                        title="Ada hutang yang lewat tenggat pada proyek ini"
                        style={{ background: "var(--rona-merah)", color: "var(--red)", marginLeft: 6 }}
                      >
                        hutang lewat tenggat
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ textAlign: "right" }}>{rp(p.rab)}</td>
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
        <BreakdownKategori jenis={kompJenis} peruntukan={kompPeruntukan} />

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

type BarisHutang = {
  id: string;
  kreditur: string;
  uraian: string;
  proyek: string;
  sisa: number;
  status: string;
  tenggat: string;
  jatuhTempo: "lewat" | "dekat" | "aman";
};

/**
 * Pengingat hutang jatuh tempo. Diurut dari yang paling mendesak (lewat tenggat
 * lebih dulu, lalu yang mendekati); baris lewat tenggat ditandai merah, yang
 * dekat kuning. Muncul hanya bila ada hutang berjalan.
 */
function KartuHutang({ hutang }: { hutang: BarisHutang[] }) {
  const urut = { lewat: 0, dekat: 1, aman: 2 } as const;
  const daftar = [...hutang].sort((a, b) => urut[a.jatuhTempo] - urut[b.jatuhTempo]);

  const warnaTempo = (t: BarisHutang["jatuhTempo"]) =>
    t === "lewat" ? "var(--red)" : t === "dekat" ? "var(--amber)" : "var(--muted)";

  return (
    <Kartu atas={16}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        Hutang Jatuh Tempo · {hutang.length} berjalan
      </div>
      <div style={{ maxHeight: 300, overflow: "auto" }}>
        {daftar.map((h) => (
          <div
            key={h.id}
            style={{
              display: "grid", gridTemplateColumns: "1fr auto", gap: 10,
              alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--garis-halus)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                {h.kreditur}
                <span
                  className="chip"
                  style={{
                    marginLeft: 6,
                    background: h.status === "DP" ? "var(--rona-teal)" : "var(--rona-abu)",
                    color: h.status === "DP" ? "var(--teal)" : "var(--muted)",
                  }}
                >
                  {h.status}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                {h.proyek} · {h.uraian}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="num" style={{ fontSize: 12.5 }}>{rp(h.sisa)}</div>
              <div style={{ fontSize: 10.5, color: warnaTempo(h.jatuhTempo), fontWeight: 600 }}>
                {h.jatuhTempo === "lewat" ? "⚠ lewat " : h.jatuhTempo === "dekat" ? "⏳ " : ""}
                {h.tenggat}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Kartu>
  );
}
