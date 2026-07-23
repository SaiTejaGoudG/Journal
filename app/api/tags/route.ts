import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  const db = await getDb();
  const pipeline = [
    { $match: { user_id: user.id, is_archived: false } },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 50 },
  ];
  const tags = await db.collection("notes").aggregate(pipeline).toArray();
  return NextResponse.json(tags.filter((t) => t._id).map((t) => ({ name: t._id, count: t.count })));
}
