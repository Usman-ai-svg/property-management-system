import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, MapPin, Settings2 } from "lucide-react";
import { ambilPengguna, bolehUbah } from "@/lib/auth/rbac";
import { detailProyek, nilaiUnit } from "@/lib/data/proyek";
import { keteranganPekerjaan } from "@/lib/calc/opname";
import { m2, rp, rpRingkas } from "@/lib/format";
import { Badge, JudulHalaman, Kpi, Terbatas, Track, WARNA_STATUS } from "@/components/ui";
import {
  AksiLegalitas, AksiSarpras, AksiTipeUnit, EditBiayaLahan, EditDeskripsi, EditUnit,
  HapusUnit, TambahLegalitas, TambahSarpras, TambahTipeUnit, TambahUnit,
} from "./editors";

export default async function DetailProyek({ params }: { params: Promise<{ kode: string }> }) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode } = await params;
  const kodeProyek = kode.toUpperCase();
  const { proyek, unit, sarpras, bolehHarga, bolehUnit, bolehSarpras } = await detailProyek(
    pengguna,
    kodeProyek,
  );

  const ubahDeskripsi = bolehUbah(pengguna, "deskripsi");
  const ubahHarga = bolehUbah(pengguna, "hargaRabRap");
  const ubahUnitData = bolehUbah(pengguna, "daftarUnit");
  const ubahProgres = bolehUbah(pengguna, "progress");
  const ubahSarprasData = bolehUbah(pengguna, "daftarSarpras");
  const ubahTeknis = bolehUbah(pengguna, "dokumenTeknis");

  const luasTotal =
    proyek.luasKavlingEfektif + proyek.luasSarana + proyek.luasPrasarana + proyek.luasRth;

  const biaya = proyek as Partial<{
    hargaPerM2: number; biayaPembelian: number; biayaNotaris: number;
    biayaBalikNama: number; biayaLegalLain: number;
  }>;
  const totalPerolehan = bolehHarga
    ? (biaya.biayaPembelian ?? 0) + (biaya.biayaNotaris ?? 0) +
      (biaya.biayaBalikNama ?? 0) + (biaya.biayaLegalLain ?? 0)
    : null;

  return (
    <div style={{ padding: "26px 28px 40px" }}>
      <Link href="/master" style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}>
        ← Master Proyek
      </Link>

      <div style={{ marginTop: 12 }}>
        <JudulHalaman
          judul={proyek.nama}
          keterangan={`${proyek.alamat}, ${proyek.kelurahan}, ${proyek.kecamatan}, ${proyek.kota}`}
          kanan={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge nilai={proyek.statusLahan} peta={WARNA_STATUS.lahan} />
              {ubahDeskripsi && <EditDeskripsi kode={kodeProyek} proyek={proyek} />}
            </div>
          }
        />
      </div>

      <div className="grid grid4">
        <Kpi label="Luas total" nilai={m2(luasTotal)} catatan={`kavling efektif ${m2(proyek.luasKavlingEfektif)}`} />
        <Kpi label="Jumlah unit" nilai={String(unit.length)} catatan={`${proyek.unitTypes.length} tipe`} />
        <Kpi label="Sarana & prasarana" nilai={String(sarpras.length)} catatan="item terdaftar" />
        {bolehHarga && totalPerolehan != null ? (
          <div className="card kpi" style={{ position: "relative" }}>
            <div className="eyebrow">Biaya perolehan lahan</div>
            <div className="v">{rpRingkas(totalPerolehan)}</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
              Rp {(biaya.hargaPerM2 ?? 0).toLocaleString("id-ID")}/m²
            </div>
            {ubahHarga && (
              <div style={{ position: "absolute", top: 12, right: 12 }}>
                <EditBiayaLahan
                  kode={kodeProyek}
                  biaya={{
                    hargaPerM2: biaya.hargaPerM2 ?? 0,
                    biayaPembelian: biaya.biayaPembelian ?? 0,
                    biayaNotaris: biaya.biayaNotaris ?? 0,
                    biayaBalikNama: biaya.biayaBalikNama ?? 0,
                    biayaLegalLain: biaya.biayaLegalLain ?? 0,
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <Kpi label="Biaya perolehan lahan" nilai="—" catatan="tidak tersedia untuk peran ini" />
        )}
      </div>

      {/* ---------- legalitas ---------- */}
      <div className="sectitle" style={{ justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={16} /> Legalitas
        </span>
        {ubahDeskripsi && <TambahLegalitas kode={kodeProyek} />}
      </div>
      <div className="card tablewrap">
        <table>
          <thead>
            <tr>
              <th>NIB</th>
              <th>Sertifikat</th>
              <th style={{ textAlign: "right" }}>Luas</th>
              {ubahDeskripsi && <th style={{ width: 70 }} />}
            </tr>
          </thead>
          <tbody>
            {proyek.legalitas.map((l) => (
              <tr key={l.id}>
                <td className="num">{l.nib}</td>
                <td>{l.sertifikat}</td>
                <td style={{ textAlign: "right" }} className="num">{m2(l.luas)}</td>
                {ubahDeskripsi && (
                  <td>
                    <AksiLegalitas kode={kodeProyek} data={l} />
                  </td>
                )}
              </tr>
            ))}
            {proyek.legalitas.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}>
                  Belum ada data legalitas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- tipe unit ---------- */}
      <div className="sectitle" style={{ justifyContent: "space-between" }}>
        <span>Tipe unit</span>
        {ubahTeknis && <TambahTipeUnit kode={kodeProyek} />}
      </div>
      <div className="grid grid4">
        {proyek.unitTypes.map((t) => (
          <div key={t.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>{t.nama}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {t.kode} · {t._count.units} unit
                </div>
              </div>
              {ubahTeknis && <AksiTipeUnit kode={kodeProyek} data={t} dipakai={t._count.units} />}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
              <div>
                <div className="eyebrow" style={{ fontSize: 10 }}>L. bangunan</div>
                <div className="num" style={{ fontSize: 14 }}>{t.luasBangunan} m²</div>
              </div>
              <div>
                <div className="eyebrow" style={{ fontSize: 10 }}>L. tanah</div>
                <div className="num" style={{ fontSize: 14 }}>{t.luasTanah} m²</div>
              </div>
            </div>
          </div>
        ))}
        {proyek.unitTypes.length === 0 && (
          <div className="terbatas" style={{ gridColumn: "1 / -1" }}>
            Belum ada tipe unit. Tambahkan tipe lebih dulu sebelum membuat unit.
          </div>
        )}
      </div>

      {/* ---------- daftar unit ---------- */}
      <div className="sectitle" style={{ justifyContent: "space-between" }}>
        <span>Daftar unit</span>
        {ubahUnitData && proyek.unitTypes.length > 0 && proyek.fases.length > 0 && (
          <TambahUnit kode={kodeProyek} fases={proyek.fases} tipes={proyek.unitTypes} />
        )}
      </div>

      {!bolehUnit ? (
        <Terbatas apa="Daftar unit" />
      ) : (
        <div className="card tablewrap" style={{ maxHeight: 560, overflowY: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th>Tipe</th>
                <th style={{ textAlign: "right" }}>LB / LT</th>
                <th>Status bangun</th>
                <th>Status jual</th>
                <th style={{ minWidth: 170 }}>Progres</th>
                <th>Pekerjaan</th>
                {bolehHarga && <th style={{ textAlign: "right" }}>RAB</th>}
                {bolehHarga && <th style={{ textAlign: "right" }}>RAP</th>}
                {bolehHarga && <th style={{ textAlign: "right" }}>Harga jual</th>}
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {unit.map((u) => {
                const n = bolehHarga ? nilaiUnit(u) : null;
                const kerjaTambah = u.customWorks?.[0];
                const label = `${u.phase.kode}-${u.nomor}`;

                return (
                  <tr key={u.id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{label}</span>
                      {kerjaTambah && (
                        <span
                          className="chip"
                          title={kerjaTambah.judul}
                          style={{ background: "#fbf1e0", color: "var(--brass)", marginLeft: 6 }}
                        >
                          KT
                        </span>
                      )}
                    </td>
                    <td>{u.unitType.nama}</td>
                    <td style={{ textAlign: "right" }} className="num">
                      {u.unitType.luasBangunan} / {u.luasTanah}
                    </td>
                    <td><Badge nilai={u.statusPembangunan} peta={WARNA_STATUS.bangun} /></td>
                    <td><Badge nilai={u.statusJual} peta={WARNA_STATUS.jual} /></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Track nilai={u.progress} tinggi={16} />
                        <span className="num" style={{ fontSize: 11.5, minWidth: 30, textAlign: "right" }}>
                          {u.progress}%
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      {keteranganPekerjaan(u.progress).join(", ")}
                    </td>
                    {bolehHarga && (
                      <td style={{ textAlign: "right" }} className="num">
                        {rp(n!.rab)}
                        {n!.kerjaTambah > 0 && (
                          <div style={{ fontSize: 10.5, color: "var(--brass)", fontWeight: 500 }}>
                            +{rpRingkas(n!.kerjaTambah)} KT
                          </div>
                        )}
                      </td>
                    )}
                    {bolehHarga && (
                      <td style={{ textAlign: "right" }} className="num">{rp(n!.rap)}</td>
                    )}
                    {bolehHarga && (
                      <td style={{ textAlign: "right" }} className="num">
                        {rp(u.hargaJual as number)}
                      </td>
                    )}
                    <td>
                      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                        {bolehHarga && (
                          <Link
                            href={`/master/${kodeProyek}/unit/${u.kode}`}
                            title={`Rincian RAB & RAP unit ${label}`}
                            style={{ color: "var(--teal)", display: "inline-grid", placeItems: "center", padding: 4 }}
                          >
                            <Settings2 size={14} />
                          </Link>
                        )}
                        {ubahProgres && (
                          <EditUnit
                            data={{
                              id: u.id, label, luasTanah: u.luasTanah,
                              statusPembangunan: u.statusPembangunan,
                              statusJual: u.statusJual, progress: u.progress,
                            }}
                          />
                        )}
                        {ubahUnitData && u.progress === 0 && <HapusUnit id={u.id} label={label} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {unit.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}>
                    Belum ada unit pada proyek ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {bolehUnit && !bolehHarga && (
        <div style={{ marginTop: 12 }}>
          <Terbatas apa="Kolom RAB, RAP, dan harga jual" />
        </div>
      )}

      {/* ---------- sarpras ---------- */}
      <div className="sectitle" style={{ justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MapPin size={16} /> Sarana &amp; prasarana
        </span>
        {ubahSarprasData && <TambahSarpras kode={kodeProyek} bolehHarga={ubahHarga} />}
      </div>

      {!bolehSarpras ? (
        <Terbatas apa="Daftar sarana & prasarana" />
      ) : (
        <div className="card tablewrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Jenis</th>
                <th>Volume</th>
                <th>Status</th>
                <th style={{ minWidth: 170 }}>Progres</th>
                {bolehHarga && <th style={{ textAlign: "right" }}>RAB</th>}
                {ubahSarprasData && <th style={{ width: 70 }} />}
              </tr>
            </thead>
            <tbody>
              {sarpras.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.nama}</td>
                  <td>{s.jenis}</td>
                  <td className="num">{s.volume}</td>
                  <td><Badge nilai={s.status} peta={WARNA_STATUS.bangun} /></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Track nilai={s.progress} tinggi={16} />
                      <span className="num" style={{ fontSize: 11.5, minWidth: 30, textAlign: "right" }}>
                        {s.progress}%
                      </span>
                    </div>
                  </td>
                  {bolehHarga && (
                    <td style={{ textAlign: "right" }} className="num">
                      {rp((s as { rab: number }).rab)}
                    </td>
                  )}
                  {ubahSarprasData && (
                    <td>
                      <AksiSarpras
                        kode={kodeProyek}
                        data={s as Parameters<typeof AksiSarpras>[0]["data"]}
                        terkontrak={s._count.contractItems}
                        bolehHarga={ubahHarga}
                      />
                    </td>
                  )}
                </tr>
              ))}
              {sarpras.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}>
                    Belum ada item sarana atau prasarana.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
