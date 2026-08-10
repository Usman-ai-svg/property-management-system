import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehAksesProyek, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { Badge, CardHead, InfoRow, Kartu, Terbatas } from "@/components/ui";
import { FileRow } from "@/components/file-row";
import { KATEGORI_EKSTENSI } from "@/lib/storage";
import { unggahRevisi } from "../../../actions";
import { AksiTipeUnit } from "../../editors";
import { TabelBoqTipe, TabelRapTipe } from "./editors";

const pilihVersi = {
  select: { id: true, revisi: true, namaFile: true, ukuranByte: true, objectKey: true, diunggahPada: true },
  orderBy: { diunggahPada: "desc" as const },
};
const pilihDokumen = { select: { id: true, kategori: true, versions: pilihVersi } };

export default async function RincianTipeUnit({
  params,
}: {
  params: Promise<{ kode: string; tipeKode: string }>;
}) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  const { kode, tipeKode } = await params;
  const kodeProyek = kode.toUpperCase();

  const bolehHarga = bolehLihat(pengguna, "hargaRabRap");
  const ubahHarga = bolehUbah(pengguna, "hargaRabRap");
  const ubahTeknis = bolehUbah(pengguna, "dokumenTeknis");
  const bolehDokumen = bolehLihat(pengguna, "dokumenTeknis");

  const tipe = await prisma.unitType.findFirst({
    where: { kode: decodeURIComponent(tipeKode).toUpperCase(), project: { kode: kodeProyek } },
    select: {
      id: true, kode: true, nama: true, luasBangunan: true, luasTanah: true,
      rapUpahVolume: true, rapUpahHarga: true, projectId: true,
      project: { select: { kode: true, nama: true } },
      _count: { select: { units: true } },
      docModel3d: pilihDokumen,
      docGambarKerjaPdf: pilihDokumen,
      docGambarKerjaDwg: pilihDokumen,
      docRender: pilihDokumen,
      docSpek: pilihDokumen,
      ...(bolehHarga
        ? {
            boqItems: {
              orderBy: { urutan: "asc" as const },
              select: {
                id: true, grup: true, uraian: true, satuan: true,
                volume: true, hargaSatuan: true, spesifikasi: true,
              },
            },
            rapItems: {
              orderBy: { urutan: "asc" as const },
              select: {
                id: true, grup: true, kategori: true, nama: true, satuan: true,
                volume: true, hargaSatuan: true, keterangan: true,
              },
            },
          }
        : {}),
    },
  });

  if (!tipe || tipe.project.kode !== kodeProyek) notFound();
  if (!bolehAksesProyek(pengguna, tipe.projectId)) notFound();

  const boqItems = "boqItems" in tipe ? tipe.boqItems : [];
  const rapItems = "rapItems" in tipe ? tipe.rapItems : [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
        <Link href="/master" style={{ color: "inherit", textDecoration: "none" }}>Master Proyek</Link>
        {" / "}
        <Link href={`/master/${kodeProyek}`} style={{ color: "inherit", textDecoration: "none" }}>
          {tipe.project.nama}
        </Link>
        {" / "}
        <b style={{ color: "var(--text)" }}>Tipe {tipe.nama}</b>
      </div>

      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          flexWrap: "wrap", gap: 12, marginBottom: 16,
        }}
      >
        <div>
          <div className="eyebrow">Detail Tipe Unit · dokumen &amp; RAB/RAP master</div>
          <h3 className="disp" style={{ margin: "4px 0 0", fontSize: 19 }}>
            {tipe.project.nama} — Tipe {tipe.nama}
          </h3>
        </div>
        <Badge nilai={`${tipe._count.units} unit terpakai`} />
      </div>

      {/* ---------- baris 1: Deskripsi | Dokumen ---------- */}
      <div className="grid grid2">
        <Kartu>
          <CardHead
            judul="Deskripsi Tipe"
            aksi={
              ubahTeknis && (
                <AksiTipeUnit
                  kode={kodeProyek}
                  data={{ id: tipe.id, kode: tipe.kode, nama: tipe.nama, luasBangunan: tipe.luasBangunan, luasTanah: tipe.luasTanah }}
                  dipakai={tipe._count.units}
                />
              )
            }
          />
          <InfoRow label="Kode Tipe" nilai={tipe.kode} />
          <InfoRow label="Nama" nilai={tipe.nama} />
          <InfoRow label="Luas Bangunan" nilai={`${tipe.luasBangunan} m²`} />
          <InfoRow label="Luas Tanah" nilai={`${tipe.luasTanah} m²`} />
          <InfoRow label="Unit Terpakai" nilai={tipe._count.units} />
        </Kartu>

        <Kartu>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Dokumen Standar Tipe</div>
          {!bolehDokumen ? (
            <Terbatas apa="Dokumen teknis" />
          ) : (
            <>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>
                Diwariskan otomatis ke setiap unit bertipe {tipe.nama} — unggah revisi menyimpan versi lama.
              </div>
              {(
                [
                  ["3D Model", tipe.docModel3d, "model3d"],
                  ["Gambar Kerja PDF", tipe.docGambarKerjaPdf, "gambarKerjaPdf"],
                  ["Gambar Kerja DWG", tipe.docGambarKerjaDwg, "gambarKerjaDwg"],
                  ["Render", tipe.docRender, "render"],
                  ["Spesifikasi Material", tipe.docSpek, "spek"],
                ] as const
              ).map(([judul, dok, kategori]) => (
                <FileRow
                  key={kategori}
                  label={judul}
                  dokumen={dok ? { id: dok.id, kategori: dok.kategori, versi: dok.versions } : null}
                  bolehUbah={ubahTeknis}
                  konteks={`${judul} · Tipe ${tipe.nama}`}
                  pemilik={{ jenis: "tipeUnit", id: tipe.id, kategori }}
                  aksiUnggah={unggahRevisi}
                  terima={KATEGORI_EKSTENSI[kategori]?.join(",")}
                />
              ))}
            </>
          )}
        </Kartu>
      </div>

      {/* ---------- RAB & RAP master tipe ---------- */}
      {!bolehHarga ? (
        <div style={{ marginTop: 16 }}>
          <Terbatas apa="RAB dan RAP master tipe ini" />
        </div>
      ) : (
        <>
          <TabelBoqTipe
            unitTypeId={tipe.id}
            baris={boqItems}
            bolehHarga={bolehHarga}
            bolehUbah={ubahHarga}
            konteks={`Tipe ${tipe.nama}`}
          />
          <TabelRapTipe
            unitTypeId={tipe.id}
            baris={rapItems}
            upahVolume={tipe.rapUpahVolume}
            upahHarga={tipe.rapUpahHarga}
            bolehHarga={bolehHarga}
            bolehUbah={ubahHarga}
            konteks={`Tipe ${tipe.nama}`}
          />
        </>
      )}
    </div>
  );
}
