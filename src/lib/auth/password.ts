import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const PANJANG_KUNCI = 64;

/**
 * Hash password memakai scrypt bawaan Node — tanpa dependensi eksternal.
 *
 * scrypt sengaja dibuat mahal secara memori sehingga serangan brute-force
 * dengan GPU jadi tidak ekonomis. Format simpan: `scrypt$<salt hex>$<hash hex>`,
 * agar parameter bisa diubah di kemudian hari tanpa memecah data lama.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const kunci = await scrypt(password, salt, PANJANG_KUNCI);
  return `scrypt$${salt.toString("hex")}$${kunci.toString("hex")}`;
}

/**
 * Verifikasi password.
 *
 * Perbandingan memakai timingSafeEqual, bukan `===`, supaya lama waktu
 * perbandingan tidak membocorkan seberapa banyak byte awal yang cocok.
 */
export async function verifyPassword(password: string, tersimpan: string): Promise<boolean> {
  const bagian = tersimpan.split("$");
  if (bagian.length !== 3 || bagian[0] !== "scrypt") return false;

  const salt = Buffer.from(bagian[1], "hex");
  const diharapkan = Buffer.from(bagian[2], "hex");
  if (diharapkan.length !== PANJANG_KUNCI) return false;

  const kunci = await scrypt(password, salt, PANJANG_KUNCI);
  return timingSafeEqual(kunci, diharapkan);
}
