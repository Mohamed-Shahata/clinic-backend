import "dotenv/config";
import { defineConfig } from "@prisma/internals";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
