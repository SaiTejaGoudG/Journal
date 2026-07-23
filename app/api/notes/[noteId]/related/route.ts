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
  const limit = parseInt(new URL(req.url).searchParams.get("limit") || "5");
  const db = await getDb();
  const note = await db.collection("notes").findOne({ _id: new ObjectId(noteId), user_id: user.id });
  if (!note) return NextResponse.json({ detail: "Note not found" }, { status: 404 });

  const noteTags: string[] = note.tags || [];
  const noteCat: string = note.category || "";
  const base: any = { user_id: user.id, _id: { $ne: new ObjectId(noteId) }, is_archived: false };
  const orConds: any[] = [{ category: noteCat }];
  if (noteTags.length) orConds.push({ tags: { $in: noteTags } });

  let candidates = await db.collection("notes").find({ ...base, $or: orConds }).limit(20).toArray();
  if (!candidates.length)
    candidates = await db.collection("notes").find(base).sort({ access_count: -1 }).limit(limit).toArray();

  const noteTagsSet = new Set(noteTags);
  const scored = candidates.map((c) => {
    const shared = (c.tags || []).filter((t: string) => noteTagsSet.has(t)).length;
    const score = shared * 3
      + (c.category === noteCat ? 2 : 0)
      + (c.subcategory && c.subcategory === note.subcategory ? 1 : 0);
    return { score, c };
  });
  scored.sort((a, b) => b.score - a.score);
  return NextResponse.json(scored.slice(0, limit).map(({ c }) => docToDict(c)));
}
