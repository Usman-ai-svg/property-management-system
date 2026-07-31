import { redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { dataVendor } from "@/lib/data/vendor";
import { kpiVendor, susunBarisVendor } from "@/lib/tampilan/vendor";
import { pct, rp, tanggal } from "@/lib/format";
import { Badge, BarisKpi, TabelHead, Terbatas, Track, WARNA_STATUS } from "@/components/ui";
import {
  HapusTender, HapusVendor, TambahPeserta, TambahTender, TambahVendor,
  UbahStatusTender, UbahVendor,
} from "./editors-vendor";
import { Tabel } from "@/components/kartu-tabel";

const WARNA_TENDER: Record<string, [string, string]> = {
  Dibuka: ["var(--rona-teal2)", "var(--teal)"],
  Evaluasi: ["var(--rona-amber)", "var(--amber)"],
  Ditetapkan: ["var(--rona-hijau2)", "var(--green)"],
  Batal: ["var(--rona-merah)", "var(--red)"],
};

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
  const { vendor, tender, daftarProyek } = await dataVendor(pengguna, bolehKelola);

  const baris = susunBarisVendor(vendor);
  const angka = kpiVendor(vendor);
  const vendorAktif = vendor.filter((v) => v.status === "Aktif").map((v) => ({ id: v.id, nama: v.nama }));

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

      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        <TabelHead
          judul="Tender / Penawaran Berjalan"
          aksi={bolehKelola && <TambahTender proyek={daftarProyek} />}
        />
        <Tabel
          kolom={[
            { label: "Kode" },
            { label: "Proyek" },
            { label: "Pekerjaan" },
            { label: "Tanggal" },
            bolehHarga && { label: "HPS", rata: "kanan" },
            { label: "Peserta", rata: "kanan" },
            bolehHarga && { label: "Penawaran Terendah", rata: "kanan" },
            { label: "Status" },
            bolehKelola && { lebar: 120 },
          ]}
          kosong="Belum ada tender berjalan."
        >
          {tender.map((t) => {
            const terendah = t.peserta.length ? Math.min(...t.peserta.map((p) => p.nilai)) : 0;
            return (
              <tr key={t.id}>
                <td style={{ fontWeight: 600 }}>{t.kode}</td>
                <td style={{ color: "var(--muted)" }}>{t.project.kode}</td>
                <td style={{ whiteSpace: "normal" }}>{t.pekerjaan}</td>
                <td style={{ color: "var(--muted)" }}>{tanggal(t.tanggal)}</td>
                {bolehHarga && <td className="num" style={{ textAlign: "right" }}>{rp(t.hps)}</td>}
                <td style={{ textAlign: "right" }}>{t.peserta.length}</td>
                {bolehHarga && (
                  <td className="num" style={{ textAlign: "right" }}>
                    {terendah ? rp(terendah) : "—"}
                  </td>
                )}
                <td>
                  <Badge nilai={t.status} peta={WARNA_TENDER} />
                </td>
                {bolehKelola && (
                  <td>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <TambahPeserta tenderId={t.id} kodeTender={t.kode} vendor={vendorAktif} />
                      <UbahStatusTender
                        tender={{
                          id: t.id, kode: t.kode, status: t.status,
                          pemenangVendorId: t.pemenangVendorId,
                          peserta: t.peserta.map((p) => ({
                            vendorId: p.vendorId, nama: p.vendor.nama, nilai: p.nilai,
                          })),
                        }}
                      />
                      <HapusTender id={t.id} kode={t.kode} />
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </Tabel>
      </div>
    </div>
  );
}
