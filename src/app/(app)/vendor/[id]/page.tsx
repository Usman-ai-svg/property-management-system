import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { proyekUntukKontrak as ambilProyekUntukKontrak, vendorDetail } from "@/lib/data/vendor";
import { jatuhTempo, jatuhTempoRetensi, ringkasKontrak, statusBayarKontrak } from "@/lib/calc/keuangan";
import { progresSpk } from "@/lib/calc/kontrak-boq";
import { kumulatifPembayaran, totalKontrakProyek } from "@/lib/tampilan/vendor";
import { peruntukanDariJenisKontrak, type JenisKontrak } from "@/lib/domain/enums";
import { pct, rp, tanggal } from "@/lib/format";
import { Badge, Kartu, KartuKosong, Terbatas, Track, WARNA_STATUS } from "@/components/ui";
import { BatalSelesai, HapusPembayaran, HapusVo, StatusVo, TambahPembayaran, TambahVo, TandaiSelesai } from "./editors";
import { HapusKontrak, TambahKontrak, UbahKontrak } from "../editors-vendor";
import { Tabel } from "@/components/kartu-tabel";

export default async function DetailVendor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  if (!bolehLihat(pengguna, "progress")) {
    return (
      <div style={{ padding: 24 }}>
        <Terbatas apa="Vendor management" />
      </div>
    );
  }

  const { id } = await params;

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const bolehUbahKontrak = bolehUbah(pengguna, "progress");
  const bolehBayar = bolehUbah(pengguna, "keuangan");

  const vendor = await vendorDetail(pengguna, id);

  if (!vendor) notFound();

  // Proyek beserta unit dan sarprasnya, untuk memilih cakupan kontrak baru.
  const proyekUntukKontrak = bolehUbahKontrak
    ? (
        await ambilProyekUntukKontrak(pengguna)
      ).map((p) => ({
        kode: p.kode,
        nama: p.nama,
        units: p.units.map((u) => ({ id: u.id, nama: `Unit ${u.phase.kode}-${u.nomor} · ${u.unitType.nama}` })),
        sarpras: p.infrastructures.map((s) => ({ id: s.id, nama: `${s.nama} · ${s.jenis}` })),
      }))
    : [];

  // Kontrak dikelompokkan per proyek, seperti pada artifact.
  const perProyek = new Map<string, typeof vendor.contracts>();
  for (const k of vendor.contracts) {
    const list = perProyek.get(k.project.kode);
    if (list) list.push(k);
    else perProyek.set(k.project.kode, [k]);
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Vendor Management</div>
      <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>{vendor.nama}</h2>

      <Link
        href="/vendor"
        style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none", display: "inline-block", margin: "10px 0" }}
      >
        ← Kembali ke daftar vendor
      </Link>

      <Kartu padding="14px 18px" bawah={16}>
        <div style={{ display: "flex", gap: 26, flexWrap: "wrap", fontSize: 12.5 }}>
          <div>
            <div className="eyebrow" style={{ fontSize: 10 }}>Bidang</div>
            {vendor.bidang}
          </div>
          <div>
            <div className="eyebrow" style={{ fontSize: 10 }}>Kontak</div>
            {vendor.kontak}
          </div>
          <div>
            <div className="eyebrow" style={{ fontSize: 10 }}>Alamat</div>
            {vendor.alamat}
          </div>
          <div>
            <div className="eyebrow" style={{ fontSize: 10 }}>Vendor sejak</div>
            {vendor.sejak}
          </div>
        </div>
      </Kartu>

      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 12, flexWrap: "wrap", marginBottom: 16,
        }}
      >
        <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>
          Kontrak &amp; Pembayaran
        </div>
        {bolehUbahKontrak && (
          <TambahKontrak vendorId={vendor.id} namaVendor={vendor.nama} proyek={proyekUntukKontrak} />
        )}
      </div>

      {vendor.contracts.length === 0 ? (
        <KartuKosong>
          Vendor ini belum punya kontrak pada proyek yang dapat Anda akses.
        </KartuKosong>
      ) : (
        [...perProyek.entries()].map(([kodeProyek, daftar]) => {
          const ringkas = daftar.map(ringkasKontrak);
          const { nilai: nilaiProyek, terbayar: terbayarProyek } = totalKontrakProyek(ringkas);

          return (
            <div key={kodeProyek} style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  flexWrap: "wrap", gap: 8, padding: "8px 0 10px",
                  borderBottom: "2px solid var(--line)", marginBottom: 12,
                }}
              >
                <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>
                  {daftar[0].project.nama}
                  <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12.5 }}>
                    {" "}· {daftar.length} kontrak
                  </span>
                </div>
                {bolehHarga && (
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    Nilai <b className="num" style={{ color: "var(--text)" }}>{rp(nilaiProyek)}</b> ·
                    terbayar <b className="num" style={{ color: "var(--green)" }}>{rp(terbayarProyek)}</b>
                  </div>
                )}
              </div>

              {daftar.map((k) => {
                const r = ringkasKontrak(k);
                const statusBayar = statusBayarKontrak(k);
                const objek =
                  k.jenis === "Unit"
                    ? k.units.map((x) => `${x.unit.phase.kode}-${x.unit.nomor}`).join(", ")
                    : k.infrastructures.map((x) => x.infrastructure.nama).join(", ");
                const adaOverride = k.units.some((x) => x.nilaiOverride != null);

                // Reminder retensi: jatuh tempo = tanggal selesai + masa pemeliharaan.
                const jtRetensi = jatuhTempoRetensi(k);
                const urgensiRetensi = jtRetensi ? jatuhTempo(jtRetensi, new Date(), 30) : "aman";

                // Progress Vendor SPK — dasar tombol "Tandai Selesai" (aktif di 100%).
                const objekIds = [
                  ...k.units.map((x) => x.unit.id),
                  ...k.infrastructures.map((x) => x.infrastructure.id),
                ];
                const voItemsDisetujui = k.variationOrders
                  .filter((v) => v.status === "Disetujui")
                  .flatMap((v) => v.items);
                const progresSpkKontrak = progresSpk(k.boqItems, k.boqUnit, objekIds, voItemsDisetujui);

                // Objek pilihan untuk baris VO (unit/sarpras cakupan kontrak ini).
                const objekVo = [
                  ...k.units.map((x) => ({
                    nilai: `unit:${x.unit.id}`,
                    label: `Unit ${x.unit.phase.kode}-${x.unit.nomor}`,
                  })),
                  ...k.infrastructures.map((x) => ({
                    nilai: `sarpras:${x.infrastructure.id}`,
                    label: x.infrastructure.nama,
                  })),
                ];

                return (
                  <div key={k.id} className="card" style={{ padding: "18px 20px", marginBottom: 14 }}>
                    <div
                      style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "flex-start", flexWrap: "wrap", gap: 8,
                      }}
                    >
                      <div>
                        <Link
                          href={`/vendor/${vendor.id}/kontrak/${encodeURIComponent(k.kode)}`}
                          className="disp"
                          style={{
                            fontWeight: 600, fontSize: 15,
                            color: "var(--teal)", textDecoration: "none",
                          }}
                        >
                          {k.deskripsi}
                        </Link>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {k.kode} · {k.project.kode} ·{" "}
                          {k.jenis === "Unit" ? `${k.units.length} unit` : "Sarpras"} · mulai{" "}
                          {tanggal(k.mulai)}
                          {k.tanggalSelesai ? ` · selesai ${tanggal(k.tanggalSelesai)}` : ""}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                          Klik nama pekerjaan untuk membuka rincian BOQ dan opname progresnya.
                        </div>
                        {!k.tanggalSelesai && k.boqItems.length > 0 && (
                          <div
                            style={{
                              fontSize: 11, marginTop: 3,
                              color: progresSpkKontrak === 100 ? "var(--green)" : "var(--muted)",
                            }}
                          >
                            Progress Vendor SPK: <b>{progresSpkKontrak}%</b>
                            {progresSpkKontrak < 100 && " · tombol Tandai Selesai aktif saat mencapai 100%"}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        {k.tanggalSelesai ? (
                          <span
                            className="chip"
                            style={{ background: "var(--rona-hijau2)", color: "var(--green)" }}
                          >
                            Selesai {tanggal(k.tanggalSelesai)}
                          </span>
                        ) : (
                          progresSpkKontrak === 100 && bolehUbahKontrak && <TandaiSelesai id={k.id} />
                        )}
                        <Badge nilai={statusBayar} peta={WARNA_STATUS.bayar} />
                        <span
                          className="chip"
                          style={{
                            background: adaOverride ? "var(--rona-amber)" : "var(--rona-abu)",
                            color: adaOverride ? "var(--amber)" : "var(--muted)",
                          }}
                        >
                          {k.jenis === "Unit" ? (adaOverride ? "Override manual" : "Bagi rata") : "Sarpras"}
                        </span>
                        {bolehUbahKontrak && (
                          <>
                            {k.tanggalSelesai && <BatalSelesai id={k.id} />}
                            <UbahKontrak
                              kontrak={{
                                id: k.id, kode: k.kode, deskripsi: k.deskripsi,
                                jenisBiaya: k.jenisBiaya,
                                nominal: k.nominal, retensiPct: k.retensiPct,
                                jatuhTempoBln: k.jatuhTempoBln,
                                mulai: k.mulai.toISOString().slice(0, 10),
                                tanggalSelesai: k.tanggalSelesai
                                  ? k.tanggalSelesai.toISOString().slice(0, 10)
                                  : "",
                                adaBoq: k.boqItems.length > 0,
                              }}
                            />
                            <HapusKontrak id={k.id} kode={k.kode} />
                          </>
                        )}
                      </div>
                    </div>

                    {bolehHarga && (
                      <>
                        <div className="grid grid4" style={{ margin: "14px 0", gap: 12 }}>
                          {(
                            [
                              ["NILAI KONTRAK AWAL", rp(r.nilaiAwal), "var(--ink)"],
                              [
                                "VARIATION ORDER",
                                r.voDisetujui === 0 ? "—" : `${r.voDisetujui > 0 ? "+" : ""}${rp(r.voDisetujui)}`,
                                r.voDisetujui > 0 ? "var(--amber)" : r.voDisetujui < 0 ? "var(--teal)" : "var(--muted)",
                              ],
                              ["NILAI KONTRAK AKHIR", rp(r.nilaiEfektif), "var(--ink)"],
                              ["TERBAYAR", rp(r.terbayar), "var(--green)"],
                              ["BELUM TERBAYAR", rp(r.sisa), "var(--amber)"],
                            ] as [string, string, string][]
                          ).map(([label, nilai, warna]) => (
                            <div key={label}>
                              <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1 }}>{label}</div>
                              <div className="num" style={{ color: warna }}>{nilai}</div>
                            </div>
                          ))}
                        </div>

                        <Track
                          nilai={r.nilaiEfektif ? (r.terbayar / r.nilaiEfektif) * 100 : 0}
                          tinggi={10}
                          warna="var(--green)"
                        />
                        <div
                          style={{
                            display: "flex", justifyContent: "space-between", marginTop: 6,
                            fontSize: 11, color: "var(--muted)", flexWrap: "wrap", gap: 6,
                          }}
                        >
                          <span>{pct(r.persenTerbayar, 1)} terbayar dari nilai akhir</span>
                          {k.retensiPct > 0 && (
                            <span
                              style={{
                                color:
                                  urgensiRetensi === "lewat"
                                    ? "var(--red)"
                                    : urgensiRetensi === "dekat"
                                      ? "var(--amber)"
                                      : "var(--muted)",
                                fontWeight: urgensiRetensi === "aman" ? 400 : 600,
                              }}
                            >
                              Retensi {k.retensiPct}% = {rp(r.retensi)} ·{" "}
                              {jtRetensi
                                ? `jatuh tempo ${tanggal(jtRetensi)}${
                                    urgensiRetensi === "lewat"
                                      ? " — sudah jatuh tempo, lepas retensi"
                                      : urgensiRetensi === "dekat"
                                        ? " — segera jatuh tempo"
                                        : ""
                                  }`
                                : `${k.jatuhTempoBln} bln setelah tanggal selesai (belum ditandai selesai)`}
                            </span>
                          )}
                        </div>
                      </>
                    )}

                    {/* --- variation order --- */}
                    <div style={{ borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 10 }}>
                      <div
                        style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          marginBottom: 6, flexWrap: "wrap", gap: 8,
                        }}
                      >
                        <div className="eyebrow">Variation Order · {k.variationOrders.length} addendum</div>
                        {bolehUbahKontrak && <TambahVo contractId={k.id} objek={objekVo} />}
                      </div>

                      {k.variationOrders.length === 0 ? (
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          Belum ada pekerjaan tambah atau kurang.
                        </div>
                      ) : (
                        <Tabel
                          kolom={[
                            { label: "No.", lebar: 60 },
                            { label: "Tanggal", lebar: 110 },
                            { label: "Uraian" },
                            bolehHarga && { label: "Nominal", rata: "kanan" },
                            { label: "Status", lebar: 92 },
                            bolehUbahKontrak && { label: "", lebar: 120 },
                          ]}
                        >
                          {k.variationOrders.map((v) => (
                            <tr key={v.id}>
                              <td style={{ fontWeight: 600 }}>{v.nomor}</td>
                              <td style={{ color: "var(--muted)" }}>{tanggal(v.tanggal)}</td>
                              <td style={{ whiteSpace: "normal" }}>
                                {v.uraian}
                                <span style={{ color: "var(--muted)", fontSize: 11 }}> · {v.items.length} baris</span>
                              </td>
                              {bolehHarga && (
                                <td
                                  className="num"
                                  style={{
                                    textAlign: "right",
                                    color: v.nominal >= 0 ? "var(--amber)" : "var(--teal)",
                                  }}
                                >
                                  {v.nominal >= 0 ? "+" : "−"}
                                  {rp(Math.abs(v.nominal))}
                                </td>
                              )}
                              <td>
                                <span
                                  className="chip"
                                  style={{
                                    background: v.status === "Disetujui" ? "var(--rona-hijau2)" : "var(--rona-amber)",
                                    color: v.status === "Disetujui" ? "var(--green)" : "var(--amber)",
                                  }}
                                >
                                  {v.status}
                                </span>
                              </td>
                              {bolehUbahKontrak && (
                                <td>
                                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                    <StatusVo id={v.id} status={v.status} />
                                    <HapusVo id={v.id} nomor={v.nomor} />
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                          {bolehHarga && r.voDiajukan !== 0 && (
                            <tr>
                              <td colSpan={3} style={{ color: "var(--muted)" }}>
                                Menunggu persetujuan (belum masuk nilai akhir)
                              </td>
                              <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>
                                {r.voDiajukan >= 0 ? "+" : "−"}
                                {rp(Math.abs(r.voDiajukan))}
                              </td>
                              <td />
                              {bolehUbahKontrak && <td />}
                            </tr>
                          )}
                        </Tabel>
                      )}
                    </div>

                    <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 10 }}>
                      <div className="eyebrow" style={{ marginBottom: 6 }}>Objek pekerjaan</div>
                      <div style={{ fontSize: 12.5 }}>{objek || "—"}</div>
                    </div>

                    {/* --- pembayaran (digabung dari tab Pembayaran) --- */}
                    {bolehHarga && (
                      <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 10 }}>
                        <div
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            marginBottom: 8, flexWrap: "wrap", gap: 8,
                          }}
                        >
                          <div className="eyebrow">
                            Pembayaran · {rp(r.terbayar)} dari {rp(r.nilaiEfektif)}
                          </div>
                          {bolehBayar && r.sisa > 0 && (
                            <TambahPembayaran
                              contractId={k.id}
                              sisa={r.sisa}
                              peruntukan={peruntukanDariJenisKontrak(k.jenis as JenisKontrak)}
                              jenisBiaya={k.jenisBiaya}
                              cakupan={k.units.length + k.infrastructures.length}
                            />
                          )}
                        </div>

                        {k.expenses.length === 0 ? (
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>Belum ada pembayaran.</div>
                        ) : (
                          <Tabel
                            kolom={[
                              { label: "Tanggal", lebar: 110 },
                              { label: "Uraian" },
                              { label: "Nominal", rata: "kanan" },
                              { label: "Kumulatif", rata: "kanan" },
                              bolehBayar && { label: "", lebar: 70 },
                            ]}
                          >
                            {k.expenses.map((p, i, semua) => {
                              const kumulatif = kumulatifPembayaran(semua)[i];
                              return (
                                <tr key={p.id}>
                                  <td style={{ color: "var(--muted)" }}>{tanggal(p.tanggal)}</td>
                                  <td style={{ whiteSpace: "normal" }}>{p.uraian}</td>
                                  <td className="num" style={{ textAlign: "right" }}>{rp(p.total)}</td>
                                  <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>
                                    {rp(kumulatif)}
                                  </td>
                                  {bolehBayar && (
                                    <td style={{ textAlign: "right" }}>
                                      <HapusPembayaran id={p.id} />
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </Tabel>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
