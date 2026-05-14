import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "Password123!";

async function main(): Promise<void> {
  const passwordHash = await hash(PASSWORD, 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: "super@demo.test" },
    update: {
      fullName: "Platform Super Admin",
      passwordHash,
      isSuperAdmin: true,
    },
    create: {
      email: "super@demo.test",
      fullName: "Platform Super Admin",
      passwordHash,
      isSuperAdmin: true,
    },
  });

  console.log("Super Admin created:", superAdmin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
