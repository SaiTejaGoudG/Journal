import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { docToDict } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  const db = await getDb();
  const colls = await db.collection("collections").find({ user_id: user.id }).sort({ created_at: -1 }).toArray();
  const result = await Promise.all(
    colls.map(async (c) => {
      const d = docToDict(c)!;
      d.note_count = await db.collection("notes").countDocuments({
        user_id: user.id, is_archived: false,
        $or: [{ collection_id: d.id }, { collection_ids: { $in: [d.id] } }],
      });
      return d;
    })
  );
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  const { name, description = "", cover_image = "" } = await req.json();
  const now = new Date().toISOString();
  const doc = { name, description, cover_image, user_id: user.id, created_at: now, updated_at: now };
  const db = await getDb();
  const result = await db.collection("collections").insertOne(doc);
  return NextResponse.json({ ...docToDict({ ...doc, _id: result.insertedId }), note_count: 0 }, { status: 201 });
}
