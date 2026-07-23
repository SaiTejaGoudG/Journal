import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPw, makeAccessToken, makeRefreshToken, seedAdmin } from "@/lib/auth";

let seeded = false;

export async function POST(req: NextRequest) {
  // Seed admin once on the first login request
  if (!seeded) {
    await seedAdmin();
    seeded = true;
  }

  try {
    const { email: rawEmail, password } = await req.json();
    const email = rawEmail?.toLowerCase().trim();

    const db = await getDb();
    const user = await db.collection("users").findOne({ email });
    if (!user || !verifyPw(password, user.password_hash))
      return NextResponse.json({ detail: "Invalid credentials" }, { status: 401 });

    const uid = String(user._id);
    const tok = await makeAccessToken(uid, email);
    const ref = await makeRefreshToken(uid);

    const res = NextResponse.json({
      id: uid, email,
      name: user.name || "",
      role: user.role || "user",
      access_token: tok,
    });
    res.cookies.set("access_token", tok, { httpOnly: true, sameSite: "lax", maxAge: 86400, path: "/" });
    res.cookies.set("refresh_token", ref, { httpOnly: true, sameSite: "lax", maxAge: 604800, path: "/" });
    return res;
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 500 });
  }
}
