import { createHash } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";
import { bersihkanNamaFile, GagalUnggah } from "@/lib/adaptor/berkas-aturan";

/**
 * MESIN PENYIMPANAN — Google Drive.
 *
 * Alasan keberadaannya: berkas .skp pada proyek ini berukuran 24–38 MB. Ribuan
 * berkas sebesar itu di disk aplikasi — atau di Supabase Storage yang ditagih
 * per GB — menjadi mahal jauh lebih cepat daripada seluruh sisa data proyek
 * digabung. Drive menampungnya di kuota organisasi yang memang sudah dibayar.
 *
 * Masuk lewat service account, bukan OAuth pengguna: berkas milik organisasi,
 * bukan milik orang yang kebetulan mengunggahnya, dan tidak boleh ikut hilang
 * saat orang itu keluar dari perusahaan.
 *
 * Unggahan memakai protokol RESUMABLE, bukan multipart. Google menganjurkan
 * multipart hanya untuk berkas kecil; pada ukuran .skp, satu putus jaringan di
 * tengah berarti mengulang 38 MB dari nol. Resumable juga memberi tahu Google
 * ukuran dan tipe berkas lebih dulu, sehingga penolakan kuota datang sebelum
 * satu byte pun terkirim.
 *
 * Seluruh ketergantungan luar — `fetch` dan jam — bisa disuntik lewat `opsi`.
 * Itu bukan hiasan: tanpanya protokol di berkas ini hanya bisa diuji dengan
 * kredensial Google sungguhan, yang berarti dalam praktiknya tidak pernah
 * diuji sama sekali.
 */

const OAUTH = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/drive/v3/files";
const UNGGAH = "https://www.googleapis.com/upload/drive/v3/files";

/** Cukup untuk membuat, membaca, dan menghapus berkas yang dibuat aplikasi. */
const SCOPE = "https://www.googleapis.com/auth/drive.file";

export interface KonfigGdrive {
  clientEmail: string;
  /** Kunci privat PKCS#8 service account, termasuk baris BEGIN/END. */
  privateKey: string;
  /** Folder Drive tujuan. Berkas tanpa induk tersebar di My Drive. */
  folderId: string;
}

export interface OpsiGdrive {
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}

/** Cukup untuk membaca variabel; `process.env` tetap cocok dengan bentuk ini. */
export type Env = Record<string, string | undefined>;

/** Baca konfigurasi dari environment; null bila belum lengkap. */
export function konfigDariEnv(env: Env = process.env): KonfigGdrive | null {
  const clientEmail = env.GDRIVE_CLIENT_EMAIL;
  // Kunci privat memuat baris baru. Di berkas .env baris baru itu lazim
  // ditulis sebagai \n literal, jadi dikembalikan di sini — kalau tidak,
  // importPKCS8 menolaknya dengan pesan yang tidak menjelaskan apa-apa.
  const privateKey = env.GDRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const folderId = env.GDRIVE_FOLDER_ID;
  if (!clientEmail || !privateKey || !folderId) return null;
  return { clientEmail, privateKey, folderId };
}

/** Ubah galat jaringan/HTTP menjadi pesan yang bisa dibaca pengguna. */
async function pastikanOk(r: Response, langkah: string): Promise<Response> {
  if (r.ok) return r;
  let rinci = "";
  try {
    const teks = await r.text();
    const j = JSON.parse(teks);
    rinci = j?.error?.message ?? teks.slice(0, 200);
  } catch {
    rinci = "";
  }
  // 403 dari Drive hampir selalu berarti folder tujuan belum dibagikan ke
  // service account — kesalahan penyiapan yang paling sering terjadi, dan
  // paling membingungkan kalau hanya ditulis "akses ditolak".
  if (r.status === 403) {
    throw new GagalUnggah(
      `Google Drive menolak ${langkah}. Pastikan folder tujuan sudah dibagikan ke service account sebagai Editor. ${rinci}`.trim(),
    );
  }
  throw new GagalUnggah(`Google Drive gagal saat ${langkah} (HTTP ${r.status}). ${rinci}`.trim());
}

export function buatMesinGdrive(konfig: KonfigGdrive, opsi: OpsiGdrive = {}) {
  const ambil = opsi.fetch ?? globalThis.fetch;
  const sekarang = opsi.now ?? Date.now;

  let token: { nilai: string; kedaluwarsa: number } | null = null;

  /**
   * Token akses, dipakai ulang selama masih berlaku.
   *
   * Diperbarui 60 detik sebelum kedaluwarsa: unggahan 38 MB bisa berjalan
   * lebih lama dari sisa umur token, dan token yang mati di tengah jalan
   * menggagalkan seluruh unggahan.
   */
  async function tokenAkses(): Promise<string> {
    if (token && token.kedaluwarsa - 60_000 > sekarang()) return token.nilai;

    const kunci = await importPKCS8(konfig.privateKey, "RS256");
    const detik = Math.floor(sekarang() / 1000);
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(konfig.clientEmail)
      .setAudience(OAUTH)
      .setIssuedAt(detik)
      .setExpirationTime(detik + 3600)
      .sign(kunci);

    const r = await pastikanOk(
      await ambil(OAUTH, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }).toString(),
      }),
      "meminta token akses",
    );

    const j = (await r.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) throw new GagalUnggah("Google Drive tidak mengembalikan token akses.");
    token = {
      nilai: j.access_token,
      kedaluwarsa: sekarang() + (j.expires_in ?? 3600) * 1000,
    };
    return token.nilai;
  }

  async function simpan(data: ArrayBuffer, namaAsli: string) {
    const buf = Buffer.from(data);
    const nama = bersihkanNamaFile(namaAsli);
    const akses = await tokenAkses();

    // Langkah 1 — mulai sesi. Ukuran dan tipe diumumkan lebih dulu supaya
    // penolakan kuota datang sebelum bytenya dikirim.
    const mulai = await pastikanOk(
      await ambil(`${UNGGAH}?uploadType=resumable&supportsAllDrives=true`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${akses}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "application/octet-stream",
          "X-Upload-Content-Length": String(buf.byteLength),
        },
        body: JSON.stringify({ name: nama, parents: [konfig.folderId] }),
      }),
      "memulai unggahan",
    );

    const alamat = mulai.headers.get("location");
    if (!alamat) {
      throw new GagalUnggah("Google Drive tidak memberikan alamat unggahan.");
    }

    // Langkah 2 — kirim isinya.
    const selesai = await pastikanOk(
      await ambil(alamat, {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": String(buf.byteLength),
        },
        body: new Uint8Array(buf),
      }),
      "mengirim isi berkas",
    );

    const j = (await selesai.json()) as { id?: string };
    if (!j.id) throw new GagalUnggah("Google Drive tidak mengembalikan id berkas.");

    return {
      // Kunci diberi awalan supaya berkas lama di disk tetap terbaca setelah
      // mesinnya berganti — lihat routing di index.ts.
      objectKey: `gdrive:${j.id}`,
      ukuranByte: buf.byteLength,
      sha256: createHash("sha256").update(buf).digest("hex"),
    };
  }

  async function baca(fileId: string): Promise<Buffer> {
    const akses = await tokenAkses();
    const r = await pastikanOk(
      await ambil(`${API}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
        headers: { Authorization: `Bearer ${akses}` },
      }),
      "mengunduh berkas",
    );
    return Buffer.from(await r.arrayBuffer());
  }

  async function hapus(fileId: string): Promise<void> {
    const akses = await tokenAkses();
    const r = await ambil(`${API}/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${akses}` },
    });
    // Berkas yang sudah tidak ada bukan kegagalan: hasil akhirnya sama saja.
    if (!r.ok && r.status !== 404) await pastikanOk(r, "menghapus berkas");
  }

  return { simpan, baca, hapus };
}
