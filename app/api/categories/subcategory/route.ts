import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { docToDict } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  const { name, category_id } = await req.json();
  const db = await getDb();
  const doc = { name, category_id, user_id: user.id, created_at: new Date().toISOString() };
  const result = await db.collection("subcategories").insertOne(doc);
  return NextResponse.json(docToDict({ ...doc, _id: result.insertedId }), { status: 201 });
}
