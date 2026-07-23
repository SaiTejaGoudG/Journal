import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { docToDict } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const tag = searchParams.get("tag");
  const isFav = searchParams.get("is_favorite");
  const isArchived = searchParams.get("is_archived") === "true";
  const q = searchParams.get("q");
  const date = searchParams.get("date");
  const collectionId = searchParams.get("collection_id");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const query: any = { user_id: user.id, is_archived: isArchived };
  if (q) query.$text = { $search: q };
  if (category) query.category = category;
  if (tag) query.tags = tag;
  if (isFav !== null) query.is_favorite = isFav === "true";
  if (date) query.created_at = { $gte: `${date}T00:00:00`, $lte: `${date}T23:59:59` };
  if (collectionId) query.$or = [{ collection_id: collectionId }, { collection_ids: { $in: [collectionId] } }];

  const db = await getDb();
  const total = await db.collection("notes").countDocuments(query);
  const cursor = db
    .collection("notes")
    .find(query)
    .sort({ is_pinned: -1, created_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const notes = (await cursor.toArray()).map(docToDict);
  return NextResponse.json({ notes, total, page, limit });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { title, content = "", category = "Ideas", subcategory = "", tags = [],
    images = [], collection_id = null, collection_ids = [],
    reminder_date = null, linked_notes = [] } = body;

  const db = await getDb();

  // Duplicate check
  if (title && content) {
    const existing = await db.collection("notes").findOne({
      user_id: user.id, title, content, is_archived: false,
    });
    if (existing)
      return NextResponse.json({ detail: "A similar note already exists" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const doc = {
    title, content, category, subcategory, tags, images,
    collection_id, collection_ids, reminder_date, linked_notes,
    user_id: user.id,
    is_favorite: false, is_pinned: false, is_archived: false,
    is_public: false, share_token: null,
    access_count: 0, created_at: now, updated_at: now,
  };

  const result = await db.collection("notes").insertOne(doc);
  return NextResponse.json(docToDict({ ...doc, _id: result.insertedId }), { status: 201 });
}
