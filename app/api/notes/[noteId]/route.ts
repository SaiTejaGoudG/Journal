import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";
import { docToDict } from "@/lib/utils";

type Ctx = { params: Promise<{ noteId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const { noteId } = await params;
  const db = await getDb();

  const note = await db.collection("notes").findOneAndUpdate(
    { _id: new ObjectId(noteId), user_id: user.id },
    { $inc: { access_count: 1 } },
    { returnDocument: "after" }
  );
  if (!note) return NextResponse.json({ detail: "Note not found" }, { status: 404 });

  const d = docToDict(note)!;
  const linkedIds: string[] = d.linked_notes || [];
  const linkedData = [];
  for (const lid of linkedIds) {
    try {
      const ln = await db.collection("notes").findOne(
        { _id: new ObjectId(lid), user_id: user.id },
        { projection: { title: 1, category: 1, tags: 1 } }
      );
      if (ln) linkedData.push({ id: String(ln._id), title: ln.title || "Untitled", category: ln.category || "", tags: ln.tags || [] });
    } catch { /* ignore invalid ids */ }
  }
  d.linked_notes_data = linkedData;
  return NextResponse.json(d);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const { noteId } = await params;
  const body = await req.json();
  const updates: any = {};
  const allowed = ["title", "content", "category", "subcategory", "tags", "images",
    "collection_id", "collection_ids", "reminder_date", "linked_notes",
    "is_favorite", "is_pinned", "is_archived"];

  for (const k of allowed) {
    if (body[k] !== undefined && body[k] !== null) updates[k] = body[k];
  }
  if (Object.keys(updates).length === 0)
    return NextResponse.json({ detail: "No fields to update" }, { status: 400 });

  updates.updated_at = new Date().toISOString();
  const db = await getDb();
  const result = await db.collection("notes").findOneAndUpdate(
    { _id: new ObjectId(noteId), user_id: user.id },
    { $set: updates },
    { returnDocument: "after" }
  );
  if (!result) return NextResponse.json({ detail: "Note not found" }, { status: 404 });
  return NextResponse.json(docToDict(result));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const { noteId } = await params;
  const db = await getDb();
  const result = await db.collection("notes").deleteOne({ _id: new ObjectId(noteId), user_id: user.id });
  if (result.deletedCount === 0)
    return NextResponse.json({ detail: "Note not found" }, { status: 404 });
  return NextResponse.json({ message: "Deleted" });
}
