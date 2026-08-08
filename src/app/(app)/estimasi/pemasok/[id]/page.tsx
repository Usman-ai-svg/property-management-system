import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ambilPengguna, bolehLihat } from "@/lib/auth/rbac";
import { detailPemasok } from "@/lib/data/estimasi";
import { rp, tanggal } from "@/lib/format";
import { Badge, BarisKpi, Kartu, KartuKosong } from "@/components/ui";
import { Tabel } from "@/components/kartu-tabel";

const WARNA_KATEGORI: Record<string, [string, string]> = {
  Material: ["var(--rona-biru)", "var(--blue)"],
  "Tenaga Kerja": ["var(--rona-teal2)", "var(--teal)"],
  Alat: ["var(--rona-amber)", "var(--amber)"],
};
const WARNA_AKTIF: Record<string, [string, string]> = {
  Aktif: ["var(--rona-hijau2)", "var(--green)"],
  Nonaktif: ["var(--rona-abu)", "var(--muted)"],
};
const WARNA_STATUS_PO: Record<string, [string, string]> = {
  Draft: ["var(--rona-amber)", "var(--amber)"],
  Diterima: ["var(--rona-biru)", "var(--blue)"],
  Lunas: ["var(--rona-hijau2)", "var(--green)"],
};

export default async function DetailPemasok({ params }: { params: Promise<{ id: string }> }) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");
  if (!bolehLihat(pengguna, "hargaRabRap")) redirect("/");

  const { id } = await params;
  const pemasok = await detailPemasok(id);

  // Ringkasan nilai: total pembelian, terbayar, dan hutang berjalan. Pembelian
  // (PO) kini dikelola di Keuangan Proyek — di sini hanya ditampilkan riwayatnya.
  const pembelian = pemasok.pembelian.map((b) => {
    const total = b.items.reduce((s, it) => s + it.qty * it.harga, 0);
    const terbayar = b.pembayaran.reduce((s, e) => s + e.total, 0);
    const hutang = total - terbayar;
    const statusTampil = total > 0 && hutang <= 0 ? "Lunas" : b.status;
    return { ...b, total, terbayar, hutang, statusTampil };
  });
  const totalBeli = pembelian.reduce((s, b) => s + b.total, 0);
  const totalBayar = pembelian.reduce((s, b) => s + b.terbayar, 0);
  const totalHutang = totalBeli - totalBayar;

  return (
    <div style={{ padding: 24 }}>
      <Link
        href="/estimasi/pemasok"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)", textDecoration: "none" }}
      >
        <ArrowLeft size={14} /> Kembali ke Pemasok
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
        <div>
          <div className="eyebrow">Master Proyek · Estimasi RAB · Pemasok</div>
          <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>{pemasok.nama}</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
            <Badge nilai={pemasok.kategori} peta={WARNA_KATEGORI} />
            <Badge nilai={pemasok.status} peta={WARNA_AKTIF} />
          </div>
        </div>
      </div>

      <Kartu atas={16} gaya={{ display: "flex", flexWrap: "wrap", gap: 24, fontSize: 12.5 }}>
        <div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>Kontak</div>
          <div>{pemasok.kontak || "—"}</div>
        </div>
        <div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>Alamat</div>
          <div>{pemasok.alamat || "—"}</div>
        </div>
      </Kartu>

      <BarisKpi
        kpi={[
          ["Penawaran Diberikan", String(pemasok.penawaran.length)],
          ["Total Pembelian", rp(totalBeli)],
          ["Sudah Dibayar", rp(totalBayar)],
          ["Hutang Berjalan", rp(totalHutang)],
        ]}
      />

      {/* --- PENAWARAN --- */}
      <Kartu atas={16} padding={0}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
          <div className="eyebrow">Penawaran Harga</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
            Harga yang pernah ditawarkan pemasok ini atas harga dasar di pustaka.
          </div>
        </div>
        <Tabel
          kolom={[
            { label: "Harga Dasar", minLebar: 220 }, { label: "Kategori" }, { label: "Harga", rata: "kanan" },
            { label: "Keterangan", minLebar: 160 }, { label: "Tanggal" },
          ]}
          kosong="Belum ada penawaran dari pemasok ini."
        >
          {pemasok.penawaran.map((t) => (
            <tr key={t.id}>
              <td>
                <Link href="/estimasi/pustaka" style={{ color: "var(--blue)", textDecoration: "none" }}>
                  <span style={{ fontWeight: 600 }}>{t.hargaDasar.kode}</span>
                  <span style={{ color: "var(--muted)" }}> · {t.hargaDasar.uraian}</span>
                </Link>
              </td>
              <td><Badge nilai={t.hargaDasar.kategori} peta={WARNA_KATEGORI} /></td>
              <td className="num" style={{ textAlign: "right" }}>{rp(t.harga)}</td>
              <td style={{ color: "var(--muted)", whiteSpace: "normal" }}>{t.keterangan ?? "—"}</td>
              <td style={{ color: "var(--muted)" }}>{tanggal(t.tanggal)}</td>
            </tr>
          ))}
        </Tabel>
      </Kartu>

      {/* --- RIWAYAT PEMBELIAN (read-only) --- */}
      <div className="eyebrow" style={{ marginTop: 20 }}>Riwayat Pembelian (PO)</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "2px 0 8px", lineHeight: 1.5 }}>
        Pembelian material kini dibuat & dibayar dari{" "}
        <Link href="/keuangan" style={{ color: "var(--teal)", fontWeight: 600 }}>Keuangan Proyek</Link>{" "}
        (per proyek, dengan alur PO). Di sini hanya ditampilkan riwayatnya.
      </div>
      {pembelian.length === 0 ? (
        <KartuKosong>Belum ada pembelian dari pemasok ini.</KartuKosong>
      ) : (
        pembelian.map((b) => (
          <Kartu key={b.id} atas={10} padding={0}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  {b.nomor}
                  <Badge nilai={b.statusTampil} peta={WARNA_STATUS_PO} />
                  <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {b.project.kode} — {b.project.nama}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>
                  {tanggal(b.tanggal)}{b.keterangan ? ` · ${b.keterangan}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ textAlign: "right", fontSize: 11.5 }}>
                  <span style={{ color: "var(--muted)" }}>Hutang </span>
                  <span style={{ fontWeight: 700, color: b.hutang > 0 ? "var(--red)" : "var(--green)" }}>{rp(b.hutang)}</span>
                </div>
              </div>
            </div>

            <Tabel
              kolom={[
                { label: "Barang", minLebar: 220 }, { label: "Satuan" }, { label: "Qty", rata: "kanan" },
                { label: "Harga", rata: "kanan" }, { label: "Jumlah", rata: "kanan" },
              ]}
              kosong="Tidak ada barang."
            >
              {b.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.uraian}</td>
                  <td style={{ color: "var(--muted)" }}>{it.satuan}</td>
                  <td style={{ textAlign: "right" }}>{it.qty.toLocaleString("id-ID")}</td>
                  <td className="num" style={{ textAlign: "right" }}>{rp(it.harga)}</td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>{rp(it.qty * it.harga)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid var(--line)" }}>
                <td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>Total Nota</td>
                <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{rp(b.total)}</td>
              </tr>
            </Tabel>

            {/* Termin pembayaran */}
            <div style={{ padding: "8px 16px 12px", borderTop: "1px solid var(--line)", background: "var(--rona-abu)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
                Termin Pembayaran · terbayar {rp(b.terbayar)} dari {rp(b.total)}
              </div>
              {b.pembayaran.length === 0 ? (
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Belum ada pembayaran.</div>
              ) : (
                <table style={{ width: "100%", fontSize: 11.5 }}>
                  <tbody>
                    {b.pembayaran.map((e) => (
                      <tr key={e.id}>
                        <td style={{ padding: "2px 6px", color: "var(--muted)", width: 96 }}>{tanggal(e.tanggal)}</td>
                        <td style={{ padding: "2px 6px" }}>{e.uraian}</td>
                        <td style={{ padding: "2px 6px", color: "var(--muted)", width: 90 }}>{e.metode}</td>
                        <td className="num" style={{ padding: "2px 6px", textAlign: "right", fontWeight: 600, width: 120 }}>{rp(e.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Kartu>
        ))
      )}
    </div>
  );
}
