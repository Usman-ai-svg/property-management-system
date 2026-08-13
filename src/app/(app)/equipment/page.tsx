import { redirect } from "next/navigation";
import { ambilPengguna, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { dataAset } from "@/lib/data/aset";
import { rp, tanggal } from "@/lib/format";
import { BarisKpi } from "@/components/ui";
import { kpiAset } from "@/lib/tampilan/aset";
import type { AlatPilihan } from "./editors";
import {
  type BarisInv, type BarisPakai, type BarisSesuai, type BarisServis,
  TabelInventaris, TabelPenggunaan, TabelPenyesuaian, TabelServis,
} from "./tabel-equipment";

/** Tanggal untuk <input type="date">: YYYY-MM-DD. */
const isoTanggal = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

type DataAset = Awaited<ReturnType<typeof dataAset>>;

/** Ubah satu alat kaya-data menjadi baris tabel inventaris yang bisa dikirim ke klien. */
function keBarisInv(a: DataAset["peralatan"][number], kini: Date): BarisInv {
  return {
    id: a.id, kode: a.kode, jenis: a.jenis, nama: a.nama, kategori: a.kategori,
    merk: a.merk, satuan: a.satuan, jumlah: a.jumlah, jumlahRusak: a.jumlahRusak,
    dipakai: a.dipakai, tersedia: a.tersedia, status: a.status,
    kepemilikan: a.kepemilikan, vendorId: a.vendorId, vendorNama: a.vendor?.nama ?? null,
    nilai: a.nilai,
    servisTerakhirIso: isoTanggal(a.servisTerakhir),
    servisBerikutIso: isoTanggal(a.servisBerikut),
    servisBerikutLabel: tanggal(a.servisBerikut),
    servisLewat: Boolean(a.servisBerikut && a.servisBerikut < kini),
  };
}

export default async function EquipmentAsset() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const bolehKelola = bolehUbah(pengguna, "aset");
  const bolehSesuaikan = bolehUbah(pengguna, "penyesuaianAset");

  const { peralatan, aset, penggunaan, penyesuaian, servis, daftarVendor, daftarProyek } =
    await dataAset(pengguna);

  const kini = new Date();
  const angka = kpiAset([...peralatan, ...aset]);
  const penggunaanAktif = penggunaan.filter((p) => p.status === "Aktif").length;

  // Baris siap-kirim untuk tiap tabel klien.
  const barisPeralatan = peralatan.map((a) => keBarisInv(a, kini));
  const barisAset = aset.map((a) => keBarisInv(a, kini));

  // Daftar alat untuk pemilih di form Penggunaan/Penyesuaian/Servis.
  const daftarAlat: AlatPilihan[] = [...peralatan, ...aset].map((a) => ({
    id: a.id, kode: a.kode, nama: a.nama, satuan: a.satuan,
    jumlah: a.jumlah, jumlahRusak: a.jumlahRusak, dipakai: a.dipakai, tersedia: a.tersedia,
    servisBerikut: a.servisBerikut ? tanggal(a.servisBerikut) : null,
  }));

  const barisPenggunaan: BarisPakai[] = penggunaan.map((p) => ({
    id: p.id, alatKode: p.equipment.kode, alatNama: p.equipment.nama, satuan: p.equipment.satuan,
    proyekKode: p.project.kode, jumlah: p.jumlah,
    mulaiLabel: tanggal(p.tanggalMulai),
    selesaiLabel: p.tanggalSelesai ? tanggal(p.tanggalSelesai) : null,
    hari: p.hari, tarif: p.tarif, biaya: p.biaya,
    penanggungJawab: p.penanggungJawab, status: p.status,
  }));

  const barisPenyesuaian: BarisSesuai[] = penyesuaian.map((r) => ({
    id: r.id, tglLabel: tanggal(r.tanggal),
    asetKode: r.equipment.kode, asetNama: r.equipment.nama, satuan: r.equipment.satuan,
    jenis: r.jenis, banyak: r.banyak,
    jumlahSebelum: r.jumlahSebelum, jumlahSesudah: r.jumlahSesudah,
    rusakSebelum: r.rusakSebelum, rusakSesudah: r.rusakSesudah,
    keterangan: r.keterangan, penanggungJawab: r.penanggungJawab, dicatatOleh: r.dicatatOleh,
  }));

  const barisServis: BarisServis[] = servis.map((s) => ({
    id: s.id, tglLabel: tanggal(s.tanggal),
    asetKode: s.equipment.kode, asetNama: s.equipment.nama,
    servisBerikutLabel: s.servisBerikut ? tanggal(s.servisBerikut) : null,
    biaya: s.biaya, catatan: s.catatan, dicatatOleh: s.dicatatOleh,
  }));

  const kpi: [string, string][] = [
    ["Total Inventaris", `${angka.jumlahJenis} jenis`],
    ["Milik Sendiri / Sewa", `${angka.milikSendiri} / ${angka.sewa}`],
    ["Penggunaan Aktif", String(penggunaanAktif)],
    [
      bolehHarga ? "Nilai Aset Sendiri" : "Perlu Perhatian",
      bolehHarga ? rp(angka.nilaiMilikSendiri) : String(angka.perluPerhatian),
    ],
  ];

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Equipment &amp; Asset</div>
      <h2 className="disp" style={{ margin: "4px 0 0", fontSize: 20 }}>Equipment &amp; Asset</h2>

      <BarisKpi kpi={kpi} />

      <TabelInventaris
        judul="Daftar Peralatan"
        keterangan="Inventaris alat kerja perusahaan. Tersedia = jumlah − rusak − yang sedang dipakai."
        jenis="Peralatan"
        data={barisPeralatan}
        vendor={daftarVendor}
        bolehKelola={bolehKelola}
      />

      <TabelInventaris
        judul="Daftar Aset"
        keterangan="Aset operasional perusahaan untuk keperluan proyek — mis. mobil proyek."
        jenis="Aset"
        data={barisAset}
        vendor={daftarVendor}
        bolehKelola={bolehKelola}
      />

      <TabelPenggunaan
        data={barisPenggunaan}
        daftarAlat={daftarAlat}
        proyek={daftarProyek}
        bolehKelola={bolehKelola}
        bolehHarga={bolehHarga}
      />

      <TabelPenyesuaian
        data={barisPenyesuaian}
        daftarAlat={daftarAlat}
        bolehSesuaikan={bolehSesuaikan}
      />

      <TabelServis
        data={barisServis}
        daftarAlat={daftarAlat}
        bolehKelola={bolehKelola}
        bolehHarga={bolehHarga}
      />
    </div>
  );
}
