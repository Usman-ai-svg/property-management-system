import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehAksesProyek, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { kelompokkanRap, totalBaris } from "@/lib/calc/boq";
import { pct, rp } from "@/lib/format";
import { Badge, JudulHalaman, Kpi, Terbatas, WARNA_STATUS } from "@/components/ui";
import { EditBarisBoq, EditBarisRap, EditUpahDanHarga } from "./editors";

export default async function RincianUnit({
  params,
}: {
  params: Promise<{ kode: string; unitKode: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode, unitKode } = await params;
  const kodeProyek = kode.toUpperCase();

  // Halaman ini seluruhnya berisi angka harga. Peran yang tidak berhak tidak
  // diberi versi "kosong" — halamannya memang tidak ada untuk mereka.
  if (!bolehLihat(pengguna, "hargaRabRap")) {
    return (
      <div style={{ padding: "26px 28px 40px" }}>
        <Link href={`/master/${kodeProyek}`} style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}>
          ← {kodeProyek}
        </Link>
        <div style={{ marginTop: 16 }}>
          <Terbatas apa="Rincian RAB dan RAP unit" />
        </div>
      </div>
    );
  }

  const unit = await prisma.unit.findUnique({
    where: { kode: decodeURIComponent(unitKode).toUpperCase() },
    select: {
      id: true, kode: true, nomor: true, luasTanah: true, projectId: true,
      statusPembangunan: true, statusJual: true, progress: true,
      hargaJual: true, rapUpah: true,
      phase: { select: { kode: true } },
      project: { select: { kode: true, nama: true } },
      unitType: { select: { kode: true, nama: true, luasBangunan: true } },
      boqItems: {
        orderBy: { urutan: "asc" },
        select: {
          id: true, grup: true, uraian: true, satuan: true,
          volume: true, hargaSatuan: true, spesifikasi: true,
        },
      },
      rapItems: {
        orderBy: { urutan: "asc" },
        select: {
          id: true, grup: true, nama: true, satuan: true,
          volume: true, hargaSatuan: true, keterangan: true,
        },
      },
      customWorks: {
        select: {
          id: true, judul: true, rapUpah: true,
          boqItems: {
            orderBy: { urutan: "asc" },
            select: { id: true, uraian: true, satuan: true, volume: true, hargaSatuan: true, spesifikasi: true },
          },
        },
      },
    },
  });

  if (!unit || unit.project.kode !== kodeProyek) notFound();
  if (!bolehAksesProyek(pengguna, unit.projectId)) notFound();

  const bisaUbah = bolehUbah(pengguna, "hargaRabRap");
  const label = `${unit.phase.kode}-${unit.nomor}`;

  const rabStandar = totalBaris(unit.boqItems);
  const kerjaTambah = unit.customWorks.reduce((s, c) => s + totalBaris(c.boqItems), 0);
  const rab = rabStandar + kerjaTambah;

  const rapMaterial = totalBaris(unit.rapItems);
  const rap = rapMaterial + unit.rapUpah;
  const grupRap = kelompokkanRap(unit.rapItems);

  const margin = unit.hargaJual ? (unit.hargaJual - rab) / unit.hargaJual : 0;

  return (
    <div style={{ padding: "26px 28px 40px" }}>
      <Link href={`/master/${kodeProyek}`} style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}>
        ← {unit.project.nama}
      </Link>

      <div style={{ marginTop: 12 }}>
        <JudulHalaman
          judul={`Unit ${label}`}
          keterangan={`${unit.unitType.nama} · LB ${unit.unitType.luasBangunan} m² / LT ${unit.luasTanah} m² · ${unit.kode}`}
          kanan={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge nilai={unit.statusPembangunan} peta={WARNA_STATUS.bangun} />
              <Badge nilai={unit.statusJual} peta={WARNA_STATUS.jual} />
            </div>
          }
        />
      </div>

      <div className="grid grid4">
        <Kpi
          label="RAB"
          nilai={rp(rab)}
          catatan={kerjaTambah > 0 ? `termasuk kerja tambah ${rp(kerjaTambah)}` : "dari baris BOQ tersimpan"}
        />
        <Kpi label="RAP" nilai={rp(rap)} catatan={`material ${rp(rapMaterial)} + upah ${rp(unit.rapUpah)}`} />
        <Kpi label="Harga jual" nilai={rp(unit.hargaJual)} catatan={`margin kotor ${pct(margin, 1)}`} />
        <Kpi label="Progres" nilai={`${unit.progress}%`} catatan={unit.statusPembangunan} />
      </div>

      {/* ---------- BOQ ---------- */}
      <div className="sectitle" style={{ justifyContent: "space-between" }}>
        <span>Bill of Quantity (RAB)</span>
        {bisaUbah && (
          <EditUpahDanHarga data={{ id: unit.id, rapUpah: unit.rapUpah, hargaJual: unit.hargaJual }} />
        )}
      </div>

      <div className="card" style={{ padding: "10px 14px", marginBottom: 10, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
        Baris di bawah adalah <strong style={{ color: "var(--text)" }}>salinan milik unit ini</strong>, dibuat
        saat unit dibentuk. Mengubahnya tidak memengaruhi unit lain, dan mengubah template harga tidak
        memengaruhi baris ini.
      </div>

      <div className="card tablewrap">
        <table>
          <thead>
            <tr>
              <th>Grup</th>
              <th>Uraian</th>
              <th>Satuan</th>
              <th style={{ textAlign: "right" }}>Volume</th>
              <th style={{ textAlign: "right" }}>Harga satuan</th>
              <th style={{ textAlign: "right" }}>Subtotal</th>
              <th style={{ textAlign: "right" }}>Bobot</th>
              {bisaUbah && <th style={{ width: 44 }} />}
            </tr>
          </thead>
          <tbody>
            {unit.boqItems.map((b) => {
              const sub = b.volume * b.hargaSatuan;
              return (
                <tr key={b.id}>
                  <td style={{ color: "var(--muted)", fontSize: 11.5 }}>{b.grup}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{b.uraian}</div>
                    {b.spesifikasi && (
                      <div
                        style={{
                          fontSize: 11, color: "var(--muted)", marginTop: 2,
                          whiteSpace: "normal", maxWidth: 380, lineHeight: 1.45,
                        }}
                      >
                        {b.spesifikasi}
                      </div>
                    )}
                  </td>
                  <td>{b.satuan}</td>
                  <td style={{ textAlign: "right" }} className="num">
                    {b.volume.toLocaleString("id-ID")}
                  </td>
                  <td style={{ textAlign: "right" }} className="num">{rp(b.hargaSatuan)}</td>
                  <td style={{ textAlign: "right" }} className="num">{rp(sub)}</td>
                  <td style={{ textAlign: "right" }} className="num">
                    {rabStandar ? pct(sub / rabStandar, 1) : "—"}
                  </td>
                  {bisaUbah && (
                    <td><EditBarisBoq data={b} /></td>
                  )}
                </tr>
              );
            })}
            <tr style={{ background: "#f6f9fa", fontWeight: 600 }}>
              <td colSpan={5}>Total RAB standar</td>
              <td style={{ textAlign: "right" }} className="num">{rp(rabStandar)}</td>
              <td style={{ textAlign: "right" }} className="num">100%</td>
              {bisaUbah && <td />}
            </tr>
          </tbody>
        </table>
      </div>

      {/* ---------- kerja tambah ---------- */}
      {unit.customWorks.map((kt) => (
        <div key={kt.id}>
          <div className="sectitle">
            Kerja tambah — {kt.judul}
          </div>
          <div className="card tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Uraian</th>
                  <th>Satuan</th>
                  <th style={{ textAlign: "right" }}>Volume</th>
                  <th style={{ textAlign: "right" }}>Harga satuan</th>
                  <th style={{ textAlign: "right" }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {kt.boqItems.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{b.uraian}</div>
                      {b.spesifikasi && (
                        <div
                          style={{
                            fontSize: 11, color: "var(--muted)", marginTop: 2,
                            whiteSpace: "normal", maxWidth: 420, lineHeight: 1.45,
                          }}
                        >
                          {b.spesifikasi}
                        </div>
                      )}
                    </td>
                    <td>{b.satuan}</td>
                    <td style={{ textAlign: "right" }} className="num">{b.volume.toLocaleString("id-ID")}</td>
                    <td style={{ textAlign: "right" }} className="num">{rp(b.hargaSatuan)}</td>
                    <td style={{ textAlign: "right" }} className="num">{rp(b.volume * b.hargaSatuan)}</td>
                  </tr>
                ))}
                <tr style={{ background: "#f6f9fa", fontWeight: 600 }}>
                  <td colSpan={4}>Total kerja tambah</td>
                  <td style={{ textAlign: "right" }} className="num">{rp(totalBaris(kt.boqItems))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ---------- RAP ---------- */}
      <div className="sectitle">Rencana Anggaran Pelaksanaan (RAP)</div>
      <div className="card tablewrap">
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Satuan</th>
              <th style={{ textAlign: "right" }}>Volume</th>
              <th style={{ textAlign: "right" }}>Harga satuan</th>
              <th style={{ textAlign: "right" }}>Subtotal</th>
              {bisaUbah && <th style={{ width: 44 }} />}
            </tr>
          </thead>
          <tbody>
            {grupRap.map((g) => (
              <>
                <tr key={g.nama} style={{ background: "#fafcfc" }}>
                  <td colSpan={bisaUbah ? 6 : 5} style={{ fontWeight: 600, fontSize: 11.5, color: "var(--teal)" }}>
                    {g.nama}
                    <span style={{ color: "var(--muted)", fontWeight: 500, marginLeft: 8 }}>
                      {rp(g.total)}
                    </span>
                  </td>
                </tr>
                {g.items.map((r) => (
                  <tr key={r.id}>
                    <td style={{ paddingLeft: 22 }}>
                      {r.nama}
                      {r.keterangan && (
                        <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>
                          ({r.keterangan})
                        </span>
                      )}
                    </td>
                    <td>{r.satuan}</td>
                    <td style={{ textAlign: "right" }} className="num">{r.volume.toLocaleString("id-ID")}</td>
                    <td style={{ textAlign: "right" }} className="num">{rp(r.hargaSatuan)}</td>
                    <td style={{ textAlign: "right" }} className="num">{rp(r.volume * r.hargaSatuan)}</td>
                    {bisaUbah && (
                      <td>
                        <EditBarisRap
                          data={{
                            id: r.id, nama: r.nama, satuan: r.satuan,
                            volume: r.volume, hargaSatuan: r.hargaSatuan, keterangan: r.keterangan,
                          }}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </>
            ))}
            <tr style={{ fontWeight: 600 }}>
              <td colSpan={4}>Total material</td>
              <td style={{ textAlign: "right" }} className="num">{rp(rapMaterial)}</td>
              {bisaUbah && <td />}
            </tr>
            <tr style={{ fontWeight: 600 }}>
              <td colSpan={4}>Upah tenaga kerja</td>
              <td style={{ textAlign: "right" }} className="num">{rp(unit.rapUpah)}</td>
              {bisaUbah && <td />}
            </tr>
            <tr style={{ background: "#f6f9fa", fontWeight: 600 }}>
              <td colSpan={4}>Total RAP</td>
              <td style={{ textAlign: "right" }} className="num">{rp(rap)}</td>
              {bisaUbah && <td />}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
