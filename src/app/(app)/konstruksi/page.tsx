import { redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna } from "@/lib/auth/rbac";
import { dashboardKonstruksi } from "@/lib/data/konstruksi";
import { kpiKonstruksi } from "@/lib/tampilan/konstruksi";
import { Badge, TabelHead, Track, WARNA_STATUS } from "@/components/ui";
import { Tabel } from "@/components/kartu-tabel";

export default async function DashboardKonstruksi() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const proyek = await dashboardKonstruksi(pengguna);

  const angka = kpiKonstruksi(proyek);

  const kpi: [string, string | number][] = [
    ["Total Proyek", angka.jumlahProyek],
    ["Unit Sedang Dikerjakan", angka.dikerjakan],
    ["Rata Progress Unit", `${angka.rataUnit}%`],
    ["Rata Progress Sarpras", `${angka.rataSarpras}%`],
  ];

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Konstruksi</div>
      <h2 className="disp" style={{ margin: "4px 0 14px", fontSize: 20 }}>
        Dashboard Konstruksi
      </h2>

      <div className="grid grid4" style={{ marginBottom: 16 }}>
        {kpi.map(([label, nilai]) => (
          <div key={label} className="card kpi">
            <div className="eyebrow">{label}</div>
            <div className="v" style={{ fontSize: 22 }}>{nilai}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <TabelHead
          judul="Tabel Progress Proyek"
          keterangan="Klik nama proyek untuk membuka progress unit dan sarana prasarananya."
        />
        <Tabel
          kolom={[
            { label: "Proyek" },
            { label: "Fase" },
            { label: "Unit", rata: "kanan" },
            { label: "Dikerjakan", rata: "kanan" },
            { label: "Progress Unit", minLebar: 170 },
            { label: "Sarpras", rata: "kanan" },
            { label: "Progress Sarpras", minLebar: 170 },
            { label: "Status" },
          ]}
          kosong="Belum ada proyek yang dapat Anda akses."
        >
          {proyek.map((p) => (
            <tr key={p.id}>
              <td>
                <Link
                  href={`/konstruksi/${p.kode}`}
                  style={{ fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}
                >
                  {p.nama}
                </Link>
                <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{p.kode}</div>
              </td>
              <td style={{ color: "var(--muted)" }}>{p.fases.join(", ")}</td>
              <td style={{ textAlign: "right" }}>{p.jumlahUnit}</td>
              <td style={{ textAlign: "right" }}>{p.dikerjakan}</td>
              <td>
                <Track nilai={p.rataUnit} tinggi={10} warna={p.rataUnit === 100 ? "var(--green)" : "var(--teal)"} />
                <div style={{ fontSize: 10.5, color: "var(--muted)", textAlign: "right", marginTop: 2 }}>
                  {p.rataUnit}%
                </div>
              </td>
              <td style={{ textAlign: "right" }}>{p.jumlahSarpras}</td>
              <td>
                {p.jumlahSarpras ? (
                  <>
                    <Track
                      nilai={p.rataSarpras}
                      tinggi={10}
                      warna={p.rataSarpras === 100 ? "var(--green)" : "var(--brass)"}
                    />
                    <div style={{ fontSize: 10.5, color: "var(--muted)", textAlign: "right", marginTop: 2 }}>
                      {p.rataSarpras}%
                    </div>
                  </>
                ) : (
                  <span style={{ color: "var(--muted)", fontSize: 11.5 }}>—</span>
                )}
              </td>
              <td>
                <Badge nilai={p.status} peta={WARNA_STATUS.proyek} />
              </td>
            </tr>
          ))}
        </Tabel>
      </div>
    </div>
  );
}
