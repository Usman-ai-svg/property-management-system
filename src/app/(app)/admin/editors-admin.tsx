"use client";

import { useState } from "react";
import {
  BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah,
} from "@/components/form";
import { STATUS_LAHAN, STATUS_PROYEK } from "@/lib/domain/enums";
import {
  hapusFase, hapusProyek, hapusUser, simpanFase, tambahProyek, tambahUser,
  ubahProyek, ubahUser,
} from "./actions";

/* ===================== PROYEK ===================== */

export function TambahProyek() {
  return (
    <FormModal
      judul="Buat Proyek Baru"
      keterangan="Proyek dibuat beserta fase pertamanya dan business plan kosong."
      aksi={tambahProyek}
      labelSimpan="Buat Proyek"
      lebar={640}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Buat Proyek" />}
    >
      <BarisField>
        <Field label="Kode" nama="kode" wajib petunjuk="2–8 huruf/angka, mis. NT5" />
        <Field label="Fase Pertama" nama="kodeFase" nilai="F1" petunjuk="bisa ditambah lagi nanti" />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Nama Proyek" nama="nama" wajib />
      </BarisField>

      <BarisField>
        <Field label="Status" nama="status" nilai={STATUS_PROYEK[0]} pilihan={STATUS_PROYEK} />
        <Field label="Status Lahan" nama="statusLahan" nilai={STATUS_LAHAN[0]} pilihan={STATUS_LAHAN} />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Alamat" nama="alamat" wajib />
      </BarisField>

      <BarisField>
        <Field label="Kelurahan" nama="kelurahan" wajib />
        <Field label="Kecamatan" nama="kecamatan" wajib />
      </BarisField>

      <BarisField>
        <Field label="Kota / Kabupaten" nama="kota" wajib />
        <Field label="Provinsi" nama="provinsi" wajib />
      </BarisField>

      <BarisField>
        <Field label="Luas Kavling Efektif" nama="luasKavlingEfektif" nilai={0} tipe="number" satuan="m²" />
        <Field label="Luas Sarana" nama="luasSarana" nilai={0} tipe="number" satuan="m²" />
      </BarisField>

      <BarisField>
        <Field label="Luas Prasarana" nama="luasPrasarana" nilai={0} tipe="number" satuan="m²" />
        <Field label="Luas RTH" nama="luasRth" nilai={0} tipe="number" satuan="m²" />
      </BarisField>

      <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
        Biaya perolehan lahan diisi kemudian dari halaman Landbank. Pin lokasi diisi
        dari Master Proyek.
      </p>
    </FormModal>
  );
}

export function UbahProyek({
  proyek,
}: {
  proyek: { id: string; kode: string; nama: string; status: string; statusLahan: string };
}) {
  return (
    <FormModal
      judul={`Ubah Proyek ${proyek.kode}`}
      keterangan="Lokasi, luas, dan legalitas disunting dari Master Proyek."
      aksi={ubahProyek}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah proyek ${proyek.kode}`} />}
    >
      <input type="hidden" name="id" value={proyek.id} />
      <BarisField kolom={1}>
        <Field label="Nama Proyek" nama="nama" nilai={proyek.nama} wajib />
      </BarisField>
      <BarisField>
        <Field label="Status" nama="status" nilai={proyek.status} pilihan={STATUS_PROYEK} />
        <Field label="Status Lahan" nama="statusLahan" nilai={proyek.statusLahan} pilihan={STATUS_LAHAN} />
      </BarisField>
    </FormModal>
  );
}

export function HapusProyek({ id, kode }: { id: string; kode: string }) {
  return <TombolHapus aksi={hapusProyek} id={id} nama={`proyek ${kode}`} />;
}

/* ===================== FASE ===================== */

export function KelolaFase({
  projectId,
  kodeProyek,
  fases,
}: {
  projectId: string;
  kodeProyek: string;
  fases: { id: string; kode: string; nama: string | null; urutan: number; jumlahUnit: number }[];
}) {
  return (
    <FormModal
      judul={`Tambah Fase · ${kodeProyek}`}
      keterangan={`${fases.length} fase saat ini: ${fases.map((f) => f.kode).join(", ") || "belum ada"}`}
      aksi={simpanFase}
      labelSimpan="Tambah Fase"
      pemicu={(buka) => (
        <button
          type="button"
          className="btn-garis"
          onClick={buka}
          style={{ fontSize: 11, padding: "3px 8px" }}
        >
          + Fase
        </button>
      )}
    >
      <input type="hidden" name="id" value="" />
      <input type="hidden" name="projectId" value={projectId} />
      <BarisField>
        <Field label="Kode Fase" nama="kode" wajib petunjuk="mis. F5" />
        <Field label="Nama Fase" nama="nama" petunjuk="opsional" />
      </BarisField>

      {fases.length > 0 && (
        <div className="card" style={{ padding: "10px 12px", background: "#f8fafb", marginBottom: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Fase yang sudah ada</div>
          {fases.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex", justifyContent: "space-between", gap: 10,
                fontSize: 11.5, padding: "3px 0", color: "var(--muted)",
              }}
            >
              <span>{f.kode}{f.nama ? ` · ${f.nama}` : ""}</span>
              <span>{f.jumlahUnit} unit</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
        Fase yang masih dipakai unit tidak bisa dihapus — unitnya akan kehilangan fase.
      </p>
    </FormModal>
  );
}

export function UbahFase({
  fase,
}: {
  fase: { id: string; kode: string; nama: string | null; urutan: number };
}) {
  return (
    <FormModal
      judul={`Ubah Fase ${fase.kode}`}
      aksi={simpanFase}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah fase ${fase.kode}`} />}
    >
      <input type="hidden" name="id" value={fase.id} />
      <BarisField>
        <Field label="Kode Fase" nama="kode" nilai={fase.kode} wajib />
        <Field label="Urutan" nama="urutan" nilai={fase.urutan} tipe="number" />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Nama Fase" nama="nama" nilai={fase.nama ?? ""} />
      </BarisField>
    </FormModal>
  );
}

export function HapusFase({ id, kode }: { id: string; kode: string }) {
  return <TombolHapus aksi={hapusFase} id={id} nama={`fase ${kode}`} />;
}

/* ===================== PENGGUNA ===================== */

export interface UserForm {
  id: string;
  nama: string;
  email: string;
  inisial: string;
  semuaProyek: boolean;
  peranIds: string[];
  proyekIds: string[];
}

/**
 * Isian pengguna.
 *
 * Peran dipilih sebagai daftar centang karena satu orang memang boleh memegang
 * beberapa peran — Rina Safitri adalah Head Operation Office sekaligus Admin.
 * Yang berlaku saat memakai aplikasi hanyalah peran aktif yang dipilih di bilah
 * samping, tetapi seluruh peran yang dimiliki menentukan pilihannya.
 */
function IsianUser({
  nilai,
  peran,
  proyek,
}: {
  nilai?: UserForm;
  peran: { id: string; nama: string }[];
  proyek: { id: string; kode: string; nama: string }[];
}) {
  const [semua, setSemua] = useState(nilai?.semuaProyek ?? false);
  const [peranDipilih, setPeranDipilih] = useState<string[]>(nilai?.peranIds ?? []);
  const [proyekDipilih, setProyekDipilih] = useState<string[]>(nilai?.proyekIds ?? []);

  const toggle = (
    daftar: string[],
    set: (d: string[]) => void,
    id: string,
  ) => set(daftar.includes(id) ? daftar.filter((x) => x !== id) : [...daftar, id]);

  return (
    <>
      {peranDipilih.map((id) => (
        <input key={id} type="hidden" name="peranId" value={id} />
      ))}
      {!semua && proyekDipilih.map((id) => (
        <input key={id} type="hidden" name="proyekId" value={id} />
      ))}
      <input type="hidden" name="semuaProyek" value={semua ? "ya" : "tidak"} />

      <BarisField>
        <Field label="Nama" nama="nama" nilai={nilai?.nama} wajib />
        <Field label="Inisial" nama="inisial" nilai={nilai?.inisial ?? ""} petunjuk="kosongkan untuk otomatis" />
      </BarisField>

      <BarisField>
        <Field label="Email" nama="email" nilai={nilai?.email} wajib />
        <Field
          label={nilai ? "Kata Sandi Baru" : "Kata Sandi"}
          nama="sandi"
          wajib={!nilai}
          petunjuk={nilai ? "kosongkan bila tidak diganti" : "minimal 8 karakter"}
        />
      </BarisField>

      <BarisField kolom={1}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Peran <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <div
            style={{
              maxHeight: 150, overflowY: "auto", border: "1px solid var(--line)",
              borderRadius: 9, padding: "8px 10px",
            }}
          >
            {peran.map((r) => (
              <label
                key={r.id}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 12, padding: "3px 0", cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={peranDipilih.includes(r.id)}
                  onChange={() => toggle(peranDipilih, setPeranDipilih, r.id)}
                />
                {r.nama}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5, lineHeight: 1.55 }}>
            {peranDipilih.length} peran dipilih. Yang berlaku saat dipakai hanyalah peran
            aktif yang dipilih di bilah samping — beberapa peran berarti bisa berganti-ganti.
          </div>
        </div>
      </BarisField>

      <BarisField kolom={1}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Akses Proyek
          </label>
          <label
            style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 12, marginBottom: 8, cursor: "pointer",
            }}
          >
            <input type="checkbox" checked={semua} onChange={(e) => setSemua(e.target.checked)} />
            Seluruh proyek, termasuk yang dibuat kemudian
          </label>

          {!semua && (
            <div
              style={{
                maxHeight: 150, overflowY: "auto", border: "1px solid var(--line)",
                borderRadius: 9, padding: "8px 10px",
              }}
            >
              {proyek.map((p) => (
                <label
                  key={p.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 12, padding: "3px 0", cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={proyekDipilih.includes(p.id)}
                    onChange={() => toggle(proyekDipilih, setProyekDipilih, p.id)}
                  />
                  {p.kode} · {p.nama}
                </label>
              ))}
            </div>
          )}
        </div>
      </BarisField>
    </>
  );
}

export function TambahUser({
  peran,
  proyek,
}: {
  peran: { id: string; nama: string }[];
  proyek: { id: string; kode: string; nama: string }[];
}) {
  return (
    <FormModal
      judul="Tambah Pengguna"
      keterangan="Kata sandi langsung di-hash dan tidak pernah bisa ditampilkan lagi."
      aksi={tambahUser}
      labelSimpan="Tambah"
      lebar={620}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah Pengguna" />}
    >
      <IsianUser peran={peran} proyek={proyek} />
    </FormModal>
  );
}

export function UbahUser({
  user,
  peran,
  proyek,
}: {
  user: UserForm;
  peran: { id: string; nama: string }[];
  proyek: { id: string; kode: string; nama: string }[];
}) {
  return (
    <FormModal
      judul={`Ubah ${user.nama}`}
      aksi={ubahUser}
      lebar={620}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah pengguna ${user.nama}`} />}
    >
      <input type="hidden" name="id" value={user.id} />
      <IsianUser nilai={user} peran={peran} proyek={proyek} />
    </FormModal>
  );
}

export function HapusUser({ id, nama }: { id: string; nama: string }) {
  return <TombolHapus aksi={hapusUser} id={id} nama={nama} />;
}
