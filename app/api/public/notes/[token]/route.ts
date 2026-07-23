import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { docToDict } from "@/lib/utils";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const db = await getDb();
  const note = await db.collection("notes").findOne({ share_token: token, is_public: true });
  if (!note) return NextResponse.json({ detail: "Note not found or sharing disabled" }, { status: 404 });
  const d = docToDict(note)!;
  delete d.user_id;
  delete d.share_token;
  return NextResponse.json(d);
}
