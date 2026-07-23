import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getDb } from "./db";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "change-me"
);
const JWT_ALGO = "HS256";

// ── Token creation ─────────────────────────────────────────────────────────

export async function makeAccessToken(uid: string, email: string) {
  return new SignJWT({ sub: uid, email, type: "access" })
    .setProtectedHeader({ alg: JWT_ALGO })
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

export async function makeRefreshToken(uid: string) {
  return new SignJWT({ sub: uid, type: "refresh" })
    .setProtectedHeader({ alg: JWT_ALGO })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

// ── Password helpers ────────────────────────────────────────────────────────

export function hashPw(pw: string) {
  return bcrypt.hashSync(pw, 10);
}

export function verifyPw(plain: string, hashed: string) {
  return bcrypt.compareSync(plain, hashed);
}

// ── Middleware helper ───────────────────────────────────────────────────────

/** Extract bearer token from Authorization header OR access_token cookie */
function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return req.cookies.get("access_token")?.value ?? null;
}

export async function getCurrentUser(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.type !== "access") return null;

    const db = await getDb();
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(payload.sub as string) });
    if (!user) return null;

    const { _id, password_hash, ...rest } = user;
    return { id: String(_id), ...rest };
  } catch {
    return null;
  }
}

/** Use inside Server Components / Route Handlers that trust the cookie store */
export async function getCurrentUserFromCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.type !== "access") return null;
    const db = await getDb();
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(payload.sub as string) });
    if (!user) return null;
    const { _id, password_hash, ...rest } = user;
    return { id: String(_id), ...rest };
  } catch {
    return null;
  }
}

// ── Seed admin on first boot ────────────────────────────────────────────────

export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@secondbrain.app";
  const pw = process.env.ADMIN_PASSWORD || "Admin123!";
  const db = await getDb();

  // Create indexes (idempotent)
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("notes").createIndex({ title: "text", content: "text" });
  await db
    .collection("notes")
    .createIndex({ user_id: 1, created_at: -1 });
  await db
    .collection("notes")
    .createIndex({ user_id: 1, category: 1 });
  await db
    .collection("notes")
    .createIndex({ user_id: 1, is_favorite: 1 });
  await db
    .collection("notes")
    .createIndex({ share_token: 1 }, { sparse: true });

  const existing = await db.collection("users").findOne({ email });
  if (!existing) {
    await db.collection("users").insertOne({
      email,
      name: "Admin",
      password_hash: hashPw(pw),
      role: "admin",
      theme: "dark",
      created_at: new Date().toISOString(),
    });
  } else if (!verifyPw(pw, existing.password_hash)) {
    await db
      .collection("users")
      .updateOne({ email }, { $set: { password_hash: hashPw(pw) } });
  }
}
