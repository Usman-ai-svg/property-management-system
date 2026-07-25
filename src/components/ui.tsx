import { Lock } from "lucide-react";

/** Peta warna status — dipindahkan dari artifact. */
export const WARNA_STATUS: Record<string, Record<string, [string, string]>> = {
  lahan: {
    "Selesai Terbangun": ["#e7f4ee", "var(--green)"],
    Pembangunan: ["#e7f0f4", "var(--teal)"],
    "Proses Legal & Perizinan": ["#fff3df", "var(--amber)"],
    Perencanaan: ["#eef2f3", "var(--muted)"],
  },
  bangun: {
    "Belum terbangun": ["#eef2f3", "var(--muted)"],
    Progress: ["#fff3df", "var(--amber)"],
    Selesai: ["#e7f4ee", "var(--green)"],
    "Serah Terima": ["#e7f0f4", "var(--teal)"],
    "Habis Masa Garansi": ["#e7eefb", "var(--blue)"],
  },
  jual: {
    Tersedia: ["#eef2f3", "var(--muted)"],
    Booking: ["#fff3df", "var(--amber)"],
    Akad: ["#e7eefb", "var(--blue)"],
    "Serah Terima": ["#e7f4ee", "var(--green)"],
  },
  serapan: {
    Hemat: ["#e7f4ee", "var(--green)"],
    Sesuai: ["#e7f0f4", "var(--teal)"],
    Over: ["#fbeae8", "var(--red)"],
  },
  bayar: {
    Lunas: ["#e7f4ee", "var(--green)"],
    DP: ["#fff3df", "var(--amber)"],
    Belum: ["#eef2f3", "var(--muted)"],
  },
};

export function Badge({ nilai, peta }: { nilai: string; peta?: Record<string, [string, string]> }) {
  const [bg, warna] = peta?.[nilai] ?? ["#eef2f3", "var(--muted)"];
  return (
    <span className="chip" style={{ background: bg, color: warna }}>
      {nilai}
    </span>
  );
}

export function Track({
  nilai,
  warna = "var(--teal)",
  tanda,
  tinggi = 22,
}: {
  nilai: number;
  warna?: string;
  tanda?: number;
  tinggi?: number;
}) {
  return (
    <div className="track" style={{ height: tinggi }}>
      <div className="fill" style={{ width: Math.min(nilai, 100) + "%", background: warna }} />
      {tanda != null && <div className="marker" style={{ left: Math.min(tanda, 100) + "%" }} />}
    </div>
  );
}

export function Kpi({ label, nilai, catatan }: { label: string; nilai: string; catatan?: string }) {
  return (
    <div className="card kpi">
      <div className="eyebrow">{label}</div>
      <div className="v">{nilai}</div>
      {catatan && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>{catatan}</div>}
    </div>
  );
}

/**
 * Ditampilkan menggantikan bagian yang tidak boleh dilihat peran ini.
 *
 * Yang penting: data di baliknya memang tidak diambil dari database, bukan
 * diambil lalu ditutup. Komponen ini hanya menjelaskan kenapa kosong.
 */
export function Terbatas({ apa }: { apa: string }) {
  return (
    <div className="terbatas">
      <Lock size={15} />
      <span>
        {apa} tidak ditampilkan untuk peran Anda. Hubungi administrator bila memerlukan akses.
      </span>
    </div>
  );
}

export function JudulHalaman({
  judul,
  keterangan,
  kanan,
}: {
  judul: string;
  keterangan?: string;
  kanan?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        gap: 16, flexWrap: "wrap", marginBottom: 20,
      }}
    >
      <div>
        <h1 className="disp" style={{ fontSize: 21, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
          {judul}
        </h1>
        {keterangan && (
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "5px 0 0" }}>{keterangan}</p>
        )}
      </div>
      {kanan}
    </div>
  );
}
