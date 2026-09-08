"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { Tabel, type KolomOpsional } from "@/components/kartu-tabel";
import { kelompokkanBaris } from "@/lib/adaptor/kelompok-tabel";

/**
 * Kartu-tabel yang bisa DILIPAT, DICARI, dan DIFILTER — untuk tabel yang bisa
 * tumbuh panjang (pustaka AHSP, daftar harga dasar, pemasok, dsb.).
 *
 * Semua penyaringan terjadi di sisi klien atas data yang sudah dikirim: cocok
 * untuk pustaka yang ukurannya ratusan baris, bukan jutaan. Bila suatu saat
 * datanya jauh lebih besar, penyaringan dipindahkan ke query — antarmukanya
 * (kotak cari + pemilih filter) tetap sama.
 *
 * `baris`, `cari`, dan `filter` berupa fungsi, jadi komponen PEMANGGILNYA harus
 * ikut client ("use client"): fungsi tidak bisa dilewatkan dari server ke klien.
 */

export interface FilterTabel<T> {
  /** Label pemilih, mis. "Kategori". */
  label: string;
  /** Nilai yang dibandingkan untuk sebuah baris. */
  ambil: (t: T) => string;
  /** Daftar pilihan; bila kosong, disimpulkan dari data. */
  opsi?: readonly string[];
  /**
   * Bentuk kontrol di dalam popover:
   * - `checkbox` (bawaan): pilihan ganda, cocok bila baris boleh salah satu dari
   *   beberapa nilai (OR di dalam seksi).
   * - `radio`: pilih satu; ada opsi "Semua" untuk mengosongkan.
   * - `pill`: pilihan ganda seperti checkbox, tapi ditampilkan sebagai tombol pil.
   */
  jenis?: "checkbox" | "radio" | "pill";
}

/**
 * Popover filter yang menembus `overflow: hidden` kartu lewat portal.
 *
 * Penyaringan bersifat langsung (tanpa tombol "Terapkan"): mengubah pilihan
 * segera menyaring tabel. Antar-seksi digabung dengan AND; di dalam satu seksi
 * checkbox/pill digabung dengan OR.
 */
function FilterPopover<T>({
  filter, opsiFilter, pilih, setPilih,
}: {
  filter: FilterTabel<T>[];
  opsiFilter: readonly (readonly string[])[];
  pilih: Record<number, string[]>;
  setPilih: React.Dispatch<React.SetStateAction<Record<number, string[]>>>;
}) {
  const [buka, setBuka] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; maxH: number } | null>(null);
  const tombolRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const jmlAktif = useMemo(
    () => Object.values(pilih).reduce((s, v) => s + (v?.length ?? 0), 0),
    [pilih],
  );
  const LEBAR = 300;

  // Posisi popover dijaga di dalam viewport agar tak meluber di laman dengan
  // tabel yang lebar/panjang: tepi KANAN disejajarkan ke tombol lalu dikurung
  // horizontal; secara vertikal buka ke bawah, tapi pindah ke atas bila ruang
  // bawah sempit, dan tingginya dibatasi ruang yang tersedia.
  const hitungPos = () => {
    const el = tombolRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const M = 8;
    const left = Math.max(M, Math.min(r.right - LEBAR, window.innerWidth - LEBAR - M));
    const bawah = window.innerHeight - r.bottom - M;
    const atas = r.top - M;
    const keAtas = bawah < 260 && atas > bawah;
    const maxH = Math.max(160, Math.min(keAtas ? atas : bawah, Math.round(window.innerHeight * 0.7)));
    setPos(
      keAtas
        ? { bottom: window.innerHeight - r.top + 6, left, maxH }
        : { top: r.bottom + 6, left, maxH },
    );
  };

  useLayoutEffect(() => {
    if (!buka) return;
    hitungPos();
    const onScroll = () => hitungPos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [buka]);

  useEffect(() => {
    if (!buka) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || tombolRef.current?.contains(t)) return;
      setBuka(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBuka(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [buka]);

  const toggle = (i: number, nilai: string, radio: boolean) =>
    setPilih((p) => {
      const kini = p[i] ?? [];
      if (radio) return { ...p, [i]: kini[0] === nilai ? [] : [nilai] };
      const ada = kini.includes(nilai);
      return { ...p, [i]: ada ? kini.filter((x) => x !== nilai) : [...kini, nilai] };
    });

  return (
    <>
      <button
        ref={tombolRef}
        type="button"
        className="btn-garis"
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px" }}
      >
        <SlidersHorizontal size={13} />
        Filter
        {jmlAktif > 0 && (
          <span
            style={{
              minWidth: 17, height: 17, padding: "0 4px", borderRadius: 9,
              background: "var(--teal)", color: "#fff", fontSize: 10.5, fontWeight: 700,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {jmlAktif}
          </span>
        )}
      </button>

      {buka && pos && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed", top: pos.top, bottom: pos.bottom, left: pos.left,
            width: LEBAR, maxHeight: pos.maxH, zIndex: 60,
            background: "var(--card, #fff)", border: "1px solid var(--line)", borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,.14)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}
        >
          <div style={{ overflowY: "auto", padding: "6px 0" }}>
          <div style={{ padding: "4px 12px 8px", borderBottom: "1px solid var(--line)" }}>
            <span className="eyebrow" style={{ margin: 0 }}>Filter</span>
          </div>

          {filter.map((f, i) => {
            const jenis = f.jenis ?? "checkbox";
            const dipilih = pilih[i] ?? [];
            return (
              <div key={f.label} style={{ padding: "10px 12px", borderBottom: i < filter.length - 1 ? "1px solid var(--garis-halus)" : "none" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 7 }}>
                  {f.label}
                </div>

                {jenis === "pill" ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {opsiFilter[i].map((o) => {
                      const aktif = dipilih.includes(o);
                      return (
                        <button
                          key={o}
                          type="button"
                          onClick={() => toggle(i, o, false)}
                          className="chip"
                          style={{
                            cursor: "pointer", border: "1px solid " + (aktif ? "var(--teal)" : "var(--line)"),
                            background: aktif ? "var(--rona-teal2)" : "transparent",
                            color: aktif ? "var(--teal)" : "var(--text)", fontWeight: aktif ? 600 : 400,
                          }}
                        >
                          {o}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {jenis === "radio" && (
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                        <input type="radio" checked={dipilih.length === 0} onChange={() => setPilih((p) => ({ ...p, [i]: [] }))} />
                        <span style={{ color: "var(--muted)" }}>Semua</span>
                      </label>
                    )}
                    {opsiFilter[i].map((o) => (
                      <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                        <input
                          type={jenis === "radio" ? "radio" : "checkbox"}
                          checked={dipilih.includes(o)}
                          onChange={() => toggle(i, o, jenis === "radio")}
                        />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          </div>

          {jmlAktif > 0 && (
            <button
              type="button"
              onClick={() => setPilih({})}
              style={{
                background: "none", border: "none", borderTop: "1px solid var(--line)",
                width: "100%", textAlign: "center", padding: "10px 12px",
                color: "var(--teal)", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600,
              }}
            >
              Bersihkan semua
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

export function PanelTabel<T>({
  judul,
  keterangan,
  aksi,
  data,
  kolom,
  baris,
  kunci,
  cari,
  petunjukCari = "Cari…",
  filter,
  grup,
  urutanGrup,
  ringkasGrup,
  ringkasGrupSpan = 1,
  footer,
  kosong,
  tinggiMaks = 460,
  atas = 16,
}: {
  judul: string;
  keterangan?: string;
  /** Tombol di kanan kepala (mis. Tambah). Tidak ikut memicu lipat. */
  aksi?: React.ReactNode;
  data: T[];
  kolom: KolomOpsional[];
  /** Render satu `<tr>` untuk sebuah baris. */
  baris: (t: T) => React.ReactNode;
  /** Kunci React unik per baris. */
  kunci: (t: T) => string;
  /** Teks yang bisa dicari untuk sebuah baris. Tanpa ini, kotak cari disembunyikan. */
  cari?: (t: T) => string;
  petunjukCari?: string;
  filter?: FilterTabel<T>[];
  /**
   * Bila diisi, baris DIKELOMPOKKAN di dalam tabel: tiap kelompok mendapat
   * baris judul yang bisa dilipat. Nilai kembaliannya menjadi nama kelompok.
   */
  grup?: (t: T) => string;
  /** Urutan kelompok. Yang tak terdaftar disusun alfabetis di belakang. */
  urutanGrup?: readonly string[];
  /**
   * Ringkasan sebuah kelompok (mis. subtotal), dirender di baris judul kelompok
   * sebagai sel-sel `<td>` TERAKHIR — nama kelompok mengisi sisa kolom di
   * kirinya. Kembalikan ARRAY berisi ISI tiap sel (bukan `<td>`); tiap elemen
   * dibungkus `<td>` rata-kanan oleh komponen ini. `ringkasGrupSpan` harus sama
   * dengan panjang array. Hanya berlaku saat `grup` dipakai.
   */
  ringkasGrup?: (rows: T[]) => React.ReactNode[];
  /** Banyak kolom terakhir yang diisi `ringkasGrup`. Bawaan 1. */
  ringkasGrupSpan?: number;
  /**
   * Baris kaki tabel (mis. SUM/Grand Total). Menerima baris yang LOLOS saring,
   * dirender sekali di bawah seluruh baris; harus mengembalikan satu `<tr>`.
   */
  footer?: (rows: T[]) => React.ReactNode;
  kosong?: React.ReactNode;
  tinggiMaks?: number;
  atas?: number;
}) {
  const [q, setQ] = useState("");
  const [pilih, setPilih] = useState<Record<number, string[]>>({});
  const [tutupGrup, setTutupGrup] = useState<Record<string, boolean>>({});

  const opsiFilter = useMemo(
    () =>
      (filter ?? []).map(
        (f) => f.opsi ?? [...new Set(data.map(f.ambil))].filter(Boolean).sort(),
      ),
    [filter, data],
  );

  const tersaring = useMemo(() => {
    const kata = q.trim().toLowerCase();
    return data.filter((t) => {
      if (kata && cari && !cari(t).toLowerCase().includes(kata)) return false;
      if (filter) {
        for (let i = 0; i < filter.length; i++) {
          const dipilih = pilih[i];
          // AND antar-seksi; OR di dalam seksi (baris cocok bila salah satu nilai terpilih).
          if (dipilih && dipilih.length > 0 && !dipilih.includes(filter[i].ambil(t))) return false;
        }
      }
      return true;
    });
  }, [data, q, pilih, cari, filter]);

  const adaAlat = Boolean(cari) || (filter && filter.length > 0);
  const disaring = tersaring.length !== data.length;
  const kolomN = kolom.filter(Boolean).length;

  // Baris isi tabel: berkelompok (dengan judul yang bisa dilipat) atau datar.
  const isiTabel = grup
    ? kelompokkanBaris(tersaring, grup, urutanGrup).flatMap(({ nama, rows }) => {
        const dilipat = tutupGrup[nama];
        return [
          <tr
            key={`grp-${nama}`}
            style={{ background: "var(--rona-abu)", cursor: "pointer" }}
            onClick={() => setTutupGrup((s) => ({ ...s, [nama]: !s[nama] }))}
          >
            <td colSpan={ringkasGrup ? kolomN - ringkasGrupSpan : kolomN} style={{ fontWeight: 700, fontSize: 12 }}>
              <ChevronDown
                size={13}
                style={{ verticalAlign: "-2px", marginRight: 5, color: "var(--muted)", transform: dilipat ? "rotate(-90deg)" : "none", transition: "transform .15s" }}
              />
              {nama}
              <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {rows.length}</span>
            </td>
            {ringkasGrup &&
              ringkasGrup(rows).map((sel, i) => (
                <td key={i} className="num" style={{ textAlign: "right", fontWeight: 700, fontSize: 12 }}>
                  {sel}
                </td>
              ))}
          </tr>,
          ...(dilipat ? [] : rows.map((t) => <Fragment key={kunci(t)}>{baris(t)}</Fragment>)),
        ];
      })
    : tersaring.map((t) => <Fragment key={kunci(t)}>{baris(t)}</Fragment>);

  return (
    <div className="card" style={{ overflow: "hidden", marginTop: atas }}>
      {/* Kepala kartu — tidak dapat dilipat; pelipatan hanya per-kelompok di dalam tabel. */}
      <div
        style={{
          padding: "12px 16px", borderBottom: "1px solid var(--line)",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
        }}
      >
        <div>
          <div className="eyebrow">
            {judul}
            <span style={{ color: "var(--muted)", fontWeight: 400 }}>
              {" · "}
              {disaring ? `${tersaring.length} dari ${data.length}` : data.length}
            </span>
          </div>
          {keterangan && (
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{keterangan}</div>
          )}
        </div>
        {aksi}
      </div>

      {adaAlat && (
            <div
              style={{
                display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
                padding: "10px 16px", borderBottom: "1px solid var(--line)", background: "var(--rona-abu)",
              }}
            >
              {cari && (
                <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
                  <Search
                    size={14}
                    style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }}
                  />
                  <input
                    className="inp"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={petunjukCari}
                    style={{ paddingLeft: 30 }}
                  />
                </div>
              )}
              {filter && filter.length > 0 && (
                <FilterPopover filter={filter} opsiFilter={opsiFilter} pilih={pilih} setPilih={setPilih} />
              )}
            </div>
          )}

      <Tabel kolom={kolom} kosong={kosong} tinggiMaks={tinggiMaks} kelasBungkus="tablewrap">
        {isiTabel}
        {footer && tersaring.length > 0 ? footer(tersaring) : null}
      </Tabel>
    </div>
  );
}
