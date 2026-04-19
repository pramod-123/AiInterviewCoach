import path from "node:path";
import { defineConfig } from "prisma/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { AppPaths } from "./src/infrastructure/AppPaths.js";
import { getMergedAppEnv } from "./src/infrastructure/appRuntimeConfig.js";

const DEFAULT_DB_URL = `file:${path.resolve(import.meta.dirname, "../data/app.db")}`;

function resolveDatabaseUrl(): string {
  try {
    const merged = getMergedAppEnv(new AppPaths());
    const u = merged.DATABASE_URL?.trim();
    if (u) {
      return u;
    }
  } catch {
    /* ignore */
  }
  return process.env["DATABASE_URL"]?.trim() || DEFAULT_DB_URL;
}

const prismaDatasourceUrl = resolveDatabaseUrl();

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: prismaDatasourceUrl,
  },
  migrate: {
    async adapter(env: Record<string, string | undefined>) {
      const url = env["DATABASE_URL"]?.trim() || prismaDatasourceUrl;
      return new PrismaLibSql({ url });
    },
  },
});
