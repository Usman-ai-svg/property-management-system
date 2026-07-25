import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Lightbulb } from "lucide-react";
import { ambilPengguna, bolehLihat } from "@/lib/auth/rbac";
import { ringkasanProyek } from "@/lib/data/ringkasan";
import { statusSerapan } from "@/lib/calc/keuangan";
import { pct, rpRingkas } from "@/lib/format";
import { Badge, JudulHalaman, Kpi, Terbatas, Track, WARNA_STATUS } from "@/components/ui";

export default async function Ringkasan() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const proyek = await ringkasanProyek(pengguna);
  const bolehKeuangan = bolehLihat(pengguna, "keuangan");

  const totalUnit = proyek.reduce((s, p) => s + p.jumlahUnit, 0);
  const totalProgress = proyek.reduce((s, p) => s + p.unitProgress, 0);
  const totalSelesai = proyek.reduce((s, p) => s + p.unitSelesai, 0);
  const aktif = proyek.filter((p) => p.status === "Dalam Pembangunan");

  const totalAnggaran = proyek.reduce((s, p) => s + (p.anggaran ?? 0), 0);
  const totalRealisasi = proyek.reduce((s, p) => s + (p.realisasi ?? 0), 0);

  const tertinggi = [...aktif].sort((a, b) => b.rataProgress - a.rataProgress)[0];

  return (
    <div style={{ padding: "26px 28px 40px" }}>
      <JudulHalaman
        judul={`Selamat datang, ${pengguna.nama.split(" ")[0]}`}
        keterangan={`Peran aktif: ${pengguna.peranAktif} · ${
          pengguna.semuaProyek ? "akses seluruh proyek" : `akses ${proyek.length} proyek`
        }`}
      />

      <div className="grid grid4">
        <Kpi label="Proyek" nilai={String(proyek.length)} catatan={`${aktif.length} dalam pembangunan`} />
        <Kpi label="Total unit" nilai={String(totalUnit)} catatan={`${totalSelesai} selesai`} />
        <Kpi label="Unit berjalan" nilai={String(totalProgress)} catatan="sedang dibangun" />
        {bolehKeuangan ? (
          <Kpi
            label="Serapan anggaran"
            nilai={totalAnggaran ? pct(totalRealisasi / totalAnggaran, 1) : "—"}
            catatan={`${rpRingkas(totalRealisasi)} dari ${rpRingkas(totalAnggaran)}`}
          />
        ) : (
          <Kpi label="Serapan anggaran" nilai="—" catatan="tidak tersedia untuk peran ini" />
        )}
      </div>

      {aktif.length > 0 && (
        <div
          className="card"
          style={{
            marginTop: 14, padding: "13px 16px", display: "flex",
            alignItems: "flex-start", gap: 10, background: "#fbf9f3",
            borderColor: "#ecdfc4",
          }}
        >
          <Lightbulb size={16} style={{ color: "var(--brass)", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, lineHeight: 1.65 }}>
            {totalProgress} unit sedang dibangun di {aktif.length} cluster aktif.
            {tertinggi && ` Progres tertinggi: ${tertinggi.nama} (${tertinggi.rataProgress}%).`}
          </div>
        </div>
      )}

      <div className="sectitle">Progres per proyek</div>

      <div className="card tablewrap">
        <table>
          <thead>
            <tr>
              <th>Proyek</th>
              <th>Status lahan</th>
              <th style={{ textAlign: "right" }}>Unit</th>
              <th style={{ minWidth: 190 }}>Progres rata-rata</th>
              {bolehKeuangan && <th style={{ textAlign: "right" }}>Anggaran (RAP)</th>}
              {bolehKeuangan && <th style={{ textAlign: "right" }}>Realisasi</th>}
              {bolehKeuangan && <th>Serapan</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {proyek.map((p) => {
              const serapan = p.anggaran ? (p.realisasi ?? 0) / p.anggaran : 0;
              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.nama}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.kode}</div>
                  </td>
                  <td>
                    <Badge nilai={p.statusLahan} peta={WARNA_STATUS.lahan} />
                  </td>
                  <td style={{ textAlign: "right" }} className="num">
                    {p.jumlahUnit}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Track nilai={p.rataProgress} tinggi={18} />
                      <span className="num" style={{ fontSize: 12, minWidth: 34, textAlign: "right" }}>
                        {p.rataProgress}%
                      </span>
                    </div>
                  </td>
                  {bolehKeuangan && (
                    <td style={{ textAlign: "right" }} className="num">
                      {rpRingkas(p.anggaran ?? 0)}
                    </td>
                  )}
                  {bolehKeuangan && (
                    <td style={{ textAlign: "right" }} className="num">
                      {rpRingkas(p.realisasi ?? 0)}
                    </td>
                  )}
                  {bolehKeuangan && (
                    <td>
                      <Badge
                        nilai={statusSerapan(serapan, p.rataProgress)}
                        peta={WARNA_STATUS.serapan}
                      />
                    </td>
                  )}
                  <td>
                    <Link
                      href={`/master/${p.kode}`}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        color: "var(--teal)", fontSize: 12, fontWeight: 600, textDecoration: "none",
                      }}
                    >
                      Detail <ArrowUpRight size={13} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!bolehKeuangan && (
        <div style={{ marginTop: 14 }}>
          <Terbatas apa="Angka anggaran dan realisasi" />
        </div>
      )}
    </div>
  );
}
