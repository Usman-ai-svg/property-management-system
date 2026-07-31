import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { ambilPengguna, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { daftarProyekPlanReal, planVsRealisasi } from "@/lib/data/plan-real";
import { kpiPlanRealisasi, warnaSerapan } from "@/lib/tampilan/plan-realisasi";
import { pct, rp } from "@/lib/format";
import { Badge, Kartu, TabelHead, Terbatas, Track, WARNA_STATUS } from "@/components/ui";
import { CatatBiayaOperasional } from "./catat-ops";
import { HapusPembayaranJual, KelolaPembayaranJual, UbahPembayaranJual } from "./bayar-jual";
import { Tabel } from "@/components/kartu-tabel";

const TAB = [
  ["hpp", "HPP"],
  ["penjualan", "Penjualan"],
  ["operasional", "Operasional"],
  ["laba", "Rencana Laba"],
] as const;

/**
 * Batang plan vs realisasi dengan penanda progres fisik.
 *
 * Penanda segitiga menunjukkan sejauh mana pekerjaan sudah jadi. Bila
 * batang biaya melewati penanda, uang keluar lebih cepat daripada
 * pekerjaannya — itulah yang membuat warnanya berubah merah.
 */
function Meter({
  nama,
  plan,
  real,
  progres,
}: {
  nama: string;
  plan: number;
  real: number;
  progres: number;
}) {
  const terpakai = plan ? real / plan : 0;
  const warna = warnaSerapan(terpakai, progres);
  const selisih = real - plan;

  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: "180px 1fr 210px", gap: 12,
        alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--garis-halus)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13 }}>{nama}</div>
      <Track nilai={Math.min(terpakai, 1) * 100} tanda={progres * 100} warna={warna} />
      <div style={{ textAlign: "right", fontSize: 12 }}>
        <div className="num">
          {rp(real)}{" "}
          <span style={{ color: "var(--muted)", fontWeight: 400 }}>/ {rp(plan)}</span>
        </div>
        <div
          style={{
            fontSize: 11, fontWeight: 600,
            color: selisih > 0 ? "var(--red)" : "var(--green)",
          }}
        >
          {selisih > 0 ? "▲" : "▼"} {rp(Math.abs(selisih))}
        </div>
      </div>
    </div>
  );
}

function Kpi4({
  items,
}: {
  items: [string, number, number, "rev" | "cost" | "pct" | "count"][];
}) {
  return (
    <div className="grid grid4">
      {items.map(([label, plan, real, jenis]) => {
        const baik = jenis === "cost" ? real <= plan : real >= plan;
        const Panah = baik ? ArrowUpRight : ArrowDownRight;
        const format = (v: number) =>
          jenis === "pct" ? pct(v, 1) : jenis === "count" ? String(v) : rp(v);

        return (
          <div key={label} className="card kpi">
            <div className="eyebrow">{label}</div>
            <div className="v">{format(real)}</div>
            <div
              style={{
                display: "flex", justifyContent: "space-between",
                marginTop: 5, alignItems: "center", gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11, color: "var(--muted)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                Plan {format(plan)}
              </span>
              <Panah size={14} color={baik ? "var(--green)" : "var(--red)"} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function PlanRealisasi({
  searchParams,
}: {
  searchParams: Promise<{ proyek?: string; tab?: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  if (!bolehLihat(pengguna, "businessPlan")) {
    return (
      <div style={{ padding: 24 }}>
        <div className="eyebrow">Kokpit Kendali</div>
        <h2 className="disp" style={{ margin: "4px 0 16px", fontSize: 20 }}>Plan vs Realisasi</h2>
        <Terbatas apa="Perbandingan rencana dan realisasi" />
      </div>
    );
  }

  const daftar = await daftarProyekPlanReal(pengguna);
  if (daftar.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <div className="terbatas">Belum ada proyek dengan business plan yang dapat Anda akses.</div>
      </div>
    );
  }

  const { proyek: kodeProyek, tab = "hpp" } = await searchParams;
  const kode = daftar.some((p) => p.kode === kodeProyek) ? kodeProyek! : daftar[0].kode;
  const tabAktif = TAB.some(([t]) => t === tab) ? tab : "hpp";

  const d = await planVsRealisasi(pengguna, kode);
  if (!d) redirect("/plan-realisasi");

  const bolehCatatOps = bolehUbah(pengguna, "businessPlan");
  const bolehCatatCair = bolehUbah(pengguna, "keuangan");

  const { targetJual, realJual, terjual, melampaui } = kpiPlanRealisasi(
    d.sales, d.biaya, d.progres,
  );

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          flexWrap: "wrap", gap: 12,
        }}
      >
        <div>
          <div className="eyebrow">Kokpit Kendali · Komisaris, BOD &amp; Business Development</div>
          <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>Plan vs Realisasi</h2>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Rencana dari Landbank → Business Plan · realisasi dari data unit, kontrak &amp; pengeluaran
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {daftar.map((p) => (
            <Link
              key={p.kode}
              href={`?proyek=${p.kode}&tab=${tabAktif}`}
              className={"pill" + (kode === p.kode ? " active" : "")}
            >
              {p.nama}
            </Link>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
        <Badge nilai={d.proyek.statusLahan} peta={WARNA_STATUS.lahan} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Progres fisik rata-rata {pct(d.progres, 1)}
          {melampaui > 0 && ` · ${melampaui} pos HPP menyerap lebih cepat dari progresnya`}
        </span>
      </div>

      <div className="tabbar" style={{ marginBottom: 16 }}>
        {TAB.map(([id, label]) => (
          <Link
            key={id}
            href={`?proyek=${kode}&tab=${id}`}
            className={"tab" + (tabAktif === id ? " active" : "")}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* ================= HPP ================= */}
      {tabAktif === "hpp" && (
        <>
          <Kpi4
            items={[
              ["Penjualan", d.penjualanPlan, d.penjualanReal, "rev"],
              ["HPP", d.hppPlan, d.hppReal, "cost"],
              ["Laba Bersih", d.labaBersihPlan, d.labaBersihReal, "rev"],
              ["Margin", d.marginPlan, d.marginReal, "pct"],
            ]}
          />

          <Kartu atas={16}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Realisasi HPP per kategori</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, lineHeight: 1.6 }}>
              Penanda segitiga menunjukkan progres fisik. Batang yang melewatinya berarti biaya
              keluar lebih cepat daripada pekerjaan jadi.
            </div>
            {d.biaya.map((c) => (
              <div key={c.kode}>
                <Meter nama={`${c.kode}. ${c.nama}`} plan={c.plan} real={c.real} progres={d.progres} />
                <div
                  style={{
                    fontSize: 10.5, color: "var(--muted)",
                    marginTop: -4, marginBottom: 2, paddingLeft: 2,
                  }}
                >
                  sumber realisasi: {c.sumber}
                </div>
              </div>
            ))}
            <div
              style={{
                display: "flex", justifyContent: "space-between", paddingTop: 12,
                marginTop: 4, borderTop: "2px solid var(--line)", fontWeight: 700,
              }}
            >
              <span className="disp">Total HPP</span>
              <span className="num">
                {rp(d.hppReal)}{" "}
                <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>
                  / {rp(d.hppPlan)}
                </span>
              </span>
            </div>
          </Kartu>
        </>
      )}

      {/* ================= PENJUALAN ================= */}
      {tabAktif === "penjualan" && (
        <>
          <Kpi4
            items={[
              ["Target Penjualan", targetJual, targetJual, "rev"],
              ["Realisasi Akad", targetJual, realJual, "rev"],
              ["Unit Terjual", d.sales.length, terjual, "count"],
              ["Capaian", 1, targetJual ? realJual / targetJual : 0, "pct"],
            ]}
          />

          <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
            <TabelHead
              judul="Penjualan per Unit"
              keterangan="Harga target mengacu rencana omset · pencairan dari penerimaan yang tercatat."
            />
            <Tabel
              tinggiMaks={460}
              kolom={[
                { label: "Unit" },
                { label: "Tipe" },
                { label: "L. Bangunan", rata: "kanan" },
                { label: "L. Tanah", rata: "kanan" },
                { label: "Harga Target", rata: "kanan" },
                { label: "Harga Akad", rata: "kanan" },
                { label: "Nominal Pencairan", rata: "kanan" },
                { label: "Sudah Cair", rata: "kanan" },
                { label: "Belum Cair", rata: "kanan" },
                { label: "Status" },
                bolehCatatCair && { label: "Pencairan", minLebar: 130 },
              ]}
            >
              {d.sales.map((s) => {
                const belum = s.pencairan - s.sudahCair;
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.no}</td>
                    <td>{s.tipe}</td>
                    <td style={{ textAlign: "right" }}>{s.luasBangunan} m²</td>
                    <td style={{ textAlign: "right" }}>{s.luasTanah} m²</td>
                    <td className="num" style={{ textAlign: "right" }}>{rp(s.target)}</td>
                    <td className="num" style={{ textAlign: "right" }}>
                      {s.akad ? rp(s.real) : "—"}
                    </td>
                    <td className="num" style={{ textAlign: "right" }}>
                      {s.akad ? rp(s.pencairan) : "—"}
                    </td>
                    <td className="num" style={{ textAlign: "right" }}>
                      {s.akad ? (
                        <>
                          {rp(s.sudahCair)}{" "}
                          <span style={{ color: "var(--muted)", fontSize: 11 }}>
                            ({s.pencairan ? pct(s.sudahCair / s.pencairan) : "0%"})
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className="num"
                      style={{
                        textAlign: "right",
                        color: belum > 0 ? "var(--amber)" : "var(--green)",
                      }}
                    >
                      {s.akad ? rp(belum) : "—"}
                    </td>
                    <td>
                      <Badge nilai={s.akad ? "Akad" : "Tersedia"} peta={WARNA_STATUS.jual} />
                    </td>
                    {bolehCatatCair && (
                      <td>
                        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                          <KelolaPembayaranJual
                            unitId={s.id}
                            labelUnit={s.no}
                            hargaJual={s.target}
                            riwayat={s.penerimaan}
                          />
                          {s.penerimaan.map((p) => (
                            <span key={p.id} style={{ display: "flex", alignItems: "center" }}>
                              <UbahPembayaranJual bayar={p} labelUnit={s.no} />
                              <HapusPembayaranJual id={p.id} uraian={p.uraian} />
                            </span>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </Tabel>
          </div>
        </>
      )}

      {/* ================= OPERASIONAL ================= */}
      {tabAktif === "operasional" && (
        <Kartu>
          <div
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              flexWrap: "wrap", gap: 10, marginBottom: 10,
            }}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>
                Biaya Operasional · plan vs realisasi
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                Di luar HPP: pemasaran, umum &amp; administrasi, bunga &amp; pajak.
              </div>
            </div>
            {bolehCatatOps && (
              <CatatBiayaOperasional
                projectId={d.proyek.id}
                namaProyek={d.proyek.nama}
                pos={d.ops.map((o) => o.nama)}
              />
            )}
          </div>
          {d.ops.map((o) => (
            <Meter key={o.nama} nama={o.nama} plan={o.plan} real={o.real} progres={d.progres} />
          ))}
          <div
            style={{
              display: "flex", justifyContent: "space-between", paddingTop: 12,
              marginTop: 4, borderTop: "2px solid var(--line)", fontWeight: 700,
            }}
          >
            <span className="disp">Total Operasional</span>
            <span className="num">
              {rp(d.opsReal)}{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>
                / {rp(d.opsPlan)}
              </span>
            </span>
          </div>
        </Kartu>
      )}

      {/* ================= LABA ================= */}
      {tabAktif === "laba" && (
        <div className="card" style={{ padding: "18px 22px" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Rencana Laba · Plan vs Realisasi</div>
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
                ["Penjualan", d.penjualanPlan, d.penjualanReal, false],
                ["Biaya Pokok (HPP)", -d.hppPlan, -d.hppReal, true],
                ["Laba Kotor", d.labaKotorPlan, d.labaKotorReal, false],
                ["Biaya Operasional", -d.opsPlan, -d.opsReal, true],
                ["Laba Bersih", d.labaBersihPlan, d.labaBersihReal, false],
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
                <td className="num" style={{ textAlign: "right" }}>{rp(plan)}</td>
                <td className="num" style={{ textAlign: "right" }}>{rp(real)}</td>
                <td
                  style={{
                    textAlign: "right", fontSize: 11, fontWeight: 600,
                    color: real - plan >= 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  {real - plan >= 0 ? "+" : ""}
                  {rp(real - plan)}
                </td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              <td>Margin Laba Bersih</td>
              <td className="num" style={{ textAlign: "right" }}>{pct(d.marginPlan, 1)}</td>
              <td className="num" style={{ textAlign: "right" }}>{pct(d.marginReal, 1)}</td>
              <td
                style={{
                  textAlign: "right", fontSize: 11, fontWeight: 600,
                  color: d.marginReal >= d.marginPlan ? "var(--green)" : "var(--red)",
                }}
              >
                {d.marginReal >= d.marginPlan ? "+" : ""}
                {pct(d.marginReal - d.marginPlan, 1)}
              </td>
            </tr>
          </Tabel>
        </div>
      )}
    </div>
  );
}
