/**
 * Ringkasan progres sekumpulan objek (unit atau sarpras) dalam gaya kartu
 * dashboard manajemen proyek: cincin capaian rata-rata di kiri, rincian status
 * (Selesai / Dikerjakan / Belum mulai) berlegenda di kanan. Murni presentasional
 * dan menerima daftar persentase, jadi dipakai bersama halaman detail proyek
 * maupun laporan.
 */
export function RingkasProgress({
  judul,
  nilai,
  satuan = "objek",
}: {
  judul: string;
  nilai: number[];
  satuan?: string;
}) {
  const total = nilai.length;
  const belum = nilai.filter((p) => p <= 0).length;
  const selesai = nilai.filter((p) => p >= 100).length;
  const dikerjakan = total - belum - selesai;
  const rata = total ? Math.round(nilai.reduce((s, p) => s + p, 0) / total) : 0;

  const pctDari = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const status: [string, number, string][] = [
    ["Selesai", selesai, "var(--green)"],
    ["Dikerjakan", dikerjakan, "var(--teal)"],
    ["Belum mulai", belum, "var(--muted)"],
  ];

  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>{judul}</div>

      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        {/* Cincin capaian rata-rata */}
        <div style={{ position: "relative", width: 92, height: 92, flexShrink: 0 }}>
          <svg viewBox="0 0 36 36" width={92} height={92} aria-hidden="true">
            <circle
              cx={18} cy={18} r={15.915} fill="none"
              stroke="var(--rona-abu)" strokeWidth={3.4} pathLength={100}
            />
            <circle
              cx={18} cy={18} r={15.915} fill="none"
              stroke={rata === 100 ? "var(--green)" : "var(--teal)"}
              strokeWidth={3.4} strokeLinecap="round" pathLength={100}
              strokeDasharray={`${rata} 100`} transform="rotate(-90 18 18)"
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
            <div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: "var(--ink)" }}>
                {rata}<span style={{ fontSize: 12 }}>%</span>
              </div>
              <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 3 }}>
                rata-rata
              </div>
            </div>
          </div>
        </div>

        {/* Rincian status */}
        <div style={{ flex: 1, minWidth: 190 }}>
          {status.map(([label, n, warna]) => (
            <div
              key={label}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "6px 0", borderBottom: "1px solid var(--garis-halus)",
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 3, background: warna, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "var(--text)", flex: 1 }}>{label}</span>
              <span className="num" style={{ fontSize: 14, fontWeight: 700 }}>{n}</span>
              <span style={{ fontSize: 11, color: "var(--muted)", width: 40, textAlign: "right" }}>
                {pctDari(n)}%
              </span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 9, paddingTop: 8 }}>
            <span style={{ width: 9, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>Total {satuan}</span>
            <span className="num" style={{ fontSize: 14, fontWeight: 700 }}>{total}</span>
            <span style={{ width: 40 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
