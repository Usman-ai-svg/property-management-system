import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehLihat, bolehUbah, filterProyek } from "@/lib/auth/rbac";
import { ringkasKontrak } from "@/lib/calc/keuangan";
import { pct, rp, tanggal } from "@/lib/format";
import { Badge, Terbatas, Track, WARNA_STATUS } from "@/components/ui";
import { TambahPembayaran, TambahVo } from "./editors";
import { HapusKontrak, TambahKontrak, UbahKontrak } from "../editors-vendor";
import { Tabel } from "@/components/kartu-tabel";

const TAB = [
  ["kontrak", "Kontrak"],
  ["tender", "Penawaran"],
  ["progres", "Progress Pekerjaan"],
  ["bayar", "Pembayaran"],
] as const;

export default async function DetailVendor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
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
  const { tab = "kontrak" } = await searchParams;
  const tabAktif = TAB.some(([t]) => t === tab) ? tab : "kontrak";

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const bolehUbahKontrak = bolehUbah(pengguna, "progress");
  const bolehBayar = bolehUbah(pengguna, "keuangan");

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: {
      id: true, nama: true, bidang: true, kontak: true, alamat: true, sejak: true, status: true,
      contracts: {
        where: { project: filterProyek(pengguna) },
        orderBy: { mulai: "desc" },
        select: {
          id: true, kode: true, jenis: true, deskripsi: true, nominal: true,
          retensiPct: true, jatuhTempoBln: true, mulai: true,
          project: { select: { kode: true, nama: true } },
          pembayaran: { orderBy: { tanggal: "asc" }, select: { id: true, tanggal: true, uraian: true, nominal: true } },
          variationOrders: {
            orderBy: { tanggal: "asc" },
            select: { id: true, nomor: true, tanggal: true, uraian: true, nominal: true, status: true },
          },
          units: {
            select: {
              nilaiOverride: true,
              unit: {
                select: {
                  id: true, nomor: true, progress: true, statusPembangunan: true,
                  phase: { select: { kode: true } },
                  unitType: { select: { nama: true } },
                },
              },
            },
          },
          infrastructures: {
            select: {
              infrastructure: {
                select: { id: true, nama: true, jenis: true, progress: true, status: true },
              },
            },
          },
        },
      },
      tenderPeserta: {
        where: { tender: { project: filterProyek(pengguna) } },
        select: {
          id: true, nilai: true, dokumen: true,
          tender: {
            select: {
              id: true, kode: true, pekerjaan: true, tanggal: true, hps: true, status: true,
              pemenangVendorId: true,
              project: { select: { kode: true } },
              peserta: { select: { nilai: true } },
            },
          },
        },
      },
    },
  });

  if (!vendor) notFound();

  // Proyek beserta unit dan sarprasnya, untuk memilih cakupan kontrak baru.
  const proyekUntukKontrak = bolehUbahKontrak
    ? (
        await prisma.project.findMany({
          where: filterProyek(pengguna),
          orderBy: { kode: "asc" },
          select: {
            kode: true, nama: true,
            units: {
              orderBy: [{ phase: { urutan: "asc" } }, { nomor: "asc" }],
              select: { id: true, nomor: true, phase: { select: { kode: true } }, unitType: { select: { nama: true } } },
            },
            infrastructures: { orderBy: { kode: "asc" }, select: { id: true, nama: true, jenis: true } },
          },
        })
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

      <div className="card" style={{ padding: "14px 18px", marginBottom: 16 }}>
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
      </div>

      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 12, flexWrap: "wrap", marginBottom: 16,
        }}
      >
        <div className="tabbar" style={{ marginBottom: 0 }}>
          {TAB.map(([id2, label]) => (
            <Link key={id2} href={`?tab=${id2}`} className={"tab" + (tabAktif === id2 ? " active" : "")}>
              {label}
            </Link>
          ))}
        </div>
        {tabAktif === "kontrak" && bolehUbahKontrak && (
          <TambahKontrak vendorId={vendor.id} namaVendor={vendor.nama} proyek={proyekUntukKontrak} />
        )}
      </div>

      {/* ================= KONTRAK ================= */}
      {tabAktif === "kontrak" &&
        (vendor.contracts.length === 0 ? (
          <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>
            Vendor ini belum punya kontrak pada proyek yang dapat Anda akses.
          </div>
        ) : (
          [...perProyek.entries()].map(([kodeProyek, daftar]) => {
            const ringkas = daftar.map(ringkasKontrak);
            const nilaiProyek = ringkas.reduce((s, r) => s + r.nilaiEfektif, 0);
            const terbayarProyek = ringkas.reduce((s, r) => s + r.terbayar, 0);

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
                  const objek =
                    k.jenis === "Unit"
                      ? k.units.map((x) => `${x.unit.phase.kode}-${x.unit.nomor}`).join(", ")
                      : k.infrastructures.map((x) => x.infrastructure.nama).join(", ");
                  const adaOverride = k.units.some((x) => x.nilaiOverride != null);

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
                            href={`/vendor/${vendor.id}/kontrak/${k.kode}`}
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
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                            Klik nama pekerjaan untuk membuka rincian BOQ dan opname progresnya.
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
                              <UbahKontrak
                                kontrak={{
                                  id: k.id, kode: k.kode, deskripsi: k.deskripsi,
                                  nominal: k.nominal, retensiPct: k.retensiPct,
                                  jatuhTempoBln: k.jatuhTempoBln,
                                  mulai: k.mulai.toISOString().slice(0, 10),
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
                              <span>
                                Retensi {k.retensiPct}% = {rp(r.retensi)} · jatuh tempo {k.jatuhTempoBln} bln
                                setelah pelunasan
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
                          {bolehUbahKontrak && <TambahVo contractId={k.id} />}
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
                            ]}
                          >
                            {k.variationOrders.map((v) => (
                              <tr key={v.id}>
                                <td style={{ fontWeight: 600 }}>{v.nomor}</td>
                                <td style={{ color: "var(--muted)" }}>{tanggal(v.tanggal)}</td>
                                <td style={{ whiteSpace: "normal" }}>{v.uraian}</td>
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
                              </tr>
                            )}
                          </Tabel>
                        )}
                      </div>

                      <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 10 }}>
                        <div className="eyebrow" style={{ marginBottom: 6 }}>Objek pekerjaan</div>
                        <div style={{ fontSize: 12.5 }}>{objek || "—"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        ))}

      {/* ================= PENAWARAN ================= */}
      {tabAktif === "tender" &&
        (vendor.tenderPeserta.length === 0 ? (
          <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>
            Vendor ini belum pernah ikut tender.
          </div>
        ) : (
          vendor.tenderPeserta.map((p) => {
            const t = p.tender;
            const terendah = Math.min(...t.peserta.map((x) => x.nilai));
            const menang = t.pemenangVendorId === vendor.id;

            return (
              <div key={p.id} className="card" style={{ padding: "16px 20px", marginBottom: 14 }}>
                <div
                  style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "flex-start", flexWrap: "wrap", gap: 8,
                  }}
                >
                  <div>
                    <div className="disp" style={{ fontWeight: 600, fontSize: 15 }}>{t.pekerjaan}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {t.kode} · {t.project.kode} · dibuka {tanggal(t.tanggal)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {menang && (
                      <span className="chip" style={{ background: "var(--rona-hijau2)", color: "var(--green)" }}>
                        Pemenang
                      </span>
                    )}
                    <span className="chip" style={{ background: "var(--rona-teal)", color: "var(--teal)" }}>
                      {t.status}
                    </span>
                  </div>
                </div>

                {bolehHarga && (
                  <div className="grid grid4" style={{ marginTop: 14, gap: 12 }}>
                    {(
                      [
                        ["HPS", rp(t.hps)],
                        ["PENAWARAN VENDOR", rp(p.nilai)],
                        ["PENAWARAN TERENDAH", rp(terendah)],
                        ["SELISIH THD HPS", `${p.nilai <= t.hps ? "−" : "+"}${rp(Math.abs(t.hps - p.nilai))}`],
                      ] as [string, string][]
                    ).map(([label, nilai]) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1 }}>{label}</div>
                        <div className="num">{nilai}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
                  Kelengkapan dokumen:{" "}
                  <b style={{ color: p.dokumen === "Lengkap" ? "var(--green)" : "var(--amber)" }}>
                    {p.dokumen}
                  </b>{" "}
                  · {t.peserta.length} peserta
                </div>
              </div>
            );
          })
        ))}

      {/* ================= PROGRESS PEKERJAAN ================= */}
      {tabAktif === "progres" && (
        <Tabel
          kelasBungkus="card tablewrap"
          kolom={[
            { label: "Kontrak" },
            { label: "Objek" },
            { label: "Jenis" },
            { label: "Progress", minLebar: 190 },
            { label: "Status" },
          ]}
          kosong="Belum ada pekerjaan yang dikontrakkan ke vendor ini."
        >
          {vendor.contracts.flatMap((k) => [
            ...k.units.map((x) => (
              <tr key={`u-${k.id}-${x.unit.id}`}>
                <td style={{ color: "var(--muted)" }}>{k.kode}</td>
                <td style={{ fontWeight: 600 }}>
                  Unit {x.unit.phase.kode}-{x.unit.nomor}
                </td>
                <td>{x.unit.unitType.nama}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Track
                      nilai={x.unit.progress}
                      tinggi={9}
                      warna={x.unit.progress === 100 ? "var(--green)" : "var(--teal)"}
                    />
                    <span style={{ fontSize: 11, color: "var(--muted)", width: 30 }}>
                      {x.unit.progress}%
                    </span>
                  </div>
                </td>
                <td>
                  <Badge nilai={x.unit.statusPembangunan} peta={WARNA_STATUS.bangun} />
                </td>
              </tr>
            )),
            ...k.infrastructures.map((x) => (
              <tr key={`s-${k.id}-${x.infrastructure.id}`}>
                <td style={{ color: "var(--muted)" }}>{k.kode}</td>
                <td style={{ fontWeight: 600 }}>{x.infrastructure.nama}</td>
                <td>{x.infrastructure.jenis}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Track
                      nilai={x.infrastructure.progress}
                      tinggi={9}
                      warna={x.infrastructure.progress === 100 ? "var(--green)" : "var(--brass)"}
                    />
                    <span style={{ fontSize: 11, color: "var(--muted)", width: 30 }}>
                      {x.infrastructure.progress}%
                    </span>
                  </div>
                </td>
                <td>
                  <Badge nilai={x.infrastructure.status} peta={WARNA_STATUS.bangun} />
                </td>
              </tr>
            )),
          ])}
        </Tabel>
      )}

      {/* ================= PEMBAYARAN ================= */}
      {tabAktif === "bayar" &&
        (!bolehHarga ? (
          <Terbatas apa="Riwayat pembayaran" />
        ) : vendor.contracts.length === 0 ? (
          <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>
            Belum ada kontrak.
          </div>
        ) : (
          vendor.contracts.map((k) => {
            const r = ringkasKontrak(k);
            return (
              <div key={k.id} className="card" style={{ padding: "16px 20px", marginBottom: 14 }}>
                <div
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    flexWrap: "wrap", gap: 8, marginBottom: 10,
                  }}
                >
                  <div>
                    <div className="disp" style={{ fontWeight: 600, fontSize: 14.5 }}>{k.deskripsi}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      {k.kode} · {k.project.kode} · {rp(r.terbayar)} dari {rp(r.nilaiEfektif)}
                    </div>
                  </div>
                  {bolehBayar && r.sisa > 0 && (
                    <TambahPembayaran contractId={k.id} sisa={r.sisa} />
                  )}
                </div>

                {k.pembayaran.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Belum ada pembayaran.</div>
                ) : (
                  <Tabel
                    kolom={[
                      { label: "Tanggal", lebar: 110 },
                      { label: "Uraian" },
                      { label: "Nominal", rata: "kanan" },
                      { label: "Kumulatif", rata: "kanan" },
                    ]}
                  >
                    {k.pembayaran.map((p, i) => {
                      const kumulatif = k.pembayaran
                        .slice(0, i + 1)
                        .reduce((s, x) => s + x.nominal, 0);
                      return (
                        <tr key={p.id}>
                          <td style={{ color: "var(--muted)" }}>{tanggal(p.tanggal)}</td>
                          <td style={{ whiteSpace: "normal" }}>{p.uraian}</td>
                          <td className="num" style={{ textAlign: "right" }}>{rp(p.nominal)}</td>
                          <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>
                            {rp(kumulatif)}
                          </td>
                        </tr>
                      );
                    })}
                  </Tabel>
                )}
              </div>
            );
          })
        ))}
    </div>
  );
}
