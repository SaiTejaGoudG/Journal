import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPw, makeAccessToken, makeRefreshToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email: rawEmail, password, name } = await req.json();
    const email = rawEmail?.toLowerCase().trim();
    if (!email || !password || !name)
      return NextResponse.json({ detail: "email, password and name are required" }, { status: 400 });

    const db = await getDb();
    if (await db.collection("users").findOne({ email }))
      return NextResponse.json({ detail: "Email already registered" }, { status: 400 });

    const result = await db.collection("users").insertOne({
      email, name,
      password_hash: hashPw(password),
      role: "user", theme: "dark",
      created_at: new Date().toISOString(),
    });
    const uid = String(result.insertedId);

    const tok = await makeAccessToken(uid, email);
    const ref = await makeRefreshToken(uid);

    const res = NextResponse.json({ id: uid, email, name, role: "user", access_token: tok });
    res.cookies.set("access_token", tok, { httpOnly: true, sameSite: "lax", maxAge: 86400, path: "/" });
    res.cookies.set("refresh_token", ref, { httpOnly: true, sameSite: "lax", maxAge: 604800, path: "/" });
    return res;
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 500 });
  }
}
