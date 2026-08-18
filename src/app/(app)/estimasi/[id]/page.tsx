import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ambilPengguna, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { detailRabEstimasi, nomorSpkBerikutnya, objekProyek, vendorUntukPembanding } from "@/lib/data/estimasi";
import { hargaSatuanDb, ringkasEstimasi } from "@/lib/tampilan/estimasi";
import { rekapPemenang } from "@/lib/calc/tender";
import { rp, tanggal } from "@/lib/format";
import { Badge, Petunjuk } from "@/components/ui";
import { UbahRabEstimasi, type KatalogItem } from "../editors";
import { TabelRincianRab } from "../tabel";
import { AjukanRab, SetujuiRab, TolakRab } from "./aksi-status";
import { MatriksPerbandingan, TambahVendorPembanding, UnduhTemplateBoq } from "./perbandingan";
import { BuatSpkDariMenang } from "./buat-spk";

const WARNA_STATUS: Record<string, [string, string]> = {
  Draft: ["var(--rona-amber)", "var(--amber)"],
  Diajukan: ["var(--rona-biru)", "var(--blue)"],
  Ditolak: ["var(--rona-merah)", "var(--red)"],
  Final: ["var(--rona-hijau2)", "var(--green)"],
};

export default async function DetailRabEstimasi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");
  if (!bolehLihat(pengguna, "hargaRabRap")) redirect("/");

  const { estimasi, katalog } = await detailRabEstimasi(pengguna, id);

  // Isi RAB hanya bisa diubah saat Draft/Ditolak; status berpindah lewat tombol.
  const editable = estimasi.status === "Draft" || estimasi.status === "Ditolak";
  const bolehKelola = bolehUbah(pengguna, "hargaRabRap") && editable;
  const bolehAjukan = bolehUbah(pengguna, "hargaRabRap") && editable && estimasi.items.length > 0;
  const bolehSetuju = bolehUbah(pengguna, "setujuiRab") && estimasi.status === "Diajukan";

  const rekap = ringkasEstimasi(estimasi.items);
  const katalogUi: KatalogItem[] = katalog.map((a) => ({
    id: a.id, kode: a.kode, uraian: a.uraian, satuan: a.satuan, kelompok: a.kelompok,
    hargaSatuan: hargaSatuanDb(a),
  }));

  // --- Perbandingan penawaran vendor: aktif hanya saat RAB Final ---
  const bolehKelolaHarga = bolehUbah(pengguna, "hargaRabRap");
  const bolehKontrak = bolehUbah(pengguna, "progress");
  const finalRab = estimasi.status === "Final";

  const vendors = estimasi.pembanding.map((p) => ({
    vendorId: p.vendorId, nama: p.vendor.nama, bidang: p.vendor.bidang,
  }));
  const namaVendor = new Map(vendors.map((v) => [v.vendorId, v.nama]));
  const itemsBanding = estimasi.items.map((it) => ({
    id: it.id, grup: it.grup, uraian: it.uraian, satuan: it.satuan, volume: it.volume,
    hpsHargaSatuan: it.hargaSatuan, pemenangVendorId: it.pemenangVendorId,
    bids: it.penawaran.map((b) => ({ vendorId: b.vendorId, hargaSatuan: b.hargaSatuan })),
  }));
  const rekapMenang = finalRab ? rekapPemenang(itemsBanding) : null;

  const semuaVendor = finalRab && bolehKelolaHarga ? await vendorUntukPembanding() : [];
  const sudahBanding = new Set(vendors.map((v) => v.vendorId));
  const kandidat = semuaVendor.filter((v) => !sudahBanding.has(v.id));
  const objek = finalRab && bolehKontrak ? await objekProyek(estimasi.projectId) : { units: [], sarpras: [] };
  const nomorSpk = finalRab && bolehKontrak
    ? await nomorSpkBerikutnya(estimasi.project.kode)
    : { K: "001", S: "001", tahun: new Date().getFullYear() };

  return (
    <div style={{ padding: 24 }}>
      <Link
        href="/estimasi"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)", textDecoration: "none" }}
      >
        <ArrowLeft size={14} /> Kembali ke daftar
      </Link>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">{estimasi.project.kode} — {estimasi.project.nama}</div>
          <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>
            {estimasi.nomor} · {estimasi.nama}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <Badge nilai={estimasi.status} peta={WARNA_STATUS} />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Dibuat {tanggal(estimasi.tanggal)}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {bolehKelola && (
            <UbahRabEstimasi rab={{ id: estimasi.id, nomor: estimasi.nomor, nama: estimasi.nama, status: estimasi.status }} />
          )}
          {bolehAjukan && <AjukanRab id={estimasi.id} />}
          {bolehSetuju && (
            <>
              <SetujuiRab id={estimasi.id} />
              <TolakRab id={estimasi.id} />
            </>
          )}
        </div>
      </div>

      {(estimasi.diajukanOleh || estimasi.diputusOleh) && (
        <div className="card" style={{ marginTop: 12, padding: "10px 14px", fontSize: 12, color: "var(--muted)", display: "flex", flexWrap: "wrap", gap: "4px 18px" }}>
          {estimasi.diajukanOleh && (
            <span>Diajukan oleh <b style={{ color: "var(--text)" }}>{estimasi.diajukanOleh}</b> · {tanggal(estimasi.diajukanPada)}</span>
          )}
          {estimasi.status === "Final" && estimasi.diputusOleh && (
            <span>Disetujui oleh <b style={{ color: "var(--green)" }}>{estimasi.diputusOleh}</b> · {tanggal(estimasi.diputusPada)}</span>
          )}
          {estimasi.status === "Ditolak" && (
            <span style={{ color: "var(--red)" }}>
              Ditolak oleh <b>{estimasi.diputusOleh}</b> · {tanggal(estimasi.diputusPada)}
              {estimasi.catatanTolak ? ` — "${estimasi.catatanTolak}"` : ""}
            </span>
          )}
        </div>
      )}

      {!editable && (
        <Petunjuk jarak="10px 0 0">
          RAB berstatus {estimasi.status} terkunci dari perubahan. {estimasi.status === "Diajukan" ? "Menunggu keputusan penyetuju." : "Sudah final."}
        </Petunjuk>
      )}

      <div className="card" style={{ marginTop: 16, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="eyebrow">Total RAB Estimasi</div>
          <div className="disp" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{rp(rekap.total)}</div>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "right" }}>
          {estimasi.items.length} baris pekerjaan<br />{rekap.grup.length} grup
        </div>
      </div>

      <TabelRincianRab
        rabEstimasiId={estimasi.id}
        bolehKelola={bolehKelola}
        katalog={katalogUi}
        items={estimasi.items.map((it) => ({
          id: it.id, analisaId: it.analisaId, grup: it.grup, uraian: it.uraian,
          satuan: it.satuan, spesifikasi: it.spesifikasi, volume: it.volume, hargaSatuan: it.hargaSatuan,
        }))}
      />

      {/* ================= PERBANDINGAN PENAWARAN VENDOR (hanya saat Final) ================= */}
      {finalRab && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="eyebrow">Pengadaan · Perbandingan Penawaran</div>
              <Petunjuk jarak="4px 0 0">
                RAB sudah Final — bandingkan penawaran vendor terhadap harga acuan (HPS), lalu tetapkan
                pemenang per grup dan terbitkan SPK-nya.
              </Petunjuk>
            </div>
            {bolehKelolaHarga && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <UnduhTemplateBoq rabEstimasiId={estimasi.id} />
                <TambahVendorPembanding rabEstimasiId={estimasi.id} kandidat={kandidat} />
              </div>
            )}
          </div>

          {vendors.length === 0 ? (
            <div className="card" style={{ marginTop: 12, padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
              Belum ada vendor pembanding. Tambahkan minimal dua vendor, lalu unduh template BOQ untuk
              dikirim ke mereka.
            </div>
          ) : (
            <MatriksPerbandingan
              rabEstimasiId={estimasi.id}
              bolehKelola={bolehKelolaHarga}
              vendors={vendors}
              items={itemsBanding}
            />
          )}

          {rekapMenang && rekapMenang.perVendor.length > 0 && (
            <div className="card" style={{ marginTop: 16, padding: "14px 18px" }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Ringkasan Pemenang</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rekapMenang.perVendor.map((v) => (
                  <div key={v.vendorId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", paddingBottom: 8, borderBottom: "1px solid var(--garis-halus)" }}>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{namaVendor.get(v.vendorId) ?? "—"}</span>
                      <span style={{ color: "var(--muted)" }}> · {v.jumlahBaris} baris menang</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span className="num" style={{ fontWeight: 700 }}>{rp(v.total)}</span>
                      {bolehKontrak && (
                        <BuatSpkDariMenang
                          rabEstimasiId={estimasi.id}
                          vendorId={v.vendorId}
                          namaVendor={namaVendor.get(v.vendorId) ?? ""}
                          jumlahBaris={v.jumlahBaris}
                          nilai={v.total}
                          proyek={objek}
                          projectKode={estimasi.project.kode}
                          nomorBerikut={nomorSpk}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
