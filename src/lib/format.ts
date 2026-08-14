/** Pemformatan angka dan tanggal dalam konvensi Indonesia. */

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/**
 * Tarif rencana omset unit.
 *
 * PPN dikenakan atas harga dasar (11%). "All-In" menambahkan lagi 10% di atas
 * harga ber-PPN untuk biaya AJB/notaris/BPHTB — jadi bertingkat, bukan
 * dijumlahkan datar. Total omset yang dipakai untuk laba/margin & pembanding
 * realisasi tetap memakai HARGA DASAR (non-PPN).
 */
export const PPN_RATE = 0.11;
export const ALLIN_RATE = 0.1;

/** Harga dasar + PPN 11%. */
export const hargaPpn = (dasar: number): number => dasar * (1 + PPN_RATE);

/** (Harga dasar + PPN) + 10% biaya AJB/notaris/BPHTB. */
export const hargaAllIn = (dasar: number): number => hargaPpn(dasar) * (1 + ALLIN_RATE);

/** "Rp 1.250.000" */
export const rp = (v: number): string => "Rp " + Math.round(v).toLocaleString("id-ID");

/** Periode cashflow "YYYY-MM" → "Agu 2026". Format lain ditampilkan apa adanya. */
export function periodeBulan(periode: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periode);
  if (!m) return periode;
  return `${BULAN[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** Rupiah ringkas untuk KPI sempit: "Rp 1,25 M", "Rp 850 jt". */
export function rpRingkas(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000_000) return `Rp ${(v / 1_000_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} T`;
  if (abs >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
  if (abs >= 1_000_000) return `Rp ${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} jt`;
  return rp(v);
}

/** 0,6234 → "62%" */
export const pct = (v: number, desimal = 0): string =>
  (v * 100).toLocaleString("id-ID", { maximumFractionDigits: desimal }) + "%";

/** 3400 → "3.400 m²" */
export const m2 = (v: number): string => v.toLocaleString("id-ID") + " m²";

/** Date → "22 Jul 2026" */
export function tanggal(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "—";
  return `${String(x.getDate()).padStart(2, "0")} ${BULAN[x.getMonth()]} ${x.getFullYear()}`;
}

/** Date → "22 Jul 2026 16:40" */
export function tanggalJam(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${tanggal(x)} ${p(x.getHours())}:${p(x.getMinutes())}`;
}

/** 25_690_000 → "24,5 MB" */
export function ukuranFile(byte: number): string {
  if (byte >= 1024 ** 3) return `${(byte / 1024 ** 3).toLocaleString("id-ID", { maximumFractionDigits: 1 })} GB`;
  if (byte >= 1024 ** 2) return `${(byte / 1024 ** 2).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
  if (byte >= 1024) return `${(byte / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} KB`;
  return `${byte} B`;
}

/** Kebalikan dari ukuranFile — dipakai seed untuk mengubah "24,5 MB" jadi byte. */
export function parseUkuran(teks: string): number {
  const m = teks.trim().match(/^([\d.,]+)\s*(B|KB|MB|GB)$/i);
  if (!m) return 0;
  const angka = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  const pangkat = { b: 0, kb: 1, mb: 2, gb: 3 }[m[2].toLowerCase()] ?? 0;
  return Math.round(angka * 1024 ** pangkat);
}
