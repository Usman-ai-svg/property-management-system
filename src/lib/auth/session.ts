import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/**
 * Session berbasis JWT di cookie httpOnly.
 *
 * Sengaja dibuat sendiri dan seminimal mungkin — sekitar 60 baris — supaya
 * saat aplikasi ini dilebur ke ERP, lapisan auth-nya tinggal dibuang dan
 * diganti mekanisme milik ERP tanpa menyentuh bagian lain.
 *
 * Cookie httpOnly, BUKAN localStorage: token yang bisa dibaca JavaScript
 * ikut tercuri begitu ada satu celah XSS.
 */

const NAMA_COOKIE = "nms_session";
const MASA_BERLAKU_DETIK = 60 * 60 * 8; // 8 jam kerja

/**
 * Isi token sesi — sengaja cuma identitas, tanpa jabatan.
 *
 * Jabatan dan izinnya dibaca dari database pada tiap permintaan. Menyimpannya
 * di token akan membuat pencabutan hak baru berlaku setelah orangnya keluar
 * dan masuk lagi — dan sepanjang jeda itu, token lama tetap membuka pintu
 * yang sudah dikunci.
 */
export interface IsiSession {
  userId: string;
  nama: string;
}

function kunci(): Uint8Array {
  const rahasia = process.env.SESSION_SECRET;
  if (!rahasia || rahasia.length < 32) {
    throw new Error(
      "SESSION_SECRET belum diset atau kurang dari 32 karakter. Bangkitkan dengan: openssl rand -base64 32",
    );
  }
  return new TextEncoder().encode(rahasia);
}

export async function buatToken(isi: IsiSession): Promise<string> {
  return new SignJWT({ ...isi })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MASA_BERLAKU_DETIK}s`)
    .sign(kunci());
}

export async function bacaToken(token: string): Promise<IsiSession | null> {
  try {
    const { payload } = await jwtVerify(token, kunci());
    const { userId, nama } = payload as unknown as IsiSession;
    if (!userId) return null;
    return { userId, nama };
  } catch {
    // Token kedaluwarsa, tanda tangan salah, atau rusak — semuanya berarti
    // tidak ada session yang sah.
    return null;
  }
}

export async function simpanSession(isi: IsiSession): Promise<void> {
  const token = await buatToken(isi);
  const jar = await cookies();
  jar.set(NAMA_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MASA_BERLAKU_DETIK,
  });
}

export async function ambilSession(): Promise<IsiSession | null> {
  const jar = await cookies();
  const token = jar.get(NAMA_COOKIE)?.value;
  return token ? bacaToken(token) : null;
}

export async function hapusSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(NAMA_COOKIE);
}
