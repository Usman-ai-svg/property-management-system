import { Construction } from "lucide-react";
import { JudulHalaman } from "./ui";

/**
 * Penanda modul yang belum diporting dari prototipe.
 *
 * Sengaja menyebutkan apa yang sudah tersedia di lapisan bawah, supaya jelas
 * bahwa yang tersisa adalah pekerjaan tampilan — model data dan rumusnya sudah
 * ada di src/lib.
 */
export function Segera({ judul, keterangan, tersedia }: { judul: string; keterangan: string; tersedia: string[] }) {
  return (
    <div style={{ padding: "26px 28px 40px" }}>
      <JudulHalaman judul={judul} keterangan={keterangan} />
      <div className="card" style={{ padding: "28px 26px", maxWidth: 620 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Construction size={19} style={{ color: "var(--brass)" }} />
          <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>
            Tampilan belum diporting
          </div>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--muted)", margin: "0 0 14px" }}>
          Model data dan rumus untuk modul ini sudah tersedia di lapisan bawah — yang
          tersisa hanya membangun tampilannya.
        </p>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Sudah tersedia</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.9, color: "var(--text)" }}>
          {tersedia.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
