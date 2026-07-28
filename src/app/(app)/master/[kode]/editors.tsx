"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah, TombolUbah,
} from "@/components/form";
import { JENIS_SARPRAS, STATUS_JUAL, STATUS_PEMBANGUNAN, STATUS_SARPRAS } from "@/lib/domain/enums";
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
  legalitas: { id: string; nib: string; sertifikat: string; luas: number }[];
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

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, margin: "10px 0 5px" }}>
            Keterangan Sertifikat
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
        onClick={() => setDraft((d) => [...d, { nib: "", sertifikat: "", luas: 0 }])}
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
}: {
  data: {
    id: string; label: string; luasTanah: number;
    statusPembangunan: string; statusJual: string; progress: number;
    /** Benar bila progres unit ini turunan dari BOQ Master, bukan isian satu angka. */
    dariBoq: boolean;
  };
}) {
  return (
    <FormModal
      judul={`Ubah Deskripsi Unit ${data.label}`}
      keterangan="Perubahan progres dicatat sebagai titik riwayat baru, bukan menimpa angka sebelumnya."
      aksi={ubahUnit}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah unit ${data.label}`} />}
    >
      <input type="hidden" name="id" value={data.id} />
      <BarisField>
        <Field label="Status Bangun" nama="statusPembangunan" nilai={data.statusPembangunan} pilihan={STATUS_PEMBANGUNAN} />
        <Field label="Status Jual" nama="statusJual" nilai={data.statusJual} pilihan={STATUS_JUAL} />
      </BarisField>
      <BarisField>
        {data.dariBoq ? (
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
              Progres
            </label>
            <input type="hidden" name="progress" value={data.progress} />
            <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
              <b>{data.progress}%</b> — dari opname BOQ, tidak bisa diisi di sini.
            </div>
          </div>
        ) : (
          <Field label="Progres" nama="progress" nilai={data.progress} tipe="number" satuan="%" />
        )}
        <Field label="Luas Tanah" nama="luasTanah" nilai={data.luasTanah} tipe="number" satuan="m²" />
      </BarisField>
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
        Luas bangunan, dokumen, BOQ, RAB &amp; RAP mengikuti tipe. Luas tanah diisi per unit.
      </Petunjuk>

      <BarisField>
        <Field label="Status Bangun" nama="statusPembangunan" nilai="Belum terbangun" pilihan={STATUS_PEMBANGUNAN} />
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
  bolehHarga,
}: {
  kode: string;
  data?: {
    id: string; nama: string; jenis: string; volume: string;
    status: string; progress: number; rab?: number;
  };
  pemicu: (buka: () => void) => React.ReactNode;
  bolehHarga: boolean;
}) {
  return (
    <FormModal
      judul={data ? "Ubah Data Sarana & Prasarana" : "Tambah Item Sarana & Prasarana"}
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
      <BarisField>
        <Field label="Status Bangun" nama="status" nilai={data?.status ?? "Belum terbangun"} pilihan={STATUS_SARPRAS} />
        <Field label="Progres" nama="progress" nilai={data?.progress ?? 0} tipe="number" satuan="%" />
      </BarisField>
      {bolehHarga && (
        <BarisField kolom={1}>
          <Field label="RAB" nama="rab" nilai={data?.rab ?? 0} tipe="number" satuan="Rp" />
        </BarisField>
      )}
    </FormModal>
  );
}

export function TambahSarpras({ kode, bolehHarga }: { kode: string; bolehHarga: boolean }) {
  return (
    <FormSarpras
      kode={kode}
      bolehHarga={bolehHarga}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah Item" />}
    />
  );
}

export function AksiSarpras({
  kode,
  data,
  terkontrak,
  bolehHarga,
}: {
  kode: string;
  data: {
    id: string; nama: string; jenis: string; volume: string;
    status: string; progress: number; rab?: number;
  };
  terkontrak: number;
  bolehHarga: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
      <FormSarpras
        kode={kode}
        data={data}
        bolehHarga={bolehHarga}
        pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah ${data.nama}`} />}
      />
      {terkontrak === 0 && <TombolHapus aksi={hapusSarpras} id={data.id} nama={data.nama} />}
    </div>
  );
}
