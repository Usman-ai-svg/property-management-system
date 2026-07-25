"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { BarisField, Field, FormModal } from "@/components/form";
import { unggahRevisi } from "@/app/(app)/master/actions";
import { tanggal, ukuranFile } from "@/lib/format";

/**
 * Baris dokumen dengan nomor revisi dan riwayat versi.
 * Meniru komponen FileRow pada artifact.
 *
 * Catatan: berkas belum benar-benar diunggah. Yang dicatat adalah metadata
 * revisi — nama berkas, nomor revisi, tanggal, dan siapa yang mengunggah.
 * Penyimpanan berkas sungguhan menyusul sebelum peluncuran.
 */

export interface VersiDokumen {
  revisi: string;
  namaFile: string;
  ukuranByte: number;
  diunggahPada: string | Date;
}

export interface DokumenTampil {
  id: string;
  kategori: string;
  versi: VersiDokumen[];
}

export function FileRow({
  label,
  dokumen,
  bolehUbah,
  konteks,
  pemilik,
}: {
  label: string;
  dokumen: DokumenTampil | null;
  bolehUbah: boolean;
  /** Keterangan yang muncul di modal dan log, mis. "Sertifikat NIB 8120…". */
  konteks: string;
  /** Menentukan dokumen ini menempel pada apa, dipakai saat membuat dokumen baru. */
  pemilik: { jenis: string; id: string; kategori: string };
}) {
  const [bukaVersi, setBukaVersi] = useState(false);

  const versiTerbaru = dokumen?.versi[0] ?? null;
  const versiLama = dokumen?.versi.slice(1) ?? [];
  const revisi = versiTerbaru?.revisi ?? null;

  const namaBerikutnya = versiTerbaru
    ? versiTerbaru.namaFile.replace(/(-R\d+)?\.(\w+)$/, `-R${dokumen!.versi.length + 1}.$2`)
    : "dokumen-baru.pdf";

  return (
    <div style={{ borderBottom: "1px solid #eef2f3" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0" }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: versiTerbaru ? "#e7f0f4" : "#f2f5f6",
            display: "grid", placeItems: "center",
            color: versiTerbaru ? "var(--teal)" : "#c3ccd0", flexShrink: 0,
          }}
        >
          <FileText size={15} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            {label}
            {revisi && (
              <span className="chip" style={{ background: "#eef3f4", color: "var(--teal)" }}>
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
              {versiTerbaru.namaFile} · {ukuranFile(versiTerbaru.ukuranByte)} ·{" "}
              {tanggal(versiTerbaru.diunggahPada)}
            </div>
          ) : (
            <div style={{ fontSize: 10.5, color: "var(--amber)" }}>Belum diunggah</div>
          )}
        </div>

        {bolehUbah && (
          <FormModal
            judul="Unggah Revisi Dokumen"
            keterangan={konteks}
            aksi={unggahRevisi}
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
              <Field label="Nama berkas" nama="namaFile" nilai={namaBerikutnya} wajib />
            </BarisField>

            <div
              className="inp"
              style={{
                textAlign: "center", color: "var(--muted)", padding: 22,
                border: "1px dashed var(--line)", marginBottom: 14,
              }}
            >
              ⬆ Pemilihan berkas belum aktif pada demo ini
            </div>

            <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
              Versi sebelumnya tetap tersimpan dan bisa dilihat lewat daftar
              &ldquo;versi sebelumnya&rdquo;. Berkas sesungguhnya belum ikut tersimpan —
              yang dicatat baru nomor revisi, nama berkas, dan waktunya.
            </p>
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
                key={v.revisi}
                style={{
                  display: "flex", justifyContent: "space-between", gap: 10,
                  fontSize: 11, color: "var(--muted)", padding: "3px 0 3px 14px",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {v.revisi} · {v.namaFile}
                </span>
                <span style={{ whiteSpace: "nowrap" }}>{tanggal(v.diunggahPada)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
