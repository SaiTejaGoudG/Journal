import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";
import { randomBytes } from "crypto";

type Ctx = { params: Promise<{ noteId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  const { noteId } = await params;
  const db = await getDb();
  const note = await db.collection("notes").findOne({ _id: new ObjectId(noteId), user_id: user.id });
  if (!note) return NextResponse.json({ detail: "Note not found" }, { status: 404 });
  if (note.is_public) {
    await db.collection("notes").updateOne({ _id: new ObjectId(noteId) }, { $set: { is_public: false, share_token: null } });
    return NextResponse.json({ is_public: false, share_token: null });
  }
  const share_token = randomBytes(15).toString("base64url");
  await db.collection("notes").updateOne({ _id: new ObjectId(noteId) }, { $set: { is_public: true, share_token } });
  return NextResponse.json({ is_public: true, share_token });
}
