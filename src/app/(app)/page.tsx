import { segmen } from "@/lib/adaptor/rute";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Lightbulb } from "lucide-react";
import { ambilPengguna, bolehLihat } from "@/lib/auth/rbac";
import { labelJabatan } from "@/lib/domain/jabatan";
import { ringkasanProyek } from "@/lib/data/ringkasan";
import { kpiSeluruhFitur } from "@/lib/data/kpi-ringkasan";
import { statusSerapan } from "@/lib/calc/keuangan";
import { rpRingkas } from "@/lib/format";
import { Badge, JudulHalaman, Kpi, Terbatas, Track, WARNA_STATUS } from "@/components/ui";
import { Tabel } from "@/components/kartu-tabel";
import { proyekBerjalan, totalProgresUnit } from "@/lib/tampilan/ringkasan";

export default async function Ringkasan() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const proyek = await ringkasanProyek(pengguna);
  const grup = await kpiSeluruhFitur(pengguna, proyek);
  const bolehKeuangan = bolehLihat(pengguna, "keuangan");

  const totalProgress = totalProgresUnit(proyek);
  const { aktif, tertinggi } = proyekBerjalan(proyek);

  return (
    <div style={{ padding: "26px 28px 40px" }}>
      <JudulHalaman
        judul={`Selamat datang, ${pengguna.nama.split(" ")[0]}`}
        keterangan={`Jabatan: ${pengguna.jabatan.map(labelJabatan).join(" · ")} · ${
          pengguna.semuaProyek ? "akses seluruh proyek" : `akses ${proyek.length} proyek`
        }`}
      />

      {aktif.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 18, padding: "13px 16px", display: "flex",
            alignItems: "flex-start", gap: 10, background: "var(--rona-krem)",
            borderColor: "var(--garis-krem)",
          }}
        >
          <Lightbulb size={16} style={{ color: "var(--brass)", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, lineHeight: 1.65 }}>
            {totalProgress} unit sedang dibangun di {aktif.length} cluster aktif.
            {tertinggi && ` Progres tertinggi: ${tertinggi.nama} (${tertinggi.rataProgress}%).`}
          </div>
        </div>
      )}

      {/*
        KPI seluruh modul, dikelompokkan per fitur.

        Grup yang tidak muncul di sini bukan disembunyikan di sisi tampilan:
        angkanya memang tidak pernah dihitung untuk peran ini. Urutannya
        mengikuti urutan menu supaya "Vendor Management" ada di tempat yang
        sama, baik dicari lewat sidebar maupun lewat halaman ini.
      */}
      {grup.map((g) => (
        <section key={g.id} style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              gap: 12, marginBottom: 8,
            }}
          >
            <div className="eyebrow">{g.judul}</div>
            <Link
              href={g.href}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                color: "var(--teal)", fontSize: 12, fontWeight: 600, textDecoration: "none",
              }}
            >
              Buka <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="grid grid4">
            {g.angka.map((a) => (
              <Kpi key={a.label} label={a.label} nilai={a.nilai} catatan={a.catatan} />
            ))}
          </div>
        </section>
      ))}

      <div className="sectitle">Progres per proyek</div>

      <Tabel
        kelasBungkus="card tablewrap"
        kolom={[
          { label: "Proyek" },
          { label: "Status lahan" },
          { label: "Unit", rata: "kanan" },
          { label: "Progres rata-rata", minLebar: 190 },
          bolehKeuangan && { label: "Anggaran (RAP)", rata: "kanan" },
          bolehKeuangan && { label: "Realisasi", rata: "kanan" },
          bolehKeuangan && { label: "Serapan" },
          {},
        ]}
      >
        {proyek.map((p) => {
          const serapan = p.anggaran ? (p.realisasi ?? 0) / p.anggaran : 0;
          return (
            <tr key={p.id}>
              <td>
                <div style={{ fontWeight: 600 }}>{p.nama}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.kode}</div>
              </td>
              <td>
                <Badge nilai={p.status} peta={WARNA_STATUS.proyek} />
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
                  href={`/master/${segmen(p.kode)}`}
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
      </Tabel>

      {!bolehKeuangan && (
        <div style={{ marginTop: 14 }}>
          <Terbatas apa="Angka anggaran dan realisasi" />
        </div>
      )}
    </div>
  );
}
