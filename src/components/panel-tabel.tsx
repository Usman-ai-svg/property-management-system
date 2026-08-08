"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { Tabel, type KolomOpsional } from "@/components/kartu-tabel";

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

/**
 * Kelompokkan baris menurut `grup`, diurutkan sesuai `urutanGrup` (yang tak
 * terdaftar disusun alfabetis di belakang). Dipakai bila tabel diminta
 * menampilkan baris judul kelompok yang bisa dilipat.
 */
function kelompokkan<T>(
  rows: T[],
  grup: (t: T) => string,
  urutanGrup?: readonly string[],
): { nama: string; rows: T[] }[] {
  const peta = new Map<string, T[]>();
  for (const t of rows) {
    const g = grup(t) || "Lainnya";
    const list = peta.get(g);
    if (list) list.push(t);
    else peta.set(g, [t]);
  }
  const posisi = (n: string) => {
    const i = urutanGrup?.indexOf(n) ?? -1;
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...peta.entries()]
    .map(([nama, r]) => ({ nama, rows: r }))
    .sort((a, b) => posisi(a.nama) - posisi(b.nama) || a.nama.localeCompare(b.nama));
}

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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const tombolRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const jmlAktif = useMemo(
    () => Object.values(pilih).reduce((s, v) => s + (v?.length ?? 0), 0),
    [pilih],
  );
  const LEBAR = 300;

  const hitungPos = () => {
    const el = tombolRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - LEBAR - 8));
    setPos({ top: r.bottom + 6, left });
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
            position: "fixed", top: pos.top, left: pos.left, width: LEBAR, zIndex: 60,
            background: "var(--card, #fff)", border: "1px solid var(--line)", borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,.14)", padding: "6px 0", maxHeight: "70vh", overflowY: "auto",
          }}
        >
          <div
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "4px 12px 8px", borderBottom: "1px solid var(--line)",
            }}
          >
            <span className="eyebrow" style={{ margin: 0 }}>Filter</span>
            {jmlAktif > 0 && (
              <button
                type="button"
                onClick={() => setPilih({})}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--teal)", font: "inherit", fontSize: 11, padding: 0 }}
              >
                Bersihkan semua
              </button>
            )}
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

  const adaFilterAktif = Object.values(pilih).some((v) => v.length > 0);
  const adaAlat = Boolean(cari) || (filter && filter.length > 0);
  const disaring = tersaring.length !== data.length;
  const kolomN = kolom.filter(Boolean).length;

  // Baris isi tabel: berkelompok (dengan judul yang bisa dilipat) atau datar.
  const isiTabel = grup
    ? kelompokkan(tersaring, grup, urutanGrup).flatMap(({ nama, rows }) => {
        const dilipat = tutupGrup[nama];
        return [
          <tr
            key={`grp-${nama}`}
            style={{ background: "var(--rona-abu)", cursor: "pointer" }}
            onClick={() => setTutupGrup((s) => ({ ...s, [nama]: !s[nama] }))}
          >
            <td colSpan={kolomN} style={{ fontWeight: 700, fontSize: 12 }}>
              <ChevronDown
                size={13}
                style={{ verticalAlign: "-2px", marginRight: 5, color: "var(--muted)", transform: dilipat ? "rotate(-90deg)" : "none", transition: "transform .15s" }}
              />
              {nama}
              <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {rows.length}</span>
            </td>
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

              {/* Pil filter aktif — bisa dihapus tanpa membuka popover. */}
              {filter?.flatMap((f, i) =>
                (pilih[i] ?? []).map((v) => (
                  <button
                    key={`${f.label}-${v}`}
                    type="button"
                    className="chip"
                    onClick={() =>
                      setPilih((p) => ({ ...p, [i]: (p[i] ?? []).filter((x) => x !== v) }))
                    }
                    title="Hapus filter ini"
                    style={{
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                      background: "var(--rona-teal2)", color: "var(--teal)", border: "1px solid var(--teal)",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>{f.label}:</span>
                    {v}
                    <X size={11} />
                  </button>
                )),
              )}

              {(q || adaFilterAktif) && (
                <button
                  type="button"
                  className="btn-garis"
                  style={{ fontSize: 11, padding: "5px 10px" }}
                  onClick={() => { setQ(""); setPilih({}); }}
                >
                  Reset
                </button>
              )}
            </div>
          )}

      <Tabel kolom={kolom} kosong={kosong} tinggiMaks={tinggiMaks} kelasBungkus="tablewrap">
        {isiTabel}
      </Tabel>
    </div>
  );
}
