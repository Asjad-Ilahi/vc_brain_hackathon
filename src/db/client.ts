/**
 * Neon serverless (HTTP) Drizzle client.
 *
 * The HTTP driver is stateless — one fetch per query — so it is safe in Vercel
 * serverless functions with NO connection pooling and near-zero cold start.
 * This is the deliberate choice that avoids the classic "too many connections"
 * failure of serverless + Postgres.
 *
 * The client is initialized LAZILY (on first query) so `next build` and type
 * checks succeed without DATABASE_URL present — it only requires the env var at
 * actual request time.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DB = ReturnType<typeof drizzle<typeof schema>>;

let _db: DB | null = null;

function init(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string."
    );
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    if (!_db) _db = init();
    const value = Reflect.get(_db as object, prop, receiver);
    return typeof value === "function" ? value.bind(_db) : value;
  },
});

export { schema };
