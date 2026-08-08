import { redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { dataVendor } from "@/lib/data/vendor";
import { kpiVendor, susunBarisVendor } from "@/lib/tampilan/vendor";
import { pct, rp } from "@/lib/format";
import { BarisKpi, TabelHead, Terbatas, Track } from "@/components/ui";
import { HapusVendor, TambahVendor, UbahVendor } from "./editors-vendor";
import { Tabel } from "@/components/kartu-tabel";

export default async function VendorManagement() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  if (!bolehLihat(pengguna, "progress")) {
    return (
      <div style={{ padding: 24 }}>
        <Terbatas apa="Vendor management" />
      </div>
    );
  }

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const bolehKelola = bolehUbah(pengguna, "progress");

  // Hanya kontrak pada proyek yang boleh diakses pengguna yang ikut dihitung —
  // vendor yang sama bisa mengerjakan proyek di luar jangkauannya.
  const { vendor } = await dataVendor(pengguna, bolehKelola);

  const baris = susunBarisVendor(vendor);
  const angka = kpiVendor(vendor);

  const kpi: [string, string][] = [
    ["Vendor Terdaftar", String(angka.jumlahVendor)],
    ["Kontrak Berjalan", `${angka.kontrakBerjalan} / ${angka.jumlahKontrak}`],
    ["Nilai Kontrak", bolehHarga ? rp(angka.totalNilai) : "—"],
    ["Belum Terbayar", bolehHarga ? rp(angka.belumTerbayar) : "—"],
  ];

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Vendor Management</div>
      <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>Vendor Management</h2>

      <BarisKpi kpi={kpi} />

      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        <TabelHead
          judul="Daftar Vendor"
          keterangan="Klik nama vendor untuk membuka kontrak, penawaran, dan riwayat pembayarannya."
          aksi={bolehKelola && <TambahVendor />}
        />
        <Tabel
          kolom={[
            { label: "Vendor" },
            { label: "Bidang" },
            { label: "Proyek" },
            { label: "Kontrak", rata: "kanan" },
            bolehHarga && { label: "Nilai Kontrak", rata: "kanan" },
            bolehHarga && { label: "Terbayar", rata: "kanan" },
            bolehHarga && { label: "Progres Bayar", minLebar: 170 },
            { label: "Status" },
            bolehKelola && { lebar: 74 },
          ]}
        >
          {baris.map((v) => (
            <tr key={v.id}>
              <td>
                <Link
                  href={`/vendor/${v.id}`}
                  style={{ fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}
                >
                  {v.nama}
                </Link>
                <div style={{ fontSize: 10.5, color: "var(--muted)" }}>sejak {v.sejak}</div>
              </td>
              <td style={{ color: "var(--muted)" }}>{v.bidang}</td>
              <td style={{ color: "var(--muted)" }}>
                {v.proyek.length ? v.proyek.join(", ") : "—"}
              </td>
              <td style={{ textAlign: "right" }}>{v.jumlahKontrak}</td>
              {bolehHarga && <td className="num" style={{ textAlign: "right" }}>{rp(v.nilai)}</td>}
              {bolehHarga && (
                <td className="num" style={{ textAlign: "right", color: "var(--green)" }}>
                  {rp(v.terbayar)}
                </td>
              )}
              {bolehHarga && (
                <td>
                  {v.nilai ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Track nilai={(v.terbayar / v.nilai) * 100} tinggi={9} warna="var(--green)" />
                      <span style={{ fontSize: 10.5, color: "var(--muted)", width: 40, textAlign: "right" }}>
                        {pct(v.terbayar / v.nilai, 1)}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: 11.5 }}>—</span>
                  )}
                </td>
              )}
              <td>
                <span
                  className="chip"
                  style={{
                    background: v.status === "Aktif" ? "var(--rona-hijau2)" : "var(--rona-abu)",
                    color: v.status === "Aktif" ? "var(--green)" : "var(--muted)",
                  }}
                >
                  {v.status}
                </span>
              </td>
              {bolehKelola && (
                <td>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <UbahVendor
                      vendor={{
                        id: v.id, nama: v.nama, bidang: v.bidang, kontak: v.kontak,
                        alamat: v.alamat, sejak: v.sejak, status: v.status,
                      }}
                    />
                    <HapusVendor id={v.id} nama={v.nama} />
                  </div>
                </td>
              )}
            </tr>
          ))}
        </Tabel>
      </div>
    </div>
  );
}
