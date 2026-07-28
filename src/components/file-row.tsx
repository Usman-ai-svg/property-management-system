"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { BarisField, FormModal } from "@/components/form";
import type { HasilAksi } from "@/lib/actions/guard";
import { tanggal, ukuranFile } from "@/lib/format";
import { Petunjuk } from "@/components/ui";

/**
 * Baris dokumen dengan nomor revisi dan riwayat versi.
 *
 * Aksi unggah diterima lewat prop, bukan diimpor dari `app/`. Komponen di
 * `components/` tidak boleh bergantung pada halaman yang memakainya — arah
 * impor yang terbalik membuat komponen ini tidak bisa dipindah sendirian.
 *
 * Berkas benar-benar diunggah dan disimpan. Tautan "Lihat" mengarah ke rute
 * yang memeriksa hak akses lebih dulu, bukan ke berkas statis — supaya tautan
 * gambar kerja tidak bisa diteruskan ke siapa pun tanpa pemeriksaan.
 */

export interface VersiDokumen {
  id: string;
  revisi: string;
  namaFile: string;
  ukuranByte: number;
  objectKey: string | null;
  diunggahPada: string | Date;
}

export interface DokumenTampil {
  id: string;
  kategori: string;
  versi: VersiDokumen[];
}

function TautanLihat({ versi }: { versi: VersiDokumen }) {
  if (!versi.objectKey) {
    return (
      <span
        style={{ color: "var(--muted)", fontSize: 11 }}
        title="Revisi ini tercatat sebelum penyimpanan berkas aktif"
      >
        berkas tidak tersedia
      </span>
    );
  }
  return (
    <a
      href={`/api/dokumen/${versi.id}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "var(--teal)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
    >
      Lihat
    </a>
  );
}

/** Jenis berkas yang diterima bila kategorinya tidak eksplisit membatasi. */
const TERIMA_BAWAAN = ".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.skp,.dwg,.rvt";

export function FileRow({
  label,
  dokumen,
  bolehUbah,
  konteks,
  pemilik,
  aksiUnggah,
  terima,
}: {
  label: string;
  dokumen: DokumenTampil | null;
  bolehUbah: boolean;
  konteks: string;
  pemilik: { jenis: string; id: string; kategori: string };
  aksiUnggah: (sebelumnya: HasilAksi | null, form: FormData) => Promise<HasilAksi>;
  /** Ekstensi yang diterima untuk kategori dokumen ini, mis. ".pdf". Bila
   *  kosong, dipakai daftar umum yang mencakup seluruh jenis berkas yang
   *  didukung aplikasi. */
  terima?: string;
}) {
  const [bukaVersi, setBukaVersi] = useState(false);

  const versiTerbaru = dokumen?.versi[0] ?? null;
  const versiLama = dokumen?.versi.slice(1) ?? [];
  const revisi = versiTerbaru?.revisi ?? null;

  return (
    <div style={{ borderBottom: "1px solid var(--garis-halus)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0" }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: versiTerbaru ? "var(--rona-teal2)" : "var(--rona-kosong)",
            display: "grid", placeItems: "center",
            color: versiTerbaru ? "var(--teal)" : "var(--rona-ikon)", flexShrink: 0,
          }}
        >
          <FileText size={15} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            {label}
            {revisi && (
              <span className="chip" style={{ background: "var(--rona-teal)", color: "var(--teal)" }}>
                {revisi}
              </span>
            )}
          </div>
          {versiTerbaru ? (
            <div
              style={{
                fontSize: 10.5, color: "var(--muted)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {versiTerbaru.namaFile}
              {versiTerbaru.ukuranByte > 0 && ` · ${ukuranFile(versiTerbaru.ukuranByte)}`}
              {" · "}
              {tanggal(versiTerbaru.diunggahPada)}
            </div>
          ) : (
            <div style={{ fontSize: 10.5, color: "var(--amber)" }}>Belum diunggah</div>
          )}
        </div>

        {versiTerbaru && <TautanLihat versi={versiTerbaru} />}

        {bolehUbah && (
          <FormModal
            judul="Unggah Revisi Dokumen"
            keterangan={konteks}
            aksi={aksiUnggah}
            labelSimpan="Unggah"
            pemicu={(buka) => (
              <button
                type="button"
                onClick={buka}
                style={{
                  color: "var(--teal)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: "none", border: "none", padding: 0, fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                {versiTerbaru ? "Unggah Revisi" : "Unggah"}
              </button>
            )}
          >
            <input type="hidden" name="dokumenId" value={dokumen?.id ?? ""} />
            <input type="hidden" name="pemilikJenis" value={pemilik.jenis} />
            <input type="hidden" name="pemilikId" value={pemilik.id} />
            <input type="hidden" name="kategori" value={pemilik.kategori} />
            <input type="hidden" name="label" value={konteks} />

            <BarisField kolom={1}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                  Berkas <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <input
                  className="inp"
                  type="file"
                  name="berkas"
                  required
                  accept={terima || TERIMA_BAWAAN}
                  style={{ padding: "8px 10px" }}
                />
              </div>
            </BarisField>

            <Petunjuk>
              Nomor revisi ditentukan otomatis dan versi sebelumnya tetap tersimpan —
              unggahan baru tidak pernah menimpa yang lama. Maksimum 64 MB.
              Diterima: {terima ? terima.replace(/\./g, "").toUpperCase() : "PDF, JPG, PNG, WEBP, XLSX, DOCX, SKP, DWG, RVT"}.
            </Petunjuk>
          </FormModal>
        )}
      </div>

      {versiLama.length > 0 && (
        <div style={{ paddingBottom: 8 }}>
          <button
            type="button"
            onClick={() => setBukaVersi(!bukaVersi)}
            style={{
              fontSize: 11, color: "var(--muted)", cursor: "pointer",
              background: "none", border: "none", padding: 0, fontFamily: "inherit",
            }}
          >
            {bukaVersi ? "▾" : "▸"} {versiLama.length} versi sebelumnya
          </button>
          {bukaVersi &&
            versiLama.map((v) => (
              <div
                key={v.id}
                style={{
                  display: "flex", justifyContent: "space-between", gap: 10,
                  fontSize: 11, color: "var(--muted)", padding: "3px 0 3px 14px",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {v.revisi} · {v.namaFile}
                </span>
                <span style={{ whiteSpace: "nowrap", display: "flex", gap: 8 }}>
                  {tanggal(v.diunggahPada)}
                  <TautanLihat versi={v} />
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
