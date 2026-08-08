/** Beri izin section 'setujuiRab' ke DB dev yang sudah tersemai (tanpa reset). Idempoten. */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { ACL_AWAL, ACL_UBAH } from "../prisma/seed-data";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });

async function main() {
  const SEC = "setujuiRab";
  let n = 0;
  for (const peran of ACL_AWAL[SEC] ?? []) {
    const role = await prisma.role.findUnique({ where: { nama: peran }, select: { id: true } });
    if (!role) continue;
    const bolehUbah = (ACL_UBAH[SEC] ?? []).includes(peran);
    const ada = await prisma.roleSectionPermission.findFirst({ where: { roleId: role.id, section: SEC } });
    if (ada) await prisma.roleSectionPermission.update({ where: { id: ada.id }, data: { bolehUbah } });
    else await prisma.roleSectionPermission.create({ data: { roleId: role.id, section: SEC, bolehUbah } });
    n++;
  }
  console.log(`✔ izin ${SEC} tersinkron untuk ${n} peran`);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
