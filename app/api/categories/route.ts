import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { docToDict } from "@/lib/utils";

const STATIC_CATEGORIES = [
  { id: "Technical", name: "Technical", color: "#6366F1" },
  { id: "Content Creation", name: "Content Creation", color: "#EC4899" },
  { id: "Ideas", name: "Ideas", color: "#F59E0B" },
];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  const db = await getDb();
  const subcats = await db.collection("subcategories").find({ user_id: user.id }).toArray();
  const pipeline = [
    { $match: { user_id: user.id, is_archived: false } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ];
  const catCounts: Record<string, number> = {};
  for (const c of await db.collection("notes").aggregate(pipeline).toArray()) {
    catCounts[c._id] = c.count;
  }
  const result = STATIC_CATEGORIES.map((cat) => ({
    ...cat,
    subcategories: subcats.filter((s) => s.category_id === cat.id).map(docToDict),
    note_count: catCounts[cat.id] || 0,
  }));
  return NextResponse.json(result);
}
