"use client";

import { useState } from "react";
import {
  BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah,
} from "@/components/form";
import { hapusUser, tambahUser, ubahUser } from "./actions";

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
