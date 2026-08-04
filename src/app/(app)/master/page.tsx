import { redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehUbah } from "@/lib/auth/rbac";
import { daftarProyek, kpiMaster } from "@/lib/data/proyek";
import { luasTotal } from "@/lib/tampilan/landbank";
import { m2 } from "@/lib/format";
import { Badge, TabelHead, WARNA_STATUS } from "@/components/ui";
import { Tabel } from "@/components/kartu-tabel";
import { TambahProyek } from "./editors-proyek";

export default async function MasterProyek() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const bisaKelola = bolehUbah(pengguna, "deskripsi");

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
          aksi={bisaKelola && <TambahProyek />}
        />
        <Tabel
          kolom={[
            { label: "Proyek" },
            { label: "Lokasi (Kelurahan, Kecamatan, Kota)" },
            { label: "Luas Total", rata: "kanan" },
            { label: "Unit", rata: "kanan" },
            { label: "Fase" },
            { label: "Sarpras", rata: "kanan" },
            { label: "Status" },
          ]}
          kosong="Belum ada proyek yang dapat Anda akses."
        >
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
                {p.kelurahan}, {p.kecamatan}, {p.kota}
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
        </Tabel>
      </div>
    </div>
  );
}
