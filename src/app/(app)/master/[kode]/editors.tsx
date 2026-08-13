"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah, TombolUbah,
} from "@/components/form";
import { JENIS_HAK_ATAS_TANAH, JENIS_SARPRAS, STATUS_JUAL } from "@/lib/domain/enums";
import {
  hapusSarpras, hapusTipeUnit, hapusUnit, simpanSarpras, simpanTipeUnit,
  tambahUnit, ubahLegalitas, ubahLokasiProyek, ubahLuasLahan, ubahUnit,
} from "../actions";
import { Petunjuk } from "@/components/ui";

/* ===================== LOKASI PROYEK ===================== */

export function EditLokasi({
  kode,
  lokasi,
}: {
  kode: string;
  lokasi: {
    alamat: string; kelurahan: string; kecamatan: string;
    kota: string; provinsi: string; pin: string;
  };
}) {
  return (
    <FormModal
      judul="Ubah Lokasi Proyek"
      aksi={ubahLokasiProyek}
      pemicu={(buka) => <TombolUbah onClick={buka} />}
    >
      <input type="hidden" name="kode" value={kode} />
      <BarisField kolom={1}>
        <Field label="Alamat" nama="alamat" nilai={lokasi.alamat} wajib />
      </BarisField>
      <BarisField>
        <Field label="Kelurahan" nama="kelurahan" nilai={lokasi.kelurahan} wajib />
        <Field label="Kecamatan" nama="kecamatan" nilai={lokasi.kecamatan} wajib />
      </BarisField>
      <BarisField>
        <Field label="Kota / Kabupaten" nama="kota" nilai={lokasi.kota} wajib />
        <Field label="Provinsi" nama="provinsi" nilai={lokasi.provinsi} wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field
          label="Pin Lokasi"
          nama="pin"
          nilai={lokasi.pin}
          petunjuk="Lintang, bujur — mis. -6.4021, 106.7532"
        />
      </BarisField>
    </FormModal>
  );
}

/* ===================== LUAS LAHAN ===================== */

export function EditLuasLahan({
  kode,
  luas,
}: {
  kode: string;
  luas: {
    luasKavlingEfektif: number; luasSarana: number;
    luasPrasarana: number; luasRth: number;
  };
}) {
  return (
    <FormModal
      judul="Ubah Luas Lahan"
      aksi={ubahLuasLahan}
      pemicu={(buka) => <TombolUbah onClick={buka} />}
    >
      <input type="hidden" name="kode" value={kode} />
      <BarisField>
        <Field label="Kavling Efektif" nama="luasKavlingEfektif" nilai={luas.luasKavlingEfektif} tipe="number" satuan="m²" />
        <Field label="Sarana" nama="luasSarana" nilai={luas.luasSarana} tipe="number" satuan="m²" />
      </BarisField>
      <BarisField>
        <Field label="Prasarana" nama="luasPrasarana" nilai={luas.luasPrasarana} tipe="number" satuan="m²" />
        <Field label="RTH" nama="luasRth" nilai={luas.luasRth} tipe="number" satuan="m²" />
      </BarisField>
      <Petunjuk>
        Luas total dihitung otomatis dari keempat isian di atas.
      </Petunjuk>
    </FormModal>
  );
}

/* ===================== LEGALITAS ===================== */

interface BarisLegal {
  id?: string;
  nib: string;
  jenisHak: string;
  nomorHak: string;
  sertifikat: string;
  luas: number;
}

/**
 * Legalitas disunting sekaligus dalam satu modal — satu proyek dapat memiliki
 * lebih dari satu NIB, seperti pada artifact. Baris yang dihapus di sini akan
 * ikut terhapus saat disimpan.
 */
export function EditLegalitas({
  kode,
  legalitas,
}: {
  kode: string;
  legalitas: { id: string; nib: string; jenisHak: string; nomorHak: string; sertifikat: string; luas: number }[];
}) {
  const [draft, setDraft] = useState<BarisLegal[]>(legalitas);

  const ubah = (i: number, patch: Partial<BarisLegal>) =>
    setDraft((d) => d.map((x, y) => (y === i ? { ...x, ...patch } : x)));

  return (
    <FormModal
      judul="Ubah Legalitas"
      keterangan="Satu proyek dapat memiliki lebih dari satu NIB."
      aksi={ubahLegalitas}
      pemicu={(buka) => (
        <TombolUbah
          onClick={() => {
            setDraft(legalitas.map((x) => ({ ...x })));
            buka();
          }}
        />
      )}
      lebar={640}
    >
      <input type="hidden" name="kode" value={kode} />
      <input type="hidden" name="baris" value={JSON.stringify(draft)} />

      {draft.map((lg, i) => (
        <div key={i} className="card" style={{ padding: "12px 14px", marginBottom: 10, background: "var(--rona-panel)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="eyebrow">NIB #{i + 1}</div>
            {draft.length > 1 && (
              <button
                type="button"
                onClick={() => setDraft((d) => d.filter((_, y) => y !== i))}
                style={{
                  color: "var(--red)", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: "none", border: "none", padding: 0, fontFamily: "inherit",
                }}
              >
                Hapus
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10, marginTop: 8 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                Nomor NIB
              </label>
              <input
                className="inp"
                value={lg.nib}
                onChange={(e) => ubah(i, { nib: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                Luas (m²)
              </label>
              <input
                className="inp"
                type="number"
                value={lg.luas || 0}
                onChange={(e) => ubah(i, { luas: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10, marginTop: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                Jenis Hak Atas Tanah
              </label>
              <select
                className="inp"
                value={lg.jenisHak}
                onChange={(e) => ubah(i, { jenisHak: e.target.value })}
              >
                {JENIS_HAK_ATAS_TANAH.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                Nomor Hak Atas Tanah
              </label>
              <input
                className="inp"
                value={lg.nomorHak}
                onChange={(e) => ubah(i, { nomorHak: e.target.value })}
              />
            </div>
          </div>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, margin: "10px 0 5px" }}>
            Catatan Sertifikat <span style={{ fontWeight: 400, color: "var(--muted)" }}>(opsional)</span>
          </label>
          <textarea
            className="inp"
            style={{ minHeight: 54, resize: "vertical", fontFamily: "inherit" }}
            value={lg.sertifikat}
            onChange={(e) => ubah(i, { sertifikat: e.target.value })}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setDraft((d) => [
            ...d,
            { nib: "", jenisHak: JENIS_HAK_ATAS_TANAH[0], nomorHak: "", sertifikat: "", luas: 0 },
          ])
        }
        style={{
          marginBottom: 14, border: "1px dashed var(--line)", background: "#fff",
          borderRadius: 9, padding: "9px 14px", width: "100%", fontSize: 12.5,
          fontWeight: 600, color: "var(--teal)", cursor: "pointer", fontFamily: "inherit",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
        }}
      >
        <Plus size={13} /> Tambah NIB
      </button>

      <Petunjuk>
        Dokumen sertifikat tiap NIB diunggah dari kartu Legalitas, dan mendukung
        revisi berversi.
      </Petunjuk>
    </FormModal>
  );
}

/* ===================== TIPE UNIT ===================== */

function FormTipeUnit({
  kode,
  data,
  pemicu,
}: {
  kode: string;
  data?: { id: string; kode: string; nama: string; luasBangunan: number; luasTanah: number };
  pemicu: (buka: () => void) => React.ReactNode;
}) {
  return (
    <FormModal
      judul={data ? "Ubah Tipe Unit" : "Tambah Tipe Unit"}
      keterangan={
        data
          ? "Mengubah luas bangunan tidak menghitung ulang RAB unit yang sudah ada — baris BOQ mereka adalah snapshot."
          : "Tipe baru bisa langsung dipakai saat menambah unit."
      }
      aksi={simpanTipeUnit}
      pemicu={pemicu}
    >
      <input type="hidden" name="kode" value={kode} />
      {data && <input type="hidden" name="id" value={data.id} />}
      <BarisField>
        <Field label="Kode Tipe" nama="kodeTipe" nilai={data?.kode} wajib petunjuk="Mis. T36, NWT, GLL" />
        <Field label="Nama" nama="nama" nilai={data?.nama} wajib />
      </BarisField>
      <BarisField>
        <Field label="Luas Bangunan" nama="luasBangunan" nilai={data?.luasBangunan} tipe="number" satuan="m²" wajib />
        <Field label="Luas Tanah" nama="luasTanah" nilai={data?.luasTanah} tipe="number" satuan="m²" wajib />
      </BarisField>
    </FormModal>
  );
}

export function TambahTipeUnit({ kode }: { kode: string }) {
  return <FormTipeUnit kode={kode} pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah Tipe" />} />;
}

export function AksiTipeUnit({
  kode,
  data,
  dipakai,
}: {
  kode: string;
  data: { id: string; kode: string; nama: string; luasBangunan: number; luasTanah: number };
  dipakai: number;
}) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      <FormTipeUnit
        kode={kode}
        data={data}
        pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah tipe ${data.nama}`} />}
      />
      {/* Tombol hapus disembunyikan bila tipe masih dipakai — server juga
          menolaknya, ini sekadar tidak menawarkan yang pasti gagal. */}
      {dipakai === 0 && <TombolHapus aksi={hapusTipeUnit} id={data.id} nama={`tipe ${data.nama}`} />}
    </div>
  );
}

/* ===================== UNIT ===================== */

export function EditUnit({
  data,
  fases,
}: {
  data: {
    id: string; label: string; nomor: number; phaseId: string; luasTanah: number;
    statusJual: string;
    /** ISO yyyy-mm-dd, atau null bila belum diserahterimakan. */
    tanggalSerahTerima: string | null;
  };
  fases: { id: string; kode: string }[];
}) {
  const [statusJual, setStatusJual] = useState(data.statusJual);
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 } as const;

  return (
    <FormModal
      judul={`Ubah Deskripsi Unit ${data.label}`}
      aksi={ubahUnit}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah unit ${data.label}`} />}
      lebar={560}
    >
      <input type="hidden" name="id" value={data.id} />

      <BarisField>
        <Field label="Nomor Unit" nama="nomor" nilai={data.nomor} tipe="number" wajib />
        <div>
          <label style={labelStyle}>Fase</label>
          <select name="phaseId" className="inp" defaultValue={data.phaseId}>
            {fases.map((f) => (
              <option key={f.id} value={f.id}>{f.kode}</option>
            ))}
          </select>
        </div>
      </BarisField>

      <BarisField>
        <div>
          <label style={labelStyle}>Status Jual</label>
          <select
            name="statusJual"
            className="inp"
            value={statusJual}
            onChange={(e) => setStatusJual(e.target.value)}
          >
            {STATUS_JUAL.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <Field label="Luas Tanah" nama="luasTanah" nilai={data.luasTanah} tipe="number" satuan="m²" />
      </BarisField>

      {statusJual === "Serah Terima" && (
        <BarisField kolom={1}>
          <div>
            <label style={labelStyle}>Tanggal Serah Terima</label>
            <input
              type="date"
              name="tanggalSerahTerima"
              className="inp"
              defaultValue={data.tanggalSerahTerima ?? ""}
            />
          </div>
        </BarisField>
      )}

      <Petunjuk>
        Kode unit ter-generate otomatis dari Fase + Nomor. <b>Status Bangun</b>{" "}
        dihitung otomatis dari progres konstruksi, status jual, dan tanggal serah
        terima — tidak diisi manual. Unit yang sudah diserahterimakan berstatus
        &ldquo;Masa Garansi&rdquo; hingga 3 bulan, lalu menjadi &ldquo;Selesai&rdquo;.
      </Petunjuk>
    </FormModal>
  );
}

export function TambahUnit({
  kode,
  fases,
  tipes,
  nomorBerikutnya,
}: {
  kode: string;
  fases: { id: string; kode: string }[];
  tipes: { id: string; nama: string; luasBangunan: number; luasTanah: number }[];
  nomorBerikutnya: number;
}) {
  return (
    <FormModal
      judul="Tambah Unit"
      aksi={tambahUnit}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah Unit" />}
    >
      <input type="hidden" name="kode" value={kode} />

      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Fase <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <select name="phaseId" className="inp" required>
            {fases.map((f) => (
              <option key={f.id} value={f.id}>{f.kode}</option>
            ))}
          </select>
        </div>
        <Field label="Nomor Unit" nama="nomor" nilai={nomorBerikutnya} tipe="number" wajib />
      </BarisField>

      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Tipe Unit <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <select name="unitTypeId" className="inp" required>
            {tipes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nama} · LB {t.luasBangunan} m²
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Luas Tanah"
          nama="luasTanah"
          nilai={tipes[0]?.luasTanah ?? 0}
          tipe="number"
          satuan="m²"
        />
      </BarisField>

      <Petunjuk jarak={"0 0 14px"}>
        Luas bangunan, dokumen, BOQ, RAB &amp; RAP mengikuti tipe. Luas tanah diisi
        per unit. Unit baru selalu mulai &ldquo;Belum Terbangun&rdquo; (progres 0) —
        Status Bangun dihitung otomatis dari kemajuan konstruksi.
      </Petunjuk>

      <BarisField kolom={1}>
        <Field label="Status Jual" nama="statusJual" nilai="Tersedia" pilihan={STATUS_JUAL} />
      </BarisField>
    </FormModal>
  );
}

export function HapusUnit({ id, label }: { id: string; label: string }) {
  return <TombolHapus aksi={hapusUnit} id={id} nama={`unit ${label}`} />;
}

/* ===================== SARPRAS ===================== */

function FormSarpras({
  kode,
  data,
  pemicu,
}: {
  kode: string;
  data?: {
    id: string; nama: string; jenis: string; volume: string;
    status: string; progress: number;
    /** Benar bila item ini sudah punya baris BOQ — progres jadi turunan opname. */
    dariBoq: boolean;
  };
  pemicu: (buka: () => void) => React.ReactNode;
}) {
  return (
    <FormModal
      judul={data ? "Ubah Data Sarana & Prasarana" : "Tambah Item Sarana & Prasarana"}
      keterangan={data ? "RAB mengikuti tabel BOQ di Detail Sarana & Prasarana — ubah lewat tabelnya." : undefined}
      aksi={simpanSarpras}
      pemicu={pemicu}
    >
      <input type="hidden" name="kode" value={kode} />
      {data && <input type="hidden" name="id" value={data.id} />}
      <BarisField kolom={1}>
        <Field label="Nama Item" nama="nama" nilai={data?.nama} wajib petunjuk="mis. Saluran Drainase" />
      </BarisField>
      <BarisField>
        <Field label="Jenis" nama="jenis" nilai={data?.jenis ?? "Prasarana"} pilihan={JENIS_SARPRAS} />
        <Field label="Volume" nama="volume" nilai={data?.volume} wajib petunjuk="mis. 420 m" />
      </BarisField>
      {data && (
        <BarisField kolom={1}>
          {data.dariBoq ? (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                Progres
              </label>
              <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
                <b>{data.progress}%</b> — dari opname BOQ, tidak bisa diisi di sini. Status
                bangun dihitung otomatis dari progres ini.
              </div>
            </div>
          ) : (
            <Field label="Progres" nama="progress" nilai={data.progress} tipe="number" satuan="%" petunjuk="Status bangun otomatis dari progres" />
          )}
        </BarisField>
      )}
    </FormModal>
  );
}

export function TambahSarpras({ kode }: { kode: string }) {
  return (
    <FormSarpras
      kode={kode}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah Item" />}
    />
  );
}

export function AksiSarpras({
  kode,
  data,
  terkontrak,
}: {
  kode: string;
  data: {
    id: string; nama: string; jenis: string; volume: string;
    status: string; progress: number; dariBoq: boolean;
  };
  terkontrak: number;
}) {
  return (
    <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
      <FormSarpras
        kode={kode}
        data={data}
        pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah ${data.nama}`} />}
      />
      {terkontrak === 0 && <TombolHapus aksi={hapusSarpras} id={data.id} nama={data.nama} />}
    </div>
  );
}
