import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";
import { docToDict } from "@/lib/utils";

type Ctx = { params: Promise<{ collId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  const { collId } = await params;
  const db = await getDb();
  const coll = await db.collection("collections").findOne({ _id: new ObjectId(collId), user_id: user.id });
  if (!coll) return NextResponse.json({ detail: "Collection not found" }, { status: 404 });
  const d = docToDict(coll)!;
  const notes = await db.collection("notes").find({
    user_id: user.id, is_archived: false,
    $or: [{ collection_id: collId }, { collection_ids: { $in: [collId] } }],
  }).sort({ created_at: -1 }).toArray();
  d.notes = notes.map(docToDict);
  return NextResponse.json(d);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  const { collId } = await params;
  const body = await req.json();
  const updates: any = {};
  for (const k of ["name", "description", "cover_image"]) {
    if (body[k] !== undefined && body[k] !== null) updates[k] = body[k];
  }
  updates.updated_at = new Date().toISOString();
  const db = await getDb();
  const result = await db.collection("collections").findOneAndUpdate(
    { _id: new ObjectId(collId), user_id: user.id },
    { $set: updates },
    { returnDocument: "after" }
  );
  if (!result) return NextResponse.json({ detail: "Collection not found" }, { status: 404 });
  return NextResponse.json(docToDict(result));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  const { collId } = await params;
  const db = await getDb();
  await db.collection("collections").deleteOne({ _id: new ObjectId(collId), user_id: user.id });
  await db.collection("notes").updateMany(
    { user_id: user.id, $or: [{ collection_id: collId }, { collection_ids: collId }] },
    { $set: { collection_id: null }, $pull: { collection_ids: collId } } as any
  );
  return NextResponse.json({ message: "Deleted" });
}
