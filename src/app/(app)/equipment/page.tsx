import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehLihat, bolehUbah, filterProyek } from "@/lib/auth/rbac";
import { rp, tanggal } from "@/lib/format";
import { Badge, TabelHead } from "@/components/ui";
import { HapusAset, TambahAset, UbahAset } from "./editors";

/** Tanggal untuk <input type="date">: YYYY-MM-DD. */
const isoTanggal = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const WARNA_ASET: Record<string, [string, string]> = {
  Tersedia: ["var(--rona-abu)", "var(--muted)"],
  Digunakan: ["var(--rona-teal2)", "var(--teal)"],
  Pemeliharaan: ["var(--rona-amber)", "var(--amber)"],
  Rusak: ["var(--rona-merah)", "var(--red)"],
};

export default async function EquipmentAsset() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const bolehKelola = bolehUbah(pengguna, "aset");

  const aset = await prisma.equipment.findMany({
    orderBy: { kode: "asc" },
    select: {
      id: true, kode: true, nama: true, kategori: true, merk: true,
      jumlah: true, satuan: true, kepemilikan: true, status: true,
      satuanPakai: true, pemakaian: true, nilai: true,
      servisTerakhir: true, servisBerikut: true, penanggungJawab: true,
      vendorId: true, projectId: true,
      vendor: { select: { nama: true } },
      project: { select: { kode: true } },
    },
  });

  // Pilihan untuk formulir. Vendor tidak dibatasi proyek karena satu vendor
  // bisa menyewakan alat ke proyek mana pun.
  const [daftarVendor, daftarProyek] = bolehKelola
    ? await Promise.all([
        prisma.vendor.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
        prisma.project.findMany({
          where: filterProyek(pengguna),
          orderBy: { kode: "asc" },
          select: { id: true, nama: true },
        }),
      ])
    : [[], []];

  const milikSendiri = aset.filter((a) => a.kepemilikan === "Milik Sendiri");
  const perluPerhatian = aset.filter((a) => a.status === "Rusak" || a.status === "Pemeliharaan").length;
  const nilaiAset = milikSendiri.reduce((s, a) => s + a.nilai, 0);

  // Servis yang jatuh tempo dalam 30 hari ke depan, atau sudah terlewat.
  const ambang = new Date(Date.now() + 30 * 864e5);
  const servisDekat = aset.filter((a) => a.servisBerikut && a.servisBerikut <= ambang).length;

  const kpi: [string, string][] = [
    ["Total Aset", `${aset.length} jenis`],
    ["Milik Sendiri / Sewa", `${milikSendiri.length} / ${aset.length - milikSendiri.length}`],
    ["Perlu Perhatian", String(perluPerhatian)],
    [bolehHarga ? "Nilai Aset Sendiri" : "Servis ≤ 30 Hari", bolehHarga ? rp(nilaiAset) : String(servisDekat)],
  ];

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Equipment &amp; Asset</div>
      <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>Equipment &amp; Asset</h2>

      <div className="grid grid4" style={{ marginTop: 16 }}>
        {kpi.map(([label, nilai]) => (
          <div key={label} className="card kpi">
            <div className="eyebrow">{label}</div>
            <div className="v" style={{ fontSize: 15 }}>{nilai}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        <TabelHead
          judul={`Daftar Peralatan · ${aset.length} jenis`}
          keterangan="Aset sewa menampilkan tarif, bukan nilai perolehan."
          aksi={bolehKelola && <TambahAset vendor={daftarVendor} proyek={daftarProyek} />}
        />
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th style={{ minWidth: 200 }}>Nama</th>
                <th>Kategori</th>
                <th style={{ textAlign: "right" }}>Jumlah</th>
                <th>Kepemilikan</th>
                <th>Lokasi</th>
                <th>Penanggung Jawab</th>
                <th style={{ textAlign: "right" }}>Pemakaian</th>
                <th>Servis Berikut</th>
                {bolehHarga && <th style={{ textAlign: "right" }}>Nilai / Tarif</th>}
                <th>Status</th>
                {bolehKelola && <th style={{ width: 74 }} />}
              </tr>
            </thead>
            <tbody>
              {aset.map((a) => {
                const servisLewat = a.servisBerikut && a.servisBerikut < new Date();
                return (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.kode}</td>
                    <td>
                      <div>{a.nama}</div>
                      {a.merk && (
                        <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{a.merk}</div>
                      )}
                    </td>
                    <td style={{ color: "var(--muted)" }}>{a.kategori}</td>
                    <td style={{ textAlign: "right" }}>
                      {a.jumlah} {a.satuan}
                    </td>
                    <td>
                      {a.kepemilikan === "Sewa" ? (
                        <>
                          <span className="chip" style={{ background: "var(--rona-amber)", color: "var(--amber)" }}>
                            Sewa
                          </span>
                          {a.vendor && (
                            <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                              {a.vendor.nama}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="chip" style={{ background: "var(--rona-abu)", color: "var(--muted)" }}>
                          Milik Sendiri
                        </span>
                      )}
                    </td>
                    <td>{a.project?.kode ?? "—"}</td>
                    <td style={{ color: "var(--muted)" }}>{a.penanggungJawab ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {a.pemakaian.toLocaleString("id-ID")} {a.satuanPakai}
                    </td>
                    <td style={{ color: servisLewat ? "var(--red)" : "var(--muted)" }}>
                      {tanggal(a.servisBerikut)}
                      {servisLewat && (
                        <div style={{ fontSize: 10, fontWeight: 600 }}>terlewat</div>
                      )}
                    </td>
                    {bolehHarga && (
                      <td className="num" style={{ textAlign: "right" }}>
                        {rp(a.nilai)}
                        {a.kepemilikan === "Sewa" && (
                          <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>
                            per {a.satuanPakai}
                          </div>
                        )}
                      </td>
                    )}
                    <td>
                      <Badge nilai={a.status} peta={WARNA_ASET} />
                    </td>
                    {bolehKelola && (
                      <td>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <UbahAset
                            aset={{
                              id: a.id, kode: a.kode, nama: a.nama, kategori: a.kategori,
                              merk: a.merk, jumlah: a.jumlah, satuan: a.satuan,
                              kepemilikan: a.kepemilikan, vendorId: a.vendorId,
                              projectId: a.projectId, penanggungJawab: a.penanggungJawab,
                              status: a.status, satuanPakai: a.satuanPakai, pemakaian: a.pemakaian,
                              servisTerakhir: isoTanggal(a.servisTerakhir),
                              servisBerikut: isoTanggal(a.servisBerikut),
                              nilai: a.nilai,
                            }}
                            vendor={daftarVendor}
                            proyek={daftarProyek}
                          />
                          <HapusAset id={a.id} kode={a.kode} />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
