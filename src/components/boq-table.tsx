"use client";

import { Fragment, useState, useTransition, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import type { HasilAksi } from "@/lib/actions/guard";
import { rp } from "@/lib/format";
import { ModalImpor } from "./impor";
import { bobotBaris, totalBaris } from "@/lib/calc/boq";

/**
 * Tabel BOQ dengan mode sunting menyeluruh, meniru artifact.
 *
 * Tombol "Ubah" mengubah seluruh sel jadi isian sekaligus, lalu "Simpan"
 * mengirim semuanya dalam satu aksi. Ini disengaja mengikuti cara kerja
 * artifact — bukan sunting per baris — karena penyusunan BOQ memang biasanya
 * dilakukan sekaligus, bukan satu-satu.
 *
 * Terstruktur per kelompok pekerjaan, sama seperti RapTable: kelompok bisa
 * ditambah, diganti namanya, atau dihapus — bukan hanya barisnya. "+ Tambah
 * Baris" menambah baris pada kelompok tempat tombolnya ditekan, bukan selalu
 * ke satu kelompok tetap.
 *
 * "Batal" mengembalikan ke keadaan sebelum disunting tanpa menyentuh database.
 */

export interface BarisBoqUI {
  id?: string;
  grup: string;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  spesifikasi?: string | null;
}

interface Kelompok {
  nama: string;
  items: BarisBoqUI[];
}

const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];

const sel = {
  fontSize: 11,
  padding: "3px 6px",
} as const;

const BARIS_BARU: Omit<BarisBoqUI, "grup"> = {
  uraian: "Pekerjaan baru", satuan: "ls", volume: 1, hargaSatuan: 0, spesifikasi: "",
};

/** Susun baris datar menjadi kelompok, dengan urutan kemunculan pertama. */
function kelompokkan(baris: BarisBoqUI[]): Kelompok[] {
  const peta = new Map<string, BarisBoqUI[]>();
  for (const b of baris) {
    const ada = peta.get(b.grup);
    if (ada) ada.push(b);
    else peta.set(b.grup, [b]);
  }
  return [...peta.entries()].map(([nama, items]) => ({ nama, items }));
}

export function BoqTable({
  judul,
  baris,
  bolehHarga,
  bolehUbah,
  aksiSimpan,
  konteksImpor,
  sasaranImpor,
  idImpor,
  aksiImpor,
  aksiTambahan,
  aksiSuntingTambahan,
  tanpaImporBawaan,
}: {
  judul: string;
  baris: BarisBoqUI[];
  bolehHarga: boolean;
  bolehUbah: boolean;
  /** Menerima seluruh kelompok sebagai JSON dan menyimpannya. */
  aksiSimpan: (dataJson: string) => Promise<HasilAksi>;
  konteksImpor?: string;
  /** Sasaran dan id untuk impor Excel. */
  sasaranImpor?: "unit" | "kerjaTambah" | "sarpras" | "tipeUnit";
  idImpor?: string;
  /** Aksi impor Excel — diterima lewat prop supaya komponen ini tidak
   *  mengimpor dari `app/`. */
  aksiImpor?: (sebelumnya: HasilAksi | null, form: FormData) => Promise<HasilAksi>;
  /** Aksi mandiri di kepala saat TIDAK menyunting, mis. "Impor Excel" (ganti semua). */
  aksiTambahan?: ReactNode;
  /**
   * Aksi yang hanya muncul saat menyunting dan MENYUNTIK baris ke draf, mis.
   * "Tambah Baris" dari pustaka AHSP. Menerima callback `tambah` agar baris baru
   * langsung tampil di mode Ubah — bukan lewat tulis-ke-DB yang butuh Simpan dulu.
   */
  aksiSuntingTambahan?: (tambah: (rows: BarisBoqUI[]) => void) => ReactNode;
  /** Sembunyikan tombol Impor Excel bawaan (bila pemanggil punya impornya sendiri). */
  tanpaImporBawaan?: boolean;
}) {
  const [sunting, setSunting] = useState(false);
  const [draft, setDraft] = useState<Kelompok[]>(() => kelompokkan(baris));
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, mulai] = useTransition();

  const kelompok = sunting ? draft : kelompokkan(baris);
  const total = totalBaris(kelompok.flatMap((g) => g.items));

  const mulaiSunting = () => {
    setDraft(kelompokkan(baris).map((g) => ({ ...g, items: g.items.map((i) => ({ ...i })) })));
    setGalat(null);
    setSunting(true);
  };

  const batal = () => {
    setSunting(false);
    setGalat(null);
  };

  const simpan = () =>
    mulai(async () => {
      const hasil = await aksiSimpan(JSON.stringify({ kelompok: draft }));
      if (hasil.ok) {
        setSunting(false);
        setGalat(null);
      } else {
        setGalat(hasil.error);
      }
    });

  /**
   * Suntikkan baris baru ke draf yang sedang disunting. Baris digabung ke
   * kelompok bernama sama bila ada, atau kelompok baru bila belum ada — sehingga
   * hasil "Tambah Baris" langsung terlihat tanpa harus Simpan lebih dulu.
   */
  const tambahBaris = (rows: BarisBoqUI[]) =>
    setDraft((d) => {
      const next = d.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i })) }));
      for (const r of rows) {
        const nama = r.grup?.trim() || "Kelompok Baru";
        let g = next.find((x) => x.nama === nama);
        if (!g) {
          g = { nama, items: [] };
          next.push(g);
        }
        g.items.push({ ...r, grup: nama });
      }
      return next;
    });

  const ubahItem = (gi: number, ii: number, field: keyof BarisBoqUI, nilai: string | number) =>
    setDraft((d) =>
      d.map((g, x) =>
        x !== gi ? g : { ...g, items: g.items.map((it, y) => (y === ii ? { ...it, [field]: nilai } : it)) },
      ),
    );

  const isian = (
    gi: number, ii: number, field: keyof BarisBoqUI, angka?: boolean,
  ) => (
    <input
      className="inp"
      type={angka ? "number" : "text"}
      value={String(kelompok[gi].items[ii][field] ?? "")}
      onChange={(e) => ubahItem(gi, ii, field, angka ? Number(e.target.value) || 0 : e.target.value)}
      // Isian mengisi penuh lebar kolom (yang sudah dikunci colgroup) — bukan
      // lebar tetap dalam px — agar kolom tak bergeser saat masuk mode Ubah.
      style={{ ...sel, width: "100%", boxSizing: "border-box", textAlign: angka ? "right" : "left" }}
    />
  );

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 8, flexWrap: "wrap", gap: 8,
        }}
      >
        <div className="eyebrow">{judul}</div>
        {bolehHarga && bolehUbah && (
          <div style={{ display: "flex", gap: 6 }}>
            {/* Di luar mode sunting: aksi mandiri (mis. Impor Excel — ganti semua).
                Dalam mode sunting: tombol tambah baris yang menyuntik ke draf,
                sejajar dengan tautan "+ Tambah baris" di dalam tabel. */}
            {!sunting && aksiTambahan}
            {sunting && aksiSuntingTambahan?.(tambahBaris)}
            {!tanpaImporBawaan && aksiImpor && sasaranImpor && idImpor && (
              <ModalImpor
                jenis="BOQ / RAB"
                konteks={konteksImpor ?? ""}
                kolom="Grup · Uraian Pekerjaan · Satuan · Volume · Harga Satuan · Spesifikasi"
                sasaran={sasaranImpor}
                id={idImpor}
                aksiImpor={aksiImpor}
              />
            )}
            {sunting && (
              <button type="button" className="btn-garis" style={{ color: "var(--muted)" }} onClick={batal}>
                Batal
              </button>
            )}
            <button
              type="button"
              className={sunting ? "btn-utama aktif" : "btn-utama"}
              onClick={sunting ? simpan : mulaiSunting}
              disabled={menyimpan}
            >
              {menyimpan ? "Menyimpan…" : sunting ? "Simpan" : "Ubah"}
            </button>
          </div>
        )}
      </div>

      {galat && (
        <div
          role="alert"
          style={{
            display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8,
            padding: "9px 12px", borderRadius: 9, background: "var(--rona-merah)",
            color: "var(--red)", fontSize: 12.5, lineHeight: 1.5,
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          {galat}
        </div>
      )}

      <div className="card tablewrap" style={{ maxHeight: 520, overflowY: "auto" }}>
        {/* table-layout: fixed + colgroup — lebar kolom SAMA di mode lihat & Ubah,
            supaya kolom tidak bergeser saat sel berubah jadi isian. */}
        <table style={{ tableLayout: "fixed", minWidth: bolehHarga ? 920 : 660 }}>
          <colgroup>
            <col style={{ width: 40 }} />
            <col />
            <col style={{ width: 72 }} />
            <col style={{ width: 56 }} />
            {bolehHarga && <col style={{ width: 120 }} />}
            {bolehHarga && <col style={{ width: 120 }} />}
            <col style={{ width: 72 }} />
            <col style={{ width: 220 }} />
            {sunting && <col style={{ width: 40 }} />}
          </colgroup>
          <thead>
            <tr>
              <th>No.</th>
              <th>Uraian Pekerjaan</th>
              <th style={{ textAlign: "right" }}>Vol</th>
              <th>Sat</th>
              {bolehHarga && <th style={{ textAlign: "right" }}>Harga Satuan</th>}
              {bolehHarga && <th style={{ textAlign: "right" }}>Subtotal</th>}
              <th style={{ textAlign: "right" }}>Bobot</th>
              <th>Spesifikasi</th>
              {sunting && <th />}
            </tr>
          </thead>
          <tbody>
            {kelompok.map((g, gi) => (
              // Fragment ini yang memegang key-nya — bukan <tr> di dalamnya —
              // karena elemen inilah yang jadi anak langsung dari <tbody>.
              <Fragment key={`grup-${gi}`}>
                <tr style={{ background: "var(--rona-teal)" }}>
                  <td style={{ fontWeight: 700 }}>{ROMAWI[gi] ?? gi + 1}</td>
                  <td
                    colSpan={sunting ? (bolehHarga ? 8 : 6) : (bolehHarga ? 7 : 5)}
                    style={{ fontWeight: 700, textTransform: sunting ? "none" : "uppercase", fontSize: 10.5, letterSpacing: ".04em" }}
                  >
                    {sunting ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          className="inp"
                          value={g.nama}
                          onChange={(e) =>
                            setDraft((d) => d.map((x, y) => (y === gi ? { ...x, nama: e.target.value } : x)))
                          }
                          style={{ ...sel, width: 260, fontWeight: 600 }}
                        />
                        <button
                          type="button"
                          title="Hapus kelompok"
                          onClick={() => setDraft((d) => d.filter((_, y) => y !== gi))}
                          style={{
                            color: "var(--red)", cursor: "pointer", fontWeight: 700,
                            background: "none", border: "none", fontSize: 11.5, fontFamily: "inherit",
                          }}
                        >
                          × kelompok
                        </button>
                      </span>
                    ) : (
                      g.nama
                    )}
                  </td>
                </tr>

                {g.items.map((r, ii) => {
                  const sub = r.volume * r.hargaSatuan;
                  return (
                    <tr key={r.id ?? `${gi}-${ii}`}>
                      <td style={{ color: "var(--muted)" }}>{ii + 1}</td>
                      <td style={{ whiteSpace: "normal" }}>{sunting ? isian(gi, ii, "uraian") : r.uraian}</td>
                      <td style={{ textAlign: "right" }}>
                        {sunting ? isian(gi, ii, "volume", true) : r.volume.toLocaleString("id-ID")}
                      </td>
                      <td>{sunting ? isian(gi, ii, "satuan") : r.satuan}</td>
                      {bolehHarga && (
                        <td style={{ textAlign: "right" }}>
                          {sunting ? isian(gi, ii, "hargaSatuan", true) : rp(r.hargaSatuan)}
                        </td>
                      )}
                      {bolehHarga && (
                        <td className="num" style={{ textAlign: "right" }}>{rp(sub)}</td>
                      )}
                      <td style={{ textAlign: "right", color: "var(--muted)" }}>
                        {bobotBaris(sub, total).toFixed(2)}%
                      </td>
                      <td style={{ whiteSpace: "normal", color: "var(--muted)", lineHeight: 1.45 }}>
                        {sunting ? isian(gi, ii, "spesifikasi") : r.spesifikasi || "—"}
                      </td>
                      {sunting && (
                        <td>
                          <button
                            type="button"
                            title="Hapus baris"
                            onClick={() =>
                              setDraft((d) =>
                                d.map((x, y) =>
                                  y !== gi ? x : { ...x, items: x.items.filter((_, z) => z !== ii) },
                                ),
                              )
                            }
                            style={{
                              color: "var(--red)", cursor: "pointer", fontWeight: 700,
                              background: "none", border: "none", fontSize: 15, padding: 0,
                            }}
                          >
                            ×
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}

                {sunting && (
                  <tr>
                    <td />
                    <td colSpan={bolehHarga ? 8 : 6}>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((d) =>
                            d.map((x, y) =>
                              y !== gi ? x : { ...x, items: [...x.items, { ...BARIS_BARU, grup: x.nama }] },
                            ),
                          )
                        }
                        style={{
                          color: "var(--teal)", cursor: "pointer", fontSize: 11, fontWeight: 600,
                          background: "none", border: "none", padding: 0, fontFamily: "inherit",
                        }}
                      >
                        + Tambah baris pada {g.nama}
                      </button>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}

            {sunting && (
              <tr>
                <td />
                <td colSpan={bolehHarga ? 8 : 6}>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => [
                        ...d,
                        { nama: "Kelompok Baru", items: [{ ...BARIS_BARU, grup: "Kelompok Baru" }] },
                      ])
                    }
                    style={{
                      color: "var(--teal)", cursor: "pointer", fontSize: 11.5, fontWeight: 700,
                      background: "none", border: "none", padding: 0, fontFamily: "inherit",
                    }}
                  >
                    + Tambah kelompok baru
                  </button>
                </td>
              </tr>
            )}

            <tr style={{ fontWeight: 700, borderTop: "2px solid var(--line)", background: "var(--rona-baris)" }}>
              <td colSpan={bolehHarga ? 5 : 4}>TOTAL RAB</td>
              {bolehHarga && (
                <td className="num" style={{ textAlign: "right", color: "var(--brass)" }}>{rp(total)}</td>
              )}
              <td style={{ textAlign: "right" }}>100%</td>
              <td />
              {sunting && <td />}
            </tr>
          </tbody>
        </table>

        {!bolehHarga && (
          <div
            style={{
              padding: "10px 14px", fontSize: 11.5, color: "var(--muted)",
              borderTop: "1px solid var(--line)",
            }}
          >
            Kolom harga tidak ditampilkan untuk peran Anda.
          </div>
        )}
      </div>
    </div>
  );
}
