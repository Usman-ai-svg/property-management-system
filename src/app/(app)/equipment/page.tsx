import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehLihat } from "@/lib/auth/rbac";
import { rp, tanggal } from "@/lib/format";
import { Badge, TabelHead } from "@/components/ui";

const WARNA_ASET: Record<string, [string, string]> = {
  Tersedia: ["#eef2f3", "var(--muted)"],
  Digunakan: ["#e7f0f4", "var(--teal)"],
  Pemeliharaan: ["#fff3df", "var(--amber)"],
  Rusak: ["#fbeae8", "var(--red)"],
};

export default async function EquipmentAsset() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");

  const aset = await prisma.equipment.findMany({
    orderBy: { kode: "asc" },
    select: {
      id: true, kode: true, nama: true, kategori: true, merk: true,
      jumlah: true, satuan: true, kepemilikan: true, status: true,
      satuanPakai: true, pemakaian: true, nilai: true,
      servisTerakhir: true, servisBerikut: true, penanggungJawab: true,
      vendor: { select: { nama: true } },
      project: { select: { kode: true } },
    },
  });

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
                          <span className="chip" style={{ background: "#fff3df", color: "var(--amber)" }}>
                            Sewa
                          </span>
                          {a.vendor && (
                            <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                              {a.vendor.nama}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="chip" style={{ background: "#eef2f3", color: "var(--muted)" }}>
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
