"use client";

import { Fragment, useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import type { HasilAksi } from "@/lib/actions/guard";
import { rp } from "@/lib/format";
import { PORSI_LAIN_LAIN, SUBKON_RE } from "@/lib/calc/boq";
import { ModalImpor } from "./impor";

/**
 * Tabel RAP: rincian material per kelompok, ditutup baris MATERIAL, UPAH
 * TENAGA KERJA, dan TOTAL RAP. Meniru komponen RapTable pada artifact,
 * termasuk penomoran kelompok dengan angka romawi.
 *
 * Dalam mode sunting, kelompok bisa ditambah, diganti namanya, atau dihapus —
 * bukan hanya barisnya. Semuanya dikirim sekaligus saat "Simpan".
 */

export interface BarisRapUI {
  id?: string;
  grup: string;
  kategori?: string | null;
  nama: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  keterangan?: string | null;
}

interface Kelompok {
  nama: string;
  /** "Material" | "Subkon" — kategori seluruh baris kelompok ini. */
  kategori: string;
  items: BarisRapUI[];
}

const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];

const sel = { fontSize: 11, padding: "3px 6px" } as const;

const ITEM_BARU: Omit<BarisRapUI, "grup"> = {
  nama: "Material baru", satuan: "ls", volume: 1, hargaSatuan: 0, keterangan: "",
};

/**
 * Kategori efektif sebuah kelompok: kategori eksplisit baris pertama, atau
 * (data lama) "Subkon" bila namanya memuat "subkon". Nama tak lagi menentukan —
 * hanya jaring pengaman untuk data yang belum punya kategori.
 */
function kategoriKelompok(nama: string, items: BarisRapUI[]): string {
  const eksplisit = items.find((i) => i.kategori === "Subkon" || i.kategori === "Material")?.kategori;
  if (eksplisit) return eksplisit;
  return SUBKON_RE.test(nama) ? "Subkon" : "Material";
}

/** Susun baris datar menjadi kelompok, dengan urutan kemunculan pertama. */
function kelompokkan(baris: BarisRapUI[]): Kelompok[] {
  const peta = new Map<string, BarisRapUI[]>();
  for (const b of baris) {
    const ada = peta.get(b.grup);
    if (ada) ada.push(b);
    else peta.set(b.grup, [b]);
  }
  return [...peta.entries()].map(([nama, items]) => ({ nama, kategori: kategoriKelompok(nama, items), items }));
}

export function RapTable({
  judul,
  keterangan,
  baris,
  upahVolume,
  upahHarga,
  bolehHarga,
  bolehUbah,
  aksiSimpan,
  konteksImpor,
  sasaranImpor,
  idImpor,
  aksiImpor,
}: {
  judul: string;
  keterangan?: string;
  baris: BarisRapUI[];
  /** Upah tenaga kerja disatuankan OH (orang-hari): jumlah = volume × harga. */
  upahVolume: number;
  upahHarga: number;
  bolehHarga: boolean;
  bolehUbah: boolean;
  /** Menerima kelompok + upah sebagai JSON. */
  aksiSimpan: (dataJson: string) => Promise<HasilAksi>;
  konteksImpor: string;
  sasaranImpor: "unit" | "kerjaTambah" | "sarpras" | "tipeUnit";
  idImpor: string;
  /** Aksi impor Excel — diterima lewat prop supaya komponen ini tidak
   *  mengimpor dari `app/`. */
  aksiImpor: (sebelumnya: HasilAksi | null, form: FormData) => Promise<HasilAksi>;
}) {
  const [sunting, setSunting] = useState(false);
  const [draft, setDraft] = useState<Kelompok[]>(() => kelompokkan(baris));
  const [draftUpahVolume, setDraftUpahVolume] = useState(upahVolume);
  const [draftUpahHarga, setDraftUpahHarga] = useState(upahHarga);
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, mulai] = useTransition();

  if (!bolehHarga) {
    return (
      <div style={{ marginTop: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>{judul}</div>
        <div
          className="card"
          style={{ padding: 22, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}
        >
          RAP tidak ditampilkan untuk peran Anda.
        </div>
      </div>
    );
  }

  const kelompok = sunting ? draft : kelompokkan(baris);
  const volUpah = sunting ? draftUpahVolume : upahVolume;
  const hargaUpah = sunting ? draftUpahHarga : upahHarga;
  const nilaiUpah = volUpah * hargaUpah;

  // Kategori mengikuti pilihan eksplisit tiap kelompok (Material/Subkon), bukan
  // ejaan namanya. Lain-lain = 5% dari (Material + Tenaga Kerja + Subkon).
  const totalGrup = (g: Kelompok) => g.items.reduce((a, i) => a + i.volume * i.hargaSatuan, 0);
  const subkon = kelompok.filter((g) => g.kategori === "Subkon").reduce((s, g) => s + totalGrup(g), 0);
  const material = kelompok.filter((g) => g.kategori !== "Subkon").reduce((s, g) => s + totalGrup(g), 0);
  const lain = (material + nilaiUpah + subkon) * PORSI_LAIN_LAIN;
  const totalSwakelola = material + nilaiUpah + subkon + lain;

  const mulaiSunting = () => {
    setDraft(kelompokkan(baris).map((g) => ({ ...g, items: g.items.map((i) => ({ ...i })) })));
    setDraftUpahVolume(upahVolume);
    setDraftUpahHarga(upahHarga);
    setGalat(null);
    setSunting(true);
  };

  const batal = () => {
    setSunting(false);
    setGalat(null);
  };

  const simpan = () =>
    mulai(async () => {
      const hasil = await aksiSimpan(
        JSON.stringify({
          kelompok: draft,
          upahVolume: draftUpahVolume,
          upahHarga: draftUpahHarga,
        }),
      );
      if (hasil.ok) {
        setSunting(false);
        setGalat(null);
      } else {
        setGalat(hasil.error);
      }
    });

  const ubahItem = (gi: number, ii: number, field: keyof BarisRapUI, nilai: string | number) =>
    setDraft((d) =>
      d.map((g, x) =>
        x !== gi ? g : { ...g, items: g.items.map((it, y) => (y === ii ? { ...it, [field]: nilai } : it)) },
      ),
    );

  const isian = (
    gi: number, ii: number, field: keyof BarisRapUI, lebar: number, angka?: boolean,
  ) => (
    <input
      className="inp"
      type={angka ? "number" : "text"}
      value={String(kelompok[gi].items[ii][field] ?? "")}
      onChange={(e) => ubahItem(gi, ii, field, angka ? Number(e.target.value) || 0 : e.target.value)}
      style={{ ...sel, width: lebar, textAlign: angka ? "right" : "left" }}
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
        {bolehUbah && (
          <div style={{ display: "flex", gap: 6 }}>
            <ModalImpor
              jenis="RAP"
              konteks={konteksImpor}
              kolom="Kelompok · Material · Satuan · Volume · Harga · Keterangan · Upah Tenaga Kerja"
              sasaran={sasaranImpor}
              id={idImpor}
              aksiImpor={aksiImpor}
            />
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
        {keterangan && (
          <div
            style={{
              padding: "10px 14px", borderBottom: "1px solid var(--line)",
              fontSize: 11.5, color: "var(--muted)",
            }}
          >
            {keterangan}
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th style={{ width: 34 }}>No.</th>
              <th style={{ minWidth: 210 }}>Material</th>
              <th>Sat</th>
              <th style={{ textAlign: "right" }}>Volume</th>
              <th style={{ textAlign: "right" }}>Harga</th>
              <th style={{ textAlign: "right" }}>Jumlah Harga</th>
              <th style={{ minWidth: 150 }}>Keterangan</th>
              {sunting && <th style={{ width: 34 }} />}
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
                    colSpan={sunting ? 7 : 6}
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
                          style={{ ...sel, width: 220, fontWeight: 600 }}
                        />
                        <select
                          className="inp"
                          title="Kategori kelompok — menentukan Material vs Subkon, bukan namanya"
                          value={g.kategori === "Subkon" ? "Subkon" : "Material"}
                          onChange={(e) =>
                            setDraft((d) => d.map((x, y) => (y === gi ? { ...x, kategori: e.target.value } : x)))
                          }
                          style={{ ...sel, width: 110, fontWeight: 600 }}
                        >
                          <option value="Material">Material</option>
                          <option value="Subkon">Subkon</option>
                        </select>
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
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        {g.nama}
                        {g.kategori === "Subkon" && (
                          <span
                            className="chip"
                            style={{ background: "var(--rona-ungu, var(--rona-teal))", color: "var(--brass)", textTransform: "none", letterSpacing: 0 }}
                          >
                            Subkon
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>

                {g.items.map((it, ii) => (
                  <tr key={it.id ?? `${gi}-${ii}`}>
                    <td style={{ color: "var(--muted)" }}>{ii + 1}</td>
                    <td>{sunting ? isian(gi, ii, "nama", 200) : it.nama}</td>
                    <td>{sunting ? isian(gi, ii, "satuan", 54) : it.satuan}</td>
                    <td style={{ textAlign: "right" }}>
                      {sunting
                        ? isian(gi, ii, "volume", 64, true)
                        : it.volume.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {sunting ? isian(gi, ii, "hargaSatuan", 96, true) : rp(it.hargaSatuan)}
                    </td>
                    <td className="num" style={{ textAlign: "right" }}>
                      {rp(it.volume * it.hargaSatuan)}
                    </td>
                    <td style={{ whiteSpace: "normal", color: "var(--muted)" }}>
                      {sunting ? isian(gi, ii, "keterangan", 140) : it.keterangan || "—"}
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
                ))}

                {sunting && (
                  <tr>
                    <td />
                    <td colSpan={7}>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((d) =>
                            d.map((x, y) =>
                              y !== gi ? x : { ...x, items: [...x.items, { ...ITEM_BARU, grup: x.nama }] },
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
                <td colSpan={7}>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => [
                        ...d,
                        { nama: "Kelompok Baru", kategori: "Material", items: [{ ...ITEM_BARU, grup: "Kelompok Baru" }] },
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

            <tr style={{ fontWeight: 700, borderTop: "2px solid var(--line)" }}>
              <td colSpan={5}>MATERIAL</td>
              <td className="num" style={{ textAlign: "right" }}>{rp(material)}</td>
              <td />
              {sunting && <td />}
            </tr>
            {subkon > 0 && (
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={5}>SUBKON</td>
                <td className="num" style={{ textAlign: "right" }}>{rp(subkon)}</td>
                <td />
                {sunting && <td />}
              </tr>
            )}
            <tr style={{ fontWeight: 700 }}>
              <td>—</td>
              <td>UPAH TENAGA KERJA</td>
              <td>OH</td>
              <td style={{ textAlign: "right" }}>
                {sunting ? (
                  <input
                    className="inp"
                    type="number"
                    value={draftUpahVolume}
                    onChange={(e) => setDraftUpahVolume(Number(e.target.value) || 0)}
                    style={{ ...sel, width: 64, textAlign: "right" }}
                  />
                ) : (
                  volUpah.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                {sunting ? (
                  <input
                    className="inp"
                    type="number"
                    value={draftUpahHarga}
                    onChange={(e) => setDraftUpahHarga(Number(e.target.value) || 0)}
                    style={{ ...sel, width: 96, textAlign: "right" }}
                  />
                ) : (
                  rp(hargaUpah)
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                <span className="num" style={{ color: "var(--teal)" }}>{rp(nilaiUpah)}</span>
              </td>
              <td />
              {sunting && <td />}
            </tr>
            <tr style={{ fontWeight: 700 }}>
              <td colSpan={5}>LAIN-LAIN PROYEK (5%)</td>
              <td className="num" style={{ textAlign: "right" }}>{rp(lain)}</td>
              <td />
              {sunting && <td />}
            </tr>
            <tr style={{ fontWeight: 700, background: "var(--rona-baris)" }}>
              <td colSpan={5}>TOTAL RAP</td>
              <td className="num" style={{ textAlign: "right", color: "var(--brass)" }}>
                {rp(totalSwakelola)}
              </td>
              <td />
              {sunting && <td />}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
