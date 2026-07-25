import { redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna } from "@/lib/auth/rbac";
import { daftarProyek, kpiMaster, luasTotal } from "@/lib/data/proyek";
import { m2 } from "@/lib/format";
import { Badge, TabelHead, WARNA_STATUS } from "@/components/ui";

export default async function MasterProyek() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const [proyek, kpi] = await Promise.all([daftarProyek(pengguna), kpiMaster(pengguna)]);

  const angka: [string, number][] = [
    ["Total Proyek", kpi.proyek],
    ["Total Unit", kpi.unit],
    ["Tipe Unit Terdaftar", kpi.tipeUnit],
    ["Item Sarana & Prasarana", kpi.sarpras],
  ];

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Master Data · pelaksanaan konstruksi</div>
      <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>
        Master Proyek
      </h2>

      <div className="grid grid4" style={{ marginTop: 16 }}>
        {angka.map(([label, nilai]) => (
          <div key={label} className="card kpi">
            <div className="eyebrow">{label}</div>
            <div className="v" style={{ fontSize: 24 }}>
              {nilai}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        <TabelHead
          judul="Daftar Proyek"
          keterangan="Klik nama proyek untuk membuka detailnya."
        />
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Proyek</th>
                <th>Kecamatan / Kota</th>
                <th style={{ textAlign: "right" }}>Luas Total</th>
                <th style={{ textAlign: "right" }}>Unit</th>
                <th>Fase</th>
                <th style={{ textAlign: "right" }}>Sarpras</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {proyek.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/master/${p.kode}`}
                      style={{ fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}
                    >
                      {p.nama}
                    </Link>
                    <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{p.kode}</div>
                  </td>
                  <td style={{ color: "var(--muted)" }}>
                    {p.kecamatan}, {p.kota}
                  </td>
                  <td style={{ textAlign: "right" }}>{m2(luasTotal(p))}</td>
                  <td style={{ textAlign: "right" }}>{p._count.units}</td>
                  <td style={{ color: "var(--muted)" }}>
                    {p.fases.map((f) => f.kode).join(", ")}
                  </td>
                  <td style={{ textAlign: "right" }}>{p._count.infrastructures}</td>
                  <td>
                    <Badge nilai={p.statusLahan} peta={WARNA_STATUS.lahan} />
                  </td>
                </tr>
              ))}
              {proyek.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}>
                    Belum ada proyek yang dapat Anda akses.
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
