/** Beri izin section 'setujuiRab' ke DB dev yang sudah tersemai (tanpa reset). Idempoten. */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { ACL_AWAL, ACL_UBAH } from "../prisma/seed-data";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });

async function main() {
  const SEC = "setujuiRab";
  let n = 0;
  for (const peran of ACL_AWAL[SEC] ?? []) {
    const bolehUbah = (ACL_UBAH[SEC] ?? []).includes(peran);
    await prisma.roleSectionPermission.upsert({
      where: { roleNama_section: { roleNama: peran, section: SEC } },
      create: { roleNama: peran, section: SEC, bolehUbah },
      update: { bolehUbah },
    });
    n++;
  }
  console.log(`✔ izin ${SEC} tersinkron untuk ${n} peran`);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
