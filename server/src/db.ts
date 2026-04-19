import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaAppDao } from "./dao/PrismaAppDao.js";
import type { IAppDao } from "./dao/IAppDao.js";
import { getMergedAppEnv } from "./infrastructure/appRuntimeConfig.js";
import { AppPaths } from "./infrastructure/AppPaths.js";

const DEFAULT_DB_URL = `file:${path.resolve(import.meta.dirname, "../../data/app.db")}`;

const pathsForDb = new AppPaths();
const mergedForPrisma = getMergedAppEnv(pathsForDb);
const resolvedDatabaseUrl = mergedForPrisma.DATABASE_URL?.trim() || DEFAULT_DB_URL;

// Prisma 7 requires an adapter for direct database connections (LibSQL for SQLite).
const prisma = new PrismaClient({
  adapter: new PrismaLibSql({
    url: resolvedDatabaseUrl,
  }),
});

const prismaAppRoot = PrismaAppDao.createRoot(prisma);

/** Application DAO — persistence operations only (no connection or transaction API on the type). */
export const appDao: IAppDao = prismaAppRoot;

/** Runs `fn` in a single DB transaction; `fn` receives a scoped {@link IAppDao}. */
export type AppTransactionRunner = <R>(fn: (tx: IAppDao) => Promise<R>) => Promise<R>;

export const runAppTransaction: AppTransactionRunner = (fn) => prismaAppRoot.runTransaction(fn);

/** Connect and apply driver-specific settings (e.g. SQLite busy timeout). */
export async function openAppDatabase(): Promise<void> {
  await prismaAppRoot.connect();
  await prismaAppRoot.executePragmaBusyTimeoutMs();
}

export async function closeAppDatabase(): Promise<void> {
  await prismaAppRoot.disconnect();
}

/** Low-level client for migrations / Prisma CLI. Application code should use {@link appDao}. */
export { prisma };
