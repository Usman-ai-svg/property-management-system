import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ambilPengguna, bolehAksesProyek, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { detailUnit, kontrakUnit } from "@/lib/data/proyek";
import { Badge, CardHead, InfoRow, Kartu, Terbatas, WARNA_STATUS } from "@/components/ui";
import { FileRow } from "@/components/file-row";
import { KATEGORI_EKSTENSI } from "@/lib/storage";
import { hapusUnitPaksa, unggahRevisi } from "../../../actions";
import { HapusPaksa } from "@/components/hapus-paksa";
import { KontrakBacaSaja } from "@/components/kontrak-baca-saja";
import { rp } from "@/lib/format";
import { nilaiUnit } from "@/lib/data/proyek";
import {
  EditDeskripsiUnit, HapusKerjaTambah, TabelBoqKt, TabelBoqUnit,
  TabelRapKt, TabelRapUnit, TambahKerjaTambah, UbahJudulKerjaTambah,
} from "./editors";


export default async function RincianUnit({
  params,
}: {
  params: Promise<{ kode: string; unitKode: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode, unitKode } = await params;
  const kodeProyek = kode.toUpperCase();

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const ubahHarga = bolehUbah(pengguna, "hargaRabRap");
  const ubahData = bolehUbah(pengguna, "daftarUnit");
  const ubahProgres = bolehUbah(pengguna, "progress");

  const ubahTeknis = bolehUbah(pengguna, "dokumenTeknis");
  const bolehDokumen = bolehLihat(pengguna, "dokumenTeknis");

  const unit = await detailUnit(unitKode, bolehHarga);

  if (!unit || unit.project.kode !== kodeProyek) notFound();
  if (!bolehAksesProyek(pengguna, unit.projectId)) notFound();

  // Progres unit hanya punya satu sumber. Bila unit ini sudah dirinci lewat
  // BOQ Master, angkanya turunan dari opname per baris dan isian satu
  // angka di sini ditiadakan — sama seperti di halaman Konstruksi.
  const dariBoq = unit._count.boqItems > 0;

  const kontrak = await kontrakUnit(unit.id);

  const label = `${unit.phase.kode}-${unit.nomor}`;
  const kts = unit.customWorks;
  const konteksImpor = `Unit ${unit.nomor} · ${unit.unitType.nama}`;

  const boqItems = "boqItems" in unit ? unit.boqItems : [];
  const rapItems = "rapItems" in unit ? unit.rapItems : [];
  const rapUpahVolume = "rapUpahVolume" in unit ? unit.rapUpahVolume : 0;
  const rapUpahHarga = "rapUpahHarga" in unit ? unit.rapUpahHarga : 0;

  // RAB & RAP "unit ini" — dasar Tipe ditambah seluruh Kerja Tambah,
  // disatukan jadi satu angka. Sama untuk unit default (kts kosong, jadi
  // sama dengan RAB/RAP tipe) maupun unit custom.
  const nilai = nilaiUnit({ boqItems, rapItems, rapUpahVolume, rapUpahHarga, customWorks: kts });

  // Rincian RAB & RAP per Kerja Tambah — dipisah agar ringkasan tidak lagi
  // menggabung seluruh kerja tambah menjadi satu baris. Jumlah baris-baris ini
  // tepat sama dengan nilai.kerjaTambah / nilai.rapKerjaTambah.
  const jumlahBaris = (rows?: { volume: number; hargaSatuan: number }[]) =>
    (rows ?? []).reduce((s, r) => s + r.volume * r.hargaSatuan, 0);
  const ktNilai = kts.map((kt) => ({
    judul: kt.judul,
    rab: jumlahBaris(kt.boqItems),
    rap: jumlahBaris(kt.rapItems) + (kt.rapUpahVolume || 0) * (kt.rapUpahHarga || 0),
  }));

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
        <Link href="/master" style={{ color: "inherit", textDecoration: "none" }}>Master Proyek</Link>
        {" / "}
        <Link href={`/master/${kodeProyek}`} style={{ color: "inherit", textDecoration: "none" }}>
          {unit.project.nama}
        </Link>
        {" / "}
        <b style={{ color: "var(--text)" }}>Unit {unit.nomor}</b>
      </div>

      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          flexWrap: "wrap", gap: 12, marginBottom: 16,
        }}
      >
        <div>
          <div className="eyebrow">Detail Data Unit · database per unit</div>
          <h3 className="disp" style={{ margin: "4px 0 0", fontSize: 19 }}>
            {unit.project.nama} — Unit {unit.nomor}
          </h3>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Badge nilai={unit.statusPembangunan} peta={WARNA_STATUS.bangun} />
          <Badge nilai={unit.statusJual} peta={WARNA_STATUS.jual} />
        </div>
      </div>

      {/* ---------- baris 1: Deskripsi | Dokumen ---------- */}
      <div className="grid grid2">
        <Kartu>
          <CardHead
            judul="Deskripsi Unit"
            aksi={
              (ubahProgres || ubahData) && (
                <EditDeskripsiUnit
                  unit={{
                    id: unit.id, nomor: unit.nomor, luasTanah: unit.luasTanah,
                    phaseId: unit.phaseId, unitTypeId: unit.unitTypeId,
                    progress: unit.progress,
                    dariBoq,
                  }}
                  fases={unit.project.fases}
                  tipes={unit.project.unitTypes}
                />
              )
            }
          />
          <InfoRow label="Kode Unit" nilai={unit.kode} />
          <InfoRow label="Fase" nilai={unit.phase.kode} />
          <InfoRow label="Tipe" nilai={unit.unitType.nama} />
          <InfoRow label="Luas Bangunan" nilai={`${unit.unitType.luasBangunan} m²`} />
          <InfoRow label="Luas Tanah" nilai={`${unit.luasTanah} m²`} />
          <InfoRow
            label="Progres"
            nilai={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {unit.progress}%
                <span style={{ fontSize: 10.5, fontWeight: 400, color: "var(--muted)" }}>
                  {dariBoq ? "dari opname BOQ" : "sama dengan Konstruksi"}
                </span>
              </span>
            }
          />
          <InfoRow
            label="Status Bangun"
            nilai={<Badge nilai={unit.statusPembangunan} peta={WARNA_STATUS.bangun} />}
          />
          <InfoRow
            label="Status Jual"
            nilai={<Badge nilai={unit.statusJual} peta={WARNA_STATUS.jual} />}
          />
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>
            Status Bangun dan Status Jual diubah dari tabel Daftar Unit di halaman Master Proyek.
          </div>
        </Kartu>

        <Kartu>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Dokumen Unit</div>
          {!bolehDokumen ? (
            <Terbatas apa="Dokumen teknis" />
          ) : (
            // Daftar dokumen dibatasi tingginya dan bisa di-scroll sendiri:
            // saat unit punya banyak Kerja Tambah, dokumennya tidak lagi
            // memanjangkan seluruh halaman ke bawah.
            <div style={{ maxHeight: 460, overflowY: "auto", marginRight: -8, paddingRight: 8 }}>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>
                Diturunkan dari Tipe Unit {unit.unitType.nama} · unggah revisi menyimpan versi lama.
              </div>
              {(
                [
                  ["3D Model", unit.unitType.docModel3d, "model3d"],
                  ["Gambar Kerja PDF", unit.unitType.docGambarKerjaPdf, "gambarKerjaPdf"],
                  ["Gambar Kerja DWG", unit.unitType.docGambarKerjaDwg, "gambarKerjaDwg"],
                  ["Render", unit.unitType.docRender, "render"],
                  ["Spesifikasi Material", unit.unitType.docSpek, "spek"],
                ] as const
              ).map(([judul, dok, kategori]) => (
                <FileRow
                  key={kategori}
                  label={judul}
                  dokumen={dok ? { id: dok.id, kategori: dok.kategori, versi: dok.versions } : null}
                  bolehUbah={ubahTeknis}
                  konteks={`${judul} · Tipe ${unit.unitType.nama}`}
                  pemilik={{ jenis: "tipeUnit", id: unit.unitTypeId, kategori }}
                  aksiUnggah={unggahRevisi}
                  terima={KATEGORI_EKSTENSI[kategori]?.join(",")}
                />
              ))}

              {kts.map((kt) => (
                <div key={kt.id}>
                  <div className="eyebrow" style={{ margin: "14px 0 4px" }}>Dokumen Kerja Tambah</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{kt.judul}</div>
                  {(
                    [
                      ["Desain (disetujui)", kt.docDesain, "desain"],
                      ["RAB (disetujui)", kt.docRab, "rab"],
                      ["3D Model", kt.docModel3d, "model3d"],
                      ["Gambar Kerja PDF", kt.docGambarKerjaPdf, "gambarKerjaPdf"],
                      ["Gambar Kerja DWG", kt.docGambarKerjaDwg, "gambarKerjaDwg"],
                    ] as const
                  ).map(([judul, dok, kategori]) => (
                    <FileRow
                      key={kategori}
                      label={judul}
                      dokumen={dok ? { id: dok.id, kategori: dok.kategori, versi: dok.versions } : null}
                      bolehUbah={ubahTeknis}
                      konteks={`${judul} · ${kt.judul}`}
                      pemilik={{ jenis: "kerjaTambah", id: kt.id, kategori }}
                      aksiUnggah={unggahRevisi}
                      terima={KATEGORI_EKSTENSI[kategori]?.join(",")}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </Kartu>
      </div>

      {/* ---------- baris 2: Konfigurasi | Kontrak ---------- */}
      <div className="grid grid2" style={{ marginTop: 16 }}>
        <Kartu>
          <div
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 8, gap: 8,
            }}
          >
            <div className="eyebrow">Konfigurasi Unit</div>
            {kts.length > 0 ? (
              <span className="chip" style={{ background: "var(--rona-amber)", color: "var(--amber)" }}>
                Custom · {kts.length} kerja tambah
              </span>
            ) : (
              <span className="chip" style={{ background: "var(--rona-abu)", color: "var(--muted)" }}>
                Default
              </span>
            )}
          </div>

          {kts.length === 0 && (
            <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 10 }}>
              Unit Default memakai BOQ, RAB, dan RAP tipe standar tanpa tambahan.
            </div>
          )}

          {kts.map((kt) => (
            <div
              key={kt.id}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                gap: 8, padding: "7px 0", borderBottom: "1px solid var(--garis-halus)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{kt.judul}</div>
                {bolehHarga && (
                  <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                    {rp(kt.boqItems.reduce((s, b) => s + b.volume * b.hargaSatuan, 0))}
                  </div>
                )}
              </div>
              {ubahData && (
                <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                  <UbahJudulKerjaTambah id={kt.id} judul={kt.judul} />
                  <HapusKerjaTambah id={kt.id} judul={kt.judul} />
                </div>
              )}
            </div>
          ))}

          {ubahData && (
            <div style={{ marginTop: 10 }}>
              <TambahKerjaTambah unitId={unit.id} />
            </div>
          )}
        </Kartu>

        <Kartu>
          <KontrakBacaSaja
            daftar={kontrak}
            bolehHarga={bolehHarga}
            kosong="Unit ini belum tercakup kontrak vendor mana pun."
          />
        </Kartu>
      </div>

      {/* ---------- RAB & RAP unit ---------- */}
      {!bolehHarga ? (
        <div style={{ marginTop: 16 }}>
          <Terbatas apa="Tabel RAB dan RAP unit" />
        </div>
      ) : (
        <>
          <TabelBoqUnit
            unitId={unit.id}
            judul={`RAB Unit · dasar Tipe ${unit.unitType.nama}`}
            baris={boqItems}
            bolehHarga={bolehHarga}
            bolehUbah={ubahHarga}
            konteks={konteksImpor}
          />

          <TabelRapUnit
            unitId={unit.id}
            baris={rapItems}
            upahVolume={rapUpahVolume}
            upahHarga={rapUpahHarga}
            bolehHarga={bolehHarga}
            bolehUbah={ubahHarga}
            konteks={konteksImpor}
            keterangan={`Rencana Anggaran Pelaksana — Tipe ${unit.unitType.nama} (LB ${unit.unitType.luasBangunan} m²)`}
          />

          {kts.map((kt) => (
            <div key={kt.id} style={{ marginTop: 20, paddingTop: 16, borderTop: "2px solid var(--line)" }}>
              <TabelBoqKt
                ktId={kt.id}
                judul={kt.judul}
                baris={kt.boqItems}
                bolehHarga={bolehHarga}
                bolehUbah={ubahHarga}
                konteks={`Unit ${unit.nomor} · ${kt.judul}`}
              />
              <TabelRapKt
                ktId={kt.id}
                judul={kt.judul}
                baris={kt.rapItems}
                upahVolume={kt.rapUpahVolume}
                upahHarga={kt.rapUpahHarga}
                bolehHarga={bolehHarga}
                bolehUbah={ubahHarga}
                konteks={`Unit ${unit.nomor} · ${kt.judul}`}
              />
            </div>
          ))}

          <Kartu atas={20}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Ringkasan RAB &amp; RAP Unit Ini</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.6 }}>
              Gabungan RAB dan RAP dasar Tipe {unit.unitType.nama}
              {kts.length > 0 ? ` ditambah ${kts.length} kerja tambah di atas.` : " — unit ini masih Default, belum ada kerja tambah."}
            </div>

            <div className="grid grid2" style={{ gap: 20 }}>
              <div>
                <div className="eyebrow" style={{ fontSize: 10, marginBottom: 2 }}>RAB</div>
                <InfoRow label={`Default · Tipe ${unit.unitType.nama}`} nilai={rp(nilai.rabStandar)} />
                {ktNilai.map((k, i) => (
                  <InfoRow key={i} label={`Kerja Tambah · ${k.judul}`} nilai={rp(k.rab)} />
                ))}
                <InfoRow label="RAB Unit Ini" nilai={rp(nilai.rab)} tebal />
              </div>
              <div>
                <div className="eyebrow" style={{ fontSize: 10, marginBottom: 2 }}>RAP</div>
                <InfoRow label={`Default · Tipe ${unit.unitType.nama}`} nilai={rp(nilai.rapMaterial + nilai.rapUpah)} />
                {ktNilai.map((k, i) => (
                  <InfoRow key={i} label={`Kerja Tambah · ${k.judul}`} nilai={rp(k.rap)} />
                ))}
                <InfoRow label="RAP Unit Ini" nilai={rp(nilai.rap)} tebal />
              </div>
            </div>
          </Kartu>
        </>
      )}

      {pengguna.peranAktif === "Administrator Sistem" && (
        <HapusPaksa
          aksi={hapusUnitPaksa}
          id={unit.id}
          kodeProyek={kodeProyek}
          label={`Unit ${unit.nomor}`}
          keterangan="Hapus unit ini secara permanen walau progress-nya sudah berjalan — untuk mengganti data lama dengan data baru."
        />
      )}
    </div>
  );
}
