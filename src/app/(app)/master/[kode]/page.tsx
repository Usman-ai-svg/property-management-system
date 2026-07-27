import { redirect } from "next/navigation";
import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";
import { ambilPengguna, bolehUbah } from "@/lib/auth/rbac";
import { detailProyek, luasTotal, nilaiSarpras, nilaiUnit } from "@/lib/data/proyek";
import { m2, pct, rp } from "@/lib/format";
import {
  Badge, CardHead, InfoRow, TabelHead, Terbatas, WARNA_STATUS,
} from "@/components/ui";
import { FileRow } from "@/components/file-row";
import { unggahRevisi } from "../actions";
import {
  AksiSarpras, AksiTipeUnit, EditLegalitas, EditLokasi, EditLuasLahan, EditUnit,
  HapusUnit, TambahSarpras, TambahTipeUnit, TambahUnit,
} from "./editors";
import { Tabel } from "@/components/kartu-tabel";

export default async function DetailProyek({ params }: { params: Promise<{ kode: string }> }) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode } = await params;
  const kodeProyek = kode.toUpperCase();
  const { proyek, unit, sarpras, bolehHarga, bolehUnit, bolehSarpras, bolehDokumen } =
    await detailProyek(pengguna, kodeProyek);

  const ubahData = bolehUbah(pengguna, "daftarUnit");
  const ubahDeskripsi = bolehUbah(pengguna, "deskripsi");
  const ubahTeknis = bolehUbah(pengguna, "dokumenTeknis");
  const ubahHarga = bolehUbah(pengguna, "hargaRabRap");
  const ubahProgres = bolehUbah(pengguna, "progress");
  const ubahSarprasData = bolehUbah(pengguna, "daftarSarpras");

  const total = luasTotal(proyek);
  const adaPin = proyek.pinLat != null && proyek.pinLng != null;
  const pin = adaPin ? `${proyek.pinLat}, ${proyek.pinLng}` : "—";
  // Titik koordinat dipakai apa adanya, bukan nama proyek, supaya peta membuka
  // lokasi yang benar-benar tersimpan — bukan hasil tebakan pencarian Maps.
  const petaUrl = adaPin
    ? `https://www.google.com/maps/search/?api=1&query=${proyek.pinLat},${proyek.pinLng}`
    : null;

  const totalBersertifikat = proyek.legalitas.reduce((a, l) => a + (l.luas || 0), 0);
  const nomorBerikutnya = unit.length + 1;

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Master Data · pelaksanaan konstruksi</div>
      <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>
        Master Proyek
      </h2>

      <div style={{ marginTop: 14 }}>
        <Link
          href="/master"
          style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none", display: "inline-block", marginBottom: 10 }}
        >
          ← Kembali ke daftar proyek
        </Link>

        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-end",
            flexWrap: "wrap", gap: 12, marginBottom: 16,
          }}
        >
          <div>
            <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <MapPin size={12} />
              {proyek.kecamatan}, {proyek.kota}
            </div>
            <h3 className="disp" style={{ margin: "4px 0 0", fontSize: 19 }}>
              {proyek.nama}
            </h3>
          </div>
          <Badge nilai={proyek.statusLahan} peta={WARNA_STATUS.lahan} />
        </div>

        {/* ---------- baris 1: Lokasi | Legalitas ---------- */}
        <div className="grid grid2">
          <div className="card" style={{ padding: "16px 20px" }}>
            <CardHead
              judul="Lokasi Proyek"
              aksi={
                ubahDeskripsi && (
                  <EditLokasi
                    kode={kodeProyek}
                    lokasi={{
                      alamat: proyek.alamat, kelurahan: proyek.kelurahan,
                      kecamatan: proyek.kecamatan, kota: proyek.kota,
                      provinsi: proyek.provinsi,
                      pin: proyek.pinLat != null ? `${proyek.pinLat}, ${proyek.pinLng}` : "",
                    }}
                  />
                )
              }
            />
            <InfoRow label="Alamat" nilai={proyek.alamat} />
            <InfoRow label="Kelurahan" nilai={proyek.kelurahan} />
            <InfoRow label="Kecamatan" nilai={proyek.kecamatan} />
            <InfoRow label="Kota / Kabupaten" nilai={proyek.kota} />
            <InfoRow label="Provinsi" nilai={proyek.provinsi} />
            <div
              style={{
                display: "flex", justifyContent: "space-between",
                padding: "9px 0", fontSize: 12.5, alignItems: "center",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Pin Lokasi</span>
              {petaUrl ? (
                <a
                  href={petaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buka di Google Maps"
                  className="chip"
                  style={{
                    background: "var(--rona-teal2)", color: "var(--teal)",
                    textDecoration: "none", fontWeight: 600,
                  }}
                >
                  <MapPin size={11} />
                  {pin}
                  <ExternalLink size={10} style={{ opacity: 0.75 }} />
                </a>
              ) : (
                <span className="chip" style={{ background: "var(--rona-teal2)", color: "var(--teal)" }}>
                  <MapPin size={11} />
                  {pin}
                </span>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: "16px 20px" }}>
            <CardHead
              judul={`Legalitas · ${proyek.legalitas.length} NIB`}
              aksi={
                ubahDeskripsi && (
                  <EditLegalitas
                    kode={kodeProyek}
                    legalitas={proyek.legalitas.map((l) => ({
                      id: l.id, nib: l.nib, sertifikat: l.sertifikat, luas: l.luas,
                    }))}
                  />
                )
              }
            />
            {proyek.legalitas.map((lg, i) => (
              <div
                key={lg.id}
                style={{
                  padding: "9px 0",
                  borderBottom: i < proyek.legalitas.length - 1 ? "1px solid var(--garis-halus)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>NIB {lg.nib}</div>
                  {lg.luas != null && (
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{m2(lg.luas)}</div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55, marginTop: 2 }}>
                  {lg.sertifikat}
                </div>
                {bolehDokumen && (
                  <FileRow
                    label="Dokumen sertifikat"
                    dokumen={
                      lg.dokumen
                        ? {
                            id: lg.dokumen.id,
                            kategori: lg.dokumen.kategori,
                            versi: lg.dokumen.versions,
                          }
                        : null
                    }
                    bolehUbah={ubahTeknis}
                    konteks={`Sertifikat NIB ${lg.nib}`}
                    pemilik={{ jenis: "legalitas", id: lg.id, kategori: "legalitas" }}
                    aksiUnggah={unggahRevisi}
                  />
                )}
              </div>
            ))}
            {proyek.legalitas.length > 1 && (
              <div
                style={{
                  display: "flex", justifyContent: "space-between", paddingTop: 10,
                  marginTop: 4, borderTop: "1px solid var(--line)", fontSize: 12.5,
                }}
              >
                <span style={{ fontWeight: 600 }}>Total luas bersertifikat</span>
                <span className="num">{m2(totalBersertifikat)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ---------- baris 2: Luas Lahan ---------- */}
        <div className="card" style={{ padding: "16px 20px", marginTop: 16 }}>
          <CardHead
            judul="Luas Lahan"
            aksi={ubahDeskripsi && <EditLuasLahan kode={kodeProyek} luas={proyek} />}
          />
          <div className="grid grid4" style={{ gap: 20 }}>
            {(
              [
                ["Kavling Efektif", proyek.luasKavlingEfektif],
                ["Sarana", proyek.luasSarana],
                ["Prasarana", proyek.luasPrasarana],
                ["RTH", proyek.luasRth],
              ] as [string, number][]
            ).map(([label, nilai]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div>
                <div className="num" style={{ fontSize: 15 }}>{m2(nilai)}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {total ? `${pct(nilai / total, 1)} dari luas total` : "—"}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              paddingTop: 12, marginTop: 10, borderTop: "1px solid var(--line)",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 13 }}>Luas Total</span>
            <span className="num" style={{ fontSize: 16 }}>{m2(total)}</span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8 }}>
            Biaya perolehan lahan dikelola di{" "}
            <Link href={`/landbank/${kodeProyek}`} style={{ color: "var(--teal)", fontWeight: 600 }}>
              halaman Landbank
            </Link>
            .
          </div>
        </div>

        {/* ---------- Tipe Unit ---------- */}
        <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
          <TabelHead
            judul={`Tipe Unit · ${proyek.unitTypes.length} tipe`}
            keterangan="Luas bangunan, dokumen teknis, BOQ, RAB & RAP unit mengikuti tipenya."
            aksi={ubahTeknis && <TambahTipeUnit kode={kodeProyek} />}
          />
          <Tabel
            kolom={[
              { label: "Tipe" },
              { label: "Kode" },
              { label: "LB", rata: "kanan" },
              { label: "LT", rata: "kanan" },
              { label: "Unit Terpakai", rata: "kanan" },
              ubahTeknis && { lebar: 70 },
            ]}
            kosong="Belum ada tipe unit. Tambahkan tipe lebih dulu sebelum membuat unit."
          >
            {proyek.unitTypes.map((t) => (
              <tr key={t.id}>
                <td style={{ fontWeight: 600 }}>{t.nama}</td>
                <td style={{ color: "var(--muted)" }}>{t.kode}</td>
                <td style={{ textAlign: "right" }}>{t.luasBangunan} m²</td>
                <td style={{ textAlign: "right" }}>{t.luasTanah} m²</td>
                <td style={{ textAlign: "right" }}>{t._count.units}</td>
                {ubahTeknis && (
                  <td>
                    <AksiTipeUnit kode={kodeProyek} data={t} dipakai={t._count.units} />
                  </td>
                )}
              </tr>
            ))}
          </Tabel>
        </div>

        {/* ---------- Daftar Unit ---------- */}
        <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
          <TabelHead
            judul={`Daftar Unit · ${unit.length} unit`}
            keterangan="Klik nomor unit untuk membuka Detail Data Unit · status diubah dari halaman detail."
            aksi={
              ubahData &&
              proyek.unitTypes.length > 0 &&
              proyek.fases.length > 0 && (
                <TambahUnit
                  kode={kodeProyek}
                  fases={proyek.fases}
                  tipes={proyek.unitTypes}
                  nomorBerikutnya={nomorBerikutnya}
                />
              )
            }
          />

          {!bolehUnit ? (
            <div style={{ padding: 16 }}>
              <Terbatas apa="Daftar unit" />
            </div>
          ) : (
            <Tabel
              tinggiMaks={400}
              kolom={[
                { label: "Unit" },
                { label: "Fase" },
                { label: "Tipe" },
                { label: "LB", rata: "kanan" },
                { label: "LT", rata: "kanan" },
                { label: "Konfigurasi" },
                { label: "Status Bangun" },
                { label: "Status Jual" },
                bolehHarga && { label: "RAB", rata: "kanan" },
                bolehHarga && { label: "RAP", rata: "kanan" },
                (ubahProgres || ubahData) && { lebar: 70 },
              ]}
              kosong="Belum ada unit pada proyek ini."
            >
              {unit.map((u) => {
                const n = bolehHarga ? nilaiUnit(u) : null;
                const custom = (u.customWorks?.length ?? 0) > 0;
                const label = `${u.phase.kode}-${u.nomor}`;

                return (
                  <tr key={u.id}>
                    <td>
                      <Link
                        href={`/master/${kodeProyek}/unit/${u.kode}`}
                        style={{ fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}
                      >
                        {u.nomor}
                      </Link>
                    </td>
                    <td>{u.phase.kode}</td>
                    <td>{u.unitType.nama}</td>
                    <td style={{ textAlign: "right" }}>{u.unitType.luasBangunan} m²</td>
                    <td style={{ textAlign: "right" }}>{u.luasTanah} m²</td>
                    <td>
                      {custom ? (
                        <span className="chip" style={{ background: "var(--rona-amber)", color: "var(--amber)" }}>
                          Custom
                        </span>
                      ) : (
                        <span className="chip" style={{ background: "var(--rona-abu)", color: "var(--muted)" }}>
                          Default
                        </span>
                      )}
                    </td>
                    <td><Badge nilai={u.statusPembangunan} peta={WARNA_STATUS.bangun} /></td>
                    <td><Badge nilai={u.statusJual} peta={WARNA_STATUS.jual} /></td>
                    {bolehHarga && (
                      <td className="num" style={{ textAlign: "right" }}>{rp(n!.rab)}</td>
                    )}
                    {bolehHarga && (
                      <td className="num" style={{ textAlign: "right" }}>{rp(n!.rap)}</td>
                    )}
                    {(ubahProgres || ubahData) && (
                      <td>
                        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                          {ubahProgres && (
                            <EditUnit
                              data={{
                                id: u.id, label, luasTanah: u.luasTanah,
                                statusPembangunan: u.statusPembangunan,
                                statusJual: u.statusJual, progress: u.progress,
                                dariSpk: u._count.boqSpk > 0,
                              }}
                            />
                          )}
                          {ubahData && u.progress === 0 && <HapusUnit id={u.id} label={label} />}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </Tabel>
          )}
        </div>

        {bolehUnit && !bolehHarga && (
          <div style={{ marginTop: 12 }}>
            <Terbatas apa="Kolom RAB dan RAP" />
          </div>
        )}

        {/* ---------- Daftar Sarpras ---------- */}
        <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
          <TabelHead
            judul={`Daftar Sarana & Prasarana · ${sarpras.length} item`}
            keterangan="Klik nama item untuk membuka Detail Data Sarana & Prasarana."
            aksi={ubahSarprasData && <TambahSarpras kode={kodeProyek} bolehHarga={ubahHarga} />}
          />

          {!bolehSarpras ? (
            <div style={{ padding: 16 }}>
              <Terbatas apa="Daftar sarana & prasarana" />
            </div>
          ) : (
            <Tabel
              kolom={[
                { label: "Item" },
                { label: "Jenis" },
                { label: "Volume" },
                { label: "Status Bangun" },
                bolehHarga && { label: "RAB", rata: "kanan" },
                bolehHarga && { label: "RAP", rata: "kanan" },
                ubahSarprasData && { lebar: 70 },
              ]}
              kosong="Belum ada item sarana atau prasarana."
            >
              {sarpras.map((s) => {
                const n = bolehHarga ? nilaiSarpras(s) : null;
                return (
                  <tr key={s.id}>
                    <td>
                      <Link
                        href={`/master/${kodeProyek}/sarpras/${s.kode}`}
                        style={{ fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}
                      >
                        {s.nama}
                      </Link>
                    </td>
                    <td style={{ color: "var(--muted)" }}>{s.jenis}</td>
                    <td>{s.volume}</td>
                    <td><Badge nilai={s.status} peta={WARNA_STATUS.bangun} /></td>
                    {bolehHarga && (
                      <td className="num" style={{ textAlign: "right" }}>{rp(n!.rab)}</td>
                    )}
                    {bolehHarga && (
                      <td className="num" style={{ textAlign: "right" }}>{rp(n!.rap)}</td>
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
                );
              })}
            </Tabel>
          )}
        </div>
      </div>
    </div>
  );
}
