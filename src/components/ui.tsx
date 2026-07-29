import { Lock } from "lucide-react";

/** Peta warna status — dipindahkan dari artifact. */
export const WARNA_STATUS: Record<string, Record<string, [string, string]>> = {
  lahan: {
    "Selesai Terbangun": ["var(--rona-hijau2)", "var(--green)"],
    Pembangunan: ["var(--rona-teal2)", "var(--teal)"],
    "Proses Legal & Perizinan": ["var(--rona-amber)", "var(--amber)"],
    Perencanaan: ["var(--rona-abu)", "var(--muted)"],
  },
  bangun: {
    "Belum terbangun": ["var(--rona-abu)", "var(--muted)"],
    Progress: ["var(--rona-amber)", "var(--amber)"],
    Selesai: ["var(--rona-hijau2)", "var(--green)"],
    "Serah Terima": ["var(--rona-teal2)", "var(--teal)"],
    "Habis Masa Garansi": ["var(--rona-biru)", "var(--blue)"],
  },
  jual: {
    Tersedia: ["var(--rona-abu)", "var(--muted)"],
    Booking: ["var(--rona-amber)", "var(--amber)"],
    Akad: ["var(--rona-biru)", "var(--blue)"],
    "Serah Terima": ["var(--rona-hijau2)", "var(--green)"],
  },
  serapan: {
    Hemat: ["var(--rona-hijau2)", "var(--green)"],
    Sesuai: ["var(--rona-teal2)", "var(--teal)"],
    Over: ["var(--rona-merah)", "var(--red)"],
  },
  bayar: {
    Lunas: ["var(--rona-hijau2)", "var(--green)"],
    DP: ["var(--rona-amber)", "var(--amber)"],
    Belum: ["var(--rona-abu)", "var(--muted)"],
  },
};

export function Badge({ nilai, peta }: { nilai: string; peta?: Record<string, [string, string]> }) {
  const [bg, warna] = peta?.[nilai] ?? ["var(--rona-abu)", "var(--muted)"];
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

/**
 * Baris label–nilai di dalam kartu. Mengikuti InfoRow pada artifact.
 *
 * `tebal` menandai baris sebagai total penutup — dipakai saat InfoRow
 * dipakai berjajar sebagai rincian (mis. Default + Kerja Tambah) yang
 * ditutup satu baris total, supaya total itu menonjol dari rinciannya.
 */
export function InfoRow({
  label, nilai, tebal,
}: {
  label: string; nilai: React.ReactNode; tebal?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex", justifyContent: "space-between", gap: 12,
        padding: "7px 0", borderBottom: "1px solid var(--garis-halus)", fontSize: 12.5,
        alignItems: "center",
      }}
    >
      <span style={{ color: tebal ? "var(--text)" : "var(--muted)", fontWeight: tebal ? 700 : 400 }}>
        {label}
      </span>
      <span style={{ fontWeight: tebal ? 700 : 600, textAlign: "right", color: tebal ? "var(--brass)" : undefined }}>
        {nilai}
      </span>
    </div>
  );
}

/** Kepala kartu: judul eyebrow di kiri, tombol aksi di kanan. */
export function CardHead({
  judul,
  aksi,
}: {
  judul: string;
  aksi?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 10, gap: 8,
      }}
    >
      <div className="eyebrow">{judul}</div>
      {aksi && <div style={{ display: "flex", gap: 6 }}>{aksi}</div>}
    </div>
  );
}

/** Kepala tabel dalam kartu: judul + keterangan di kiri, tombol di kanan. */
export function TabelHead({
  judul,
  keterangan,
  aksi,
}: {
  judul: string;
  keterangan?: string;
  aksi?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "12px 16px", borderBottom: "1px solid var(--line)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 8,
      }}
    >
      <div>
        <div className="eyebrow">{judul}</div>
        {keterangan && (
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{keterangan}</div>
        )}
      </div>
      {aksi}
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

/**
 * Paragraf keterangan kecil berwarna redup.
 *
 * Ditulis ulang di 41 tempat sebelum ini, dengan margin yang berbeda-beda tapi
 * ukuran dan warna yang selalu sama. Dijadikan komponen supaya penyesuaian
 * tipografi saat migrasi cukup dilakukan di satu tempat.
 */
export function Petunjuk({
  children,
  jarak,
  gaya,
}: {
  children: React.ReactNode;
  /** Margin CSS, mis. 0 atau "8px 0 0". Bawaannya tanpa margin atas-bawah. */
  jarak?: string | number;
  gaya?: React.CSSProperties;
}) {
  return (
    <p
      style={{
        fontSize: 11.5,
        color: "var(--muted)",
        lineHeight: 1.6,
        margin: jarak ?? 0,
        ...gaya,
      }}
    >
      {children}
    </p>
  );
}

/**
 * Kepala halaman: baris eyebrow di atas judul.
 *
 * Berbeda dari `JudulHalaman` yang dipakai halaman bergaya dasbor; bentuk ini
 * yang dipakai 16 halaman modul.
 */
export function KepalaHalaman({
  induk,
  judul,
  keterangan,
  kanan,
  ukuran = 20,
}: {
  /** Baris kecil di atas judul, mis. "Manajemen Proyek · Konstruksi". */
  induk: string;
  judul: React.ReactNode;
  keterangan?: React.ReactNode;
  kanan?: React.ReactNode;
  ukuran?: number;
}) {
  return (
    <div
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        flexWrap: "wrap", gap: 12,
      }}
    >
      <div>
        <div className="eyebrow">{induk}</div>
        <h2 className="disp" style={{ margin: "4px 0 0", fontSize: ukuran }}>
          {judul}
        </h2>
        {keterangan && <Petunjuk jarak="5px 0 0">{keterangan}</Petunjuk>}
      </div>
      {kanan}
    </div>
  );
}

/**
 * Kartu ber-padding — pembungkus paling sering dipakai di aplikasi ini.
 *
 * Padding bawaannya "16px 20px", yaitu bentuk yang dipakai 21 dari 34 kartu.
 * Sisanya menyesuaikan lewat prop, bukan menulis ulang style-nya.
 */
export function Kartu({
  children,
  padding = "16px 20px",
  atas,
  bawah,
  gaya,
}: {
  children: React.ReactNode;
  padding?: string | number;
  /** Jarak ke elemen di atasnya, dalam piksel. */
  atas?: number;
  bawah?: number;
  gaya?: React.CSSProperties;
}) {
  return (
    <div
      className="card"
      style={{
        padding,
        ...(atas != null && { marginTop: atas }),
        ...(bawah != null && { marginBottom: bawah }),
        ...gaya,
      }}
    >
      {children}
    </div>
  );
}

/** Kartu berisi pesan "belum ada apa-apa", rata tengah. */
export function KartuKosong({ children }: { children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>
      {children}
    </div>
  );
}

/**
 * Baris KPI empat kolom di kepala halaman modul.
 *
 * Ditulis identik di empat halaman sebelum ini.
 */
export function BarisKpi({ kpi, atas = 16 }: { kpi: [string, string][]; atas?: number }) {
  return (
    <div className="grid grid4" style={{ marginTop: atas }}>
      {kpi.map(([label, nilai]) => (
        <div key={label} className="card kpi">
          <div className="eyebrow">{label}</div>
          <div className="v" style={{ fontSize: 15 }}>
            {nilai}
          </div>
        </div>
      ))}
    </div>
  );
}
