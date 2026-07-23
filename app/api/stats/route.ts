import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  const db = await getDb();
  const [total, favorites, collectionsCount, catStats] = await Promise.all([
    db.collection("notes").countDocuments({ user_id: user.id, is_archived: false }),
    db.collection("notes").countDocuments({ user_id: user.id, is_favorite: true, is_archived: false }),
    db.collection("collections").countDocuments({ user_id: user.id }),
    db.collection("notes").aggregate([
      { $match: { user_id: user.id, is_archived: false } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]).toArray(),
  ]);
  const by_category: Record<string, number> = {};
  for (const s of catStats) if (s._id) by_category[s._id] = s.count;
  return NextResponse.json({ total_notes: total, favorites, collections: collectionsCount, by_category });
}
