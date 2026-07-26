import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehLihat, bolehUbah, filterProyek } from "@/lib/auth/rbac";
import { ringkasKontrak } from "@/lib/calc/keuangan";
import { pct, rp, tanggal } from "@/lib/format";
import { Badge, TabelHead, Terbatas, Track, WARNA_STATUS } from "@/components/ui";
import {
  HapusTender, HapusVendor, TambahPeserta, TambahTender, TambahVendor,
  UbahStatusTender, UbahVendor,
} from "./editors-vendor";

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
  const vendor = await prisma.vendor.findMany({
    orderBy: { nama: "asc" },
    select: {
      id: true, nama: true, bidang: true, kontak: true, alamat: true, status: true, sejak: true,
      contracts: {
        where: { project: filterProyek(pengguna) },
        select: {
          id: true, nominal: true, retensiPct: true,
          project: { select: { kode: true } },
          pembayaran: { select: { nominal: true } },
          variationOrders: { select: { nominal: true, status: true } },
        },
      },
    },
  });

  const baris = vendor.map((v) => {
    const ringkas = v.contracts.map(ringkasKontrak);
    return {
      ...v,
      proyek: [...new Set(v.contracts.map((k) => k.project.kode))],
      jumlahKontrak: v.contracts.length,
      nilai: ringkas.reduce((s, r) => s + r.nilaiEfektif, 0),
      terbayar: ringkas.reduce((s, r) => s + r.terbayar, 0),
    };
  });

  const tender = await prisma.tender.findMany({
    where: { project: filterProyek(pengguna) },
    orderBy: { tanggal: "desc" },
    select: {
      id: true, kode: true, pekerjaan: true, tanggal: true, hps: true, status: true,
      pemenangVendorId: true,
      project: { select: { kode: true } },
      peserta: { select: { vendorId: true, nilai: true, vendor: { select: { nama: true } } } },
    },
  });

  // Proyek dan vendor untuk formulir tender.
  const daftarProyek = bolehKelola
    ? await prisma.project.findMany({
        where: filterProyek(pengguna),
        orderBy: { kode: "asc" },
        select: { kode: true, nama: true },
      })
    : [];
  const vendorAktif = vendor.filter((v) => v.status === "Aktif").map((v) => ({ id: v.id, nama: v.nama }));

  const totalNilai = baris.reduce((s, v) => s + v.nilai, 0);
  const totalTerbayar = baris.reduce((s, v) => s + v.terbayar, 0);
  const semuaKontrak = vendor.flatMap((v) => v.contracts);
  const kontrakAktif = semuaKontrak.filter((k) => {
    const r = ringkasKontrak(k);
    return r.terbayar < r.nilaiEfektif;
  }).length;

  const kpi: [string, string][] = [
    ["Vendor Terdaftar", String(vendor.length)],
    ["Kontrak Berjalan", `${kontrakAktif} / ${semuaKontrak.length}`],
    ["Nilai Kontrak", bolehHarga ? rp(totalNilai) : "—"],
    ["Belum Terbayar", bolehHarga ? rp(totalNilai - totalTerbayar) : "—"],
  ];

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Vendor Management</div>
      <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>Vendor Management</h2>

      <div className="grid grid4" style={{ marginTop: 16 }}>
        {kpi.map(([label, nilai]) => (
          <div key={label} className="card kpi">
            <div className="eyebrow">{label}</div>
            <div className="v" style={{ fontSize: 15 }}>{nilai}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        <TabelHead
          judul="Daftar Vendor"
          keterangan="Klik nama vendor untuk membuka kontrak, penawaran, dan riwayat pembayarannya."
          aksi={bolehKelola && <TambahVendor />}
        />
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Bidang</th>
                <th>Proyek</th>
                <th style={{ textAlign: "right" }}>Kontrak</th>
                {bolehHarga && <th style={{ textAlign: "right" }}>Nilai Kontrak</th>}
                {bolehHarga && <th style={{ textAlign: "right" }}>Terbayar</th>}
                {bolehHarga && <th style={{ minWidth: 170 }}>Progres Bayar</th>}
                <th>Status</th>
                {bolehKelola && <th style={{ width: 74 }} />}
              </tr>
            </thead>
            <tbody>
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
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        <TabelHead
          judul="Tender / Penawaran Berjalan"
          aksi={bolehKelola && <TambahTender proyek={daftarProyek} />}
        />
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Proyek</th>
                <th>Pekerjaan</th>
                <th>Tanggal</th>
                {bolehHarga && <th style={{ textAlign: "right" }}>HPS</th>}
                <th style={{ textAlign: "right" }}>Peserta</th>
                {bolehHarga && <th style={{ textAlign: "right" }}>Penawaran Terendah</th>}
                <th>Status</th>
                {bolehKelola && <th style={{ width: 120 }} />}
              </tr>
            </thead>
            <tbody>
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
              {tender.length === 0 && (
                <tr>
                  <td colSpan={bolehKelola ? 9 : 8} style={{ textAlign: "center", color: "var(--muted)", padding: 22 }}>
                    Belum ada tender berjalan.
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
