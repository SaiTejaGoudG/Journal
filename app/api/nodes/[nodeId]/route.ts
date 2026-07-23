import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";
import { docToDict } from "@/lib/utils";
import { LEARNING_STATUSES } from "@/lib/nodeModel";

type Ctx = { params: Promise<{ nodeId: string }> };

/**
 * GET /api/nodes/:id
 * A single node. Includes `breadcrumb` (ancestors resolved to id+title) so the
 * editor can render "AWS / EC2 / Security Groups" without extra round-trips.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const { nodeId } = await params;
  const db = await getDb();

  let node;
  try { node = await db.collection("nodes").findOne({ _id: new ObjectId(nodeId), user_id: user.id }); }
  catch { return NextResponse.json({ detail: "Invalid id" }, { status: 400 }); }
  if (!node) return NextResponse.json({ detail: "Node not found" }, { status: 404 });

  const d = docToDict(node)!;

  // breadcrumb from ancestors (single query, preserve order)
  const ancIds = (d.ancestors || []).filter(Boolean);
  if (ancIds.length) {
    const anc = await db.collection("nodes")
      .find({ _id: { $in: ancIds.map((x: string) => new ObjectId(x)) } }, { projection: { title: 1 } })
      .toArray();
    const byId: Record<string, string> = {};
    for (const a of anc) byId[String(a._id)] = a.title;
    d.breadcrumb = ancIds.map((id: string) => ({ id, title: byId[id] || "…" }));
  } else {
    d.breadcrumb = [];
  }
  return NextResponse.json(d);
}

/**
 * PATCH /api/nodes/:id
 * Edit content / rename / change learning status / toggle flags.
 * (Rename does not re-slug the path here — path changes belong to /move.)
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const { nodeId } = await params;
  const body = await req.json();
  const updates: any = {};
  for (const k of ["title", "content", "tags", "links", "is_favorite", "is_pinned", "is_archived"]) {
    if (body[k] !== undefined) updates[k] = body[k];
  }
  if (body.status !== undefined && LEARNING_STATUSES.includes(body.status)) updates.status = body.status;
  if (Object.keys(updates).length === 0)
    return NextResponse.json({ detail: "No fields to update" }, { status: 400 });
  updates.updated_at = new Date().toISOString();

  const db = await getDb();
  let result;
  try {
    result = await db.collection("nodes").findOneAndUpdate(
      { _id: new ObjectId(nodeId), user_id: user.id },
      { $set: updates },
      { returnDocument: "after" }
    );
  } catch { return NextResponse.json({ detail: "Invalid id" }, { status: 400 }); }
  if (!result) return NextResponse.json({ detail: "Node not found" }, { status: 404 });
  return NextResponse.json(docToDict(result));
}

/**
 * DELETE /api/nodes/:id
 * Deletes the node. For folders, cascades the whole subtree (via `ancestors`).
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const { nodeId } = await params;
  const db = await getDb();

  let node;
  try { node = await db.collection("nodes").findOne({ _id: new ObjectId(nodeId), user_id: user.id }); }
  catch { return NextResponse.json({ detail: "Invalid id" }, { status: 400 }); }
  if (!node) return NextResponse.json({ detail: "Node not found" }, { status: 404 });

  // cascade: delete this node + every descendant (ancestors contains this id)
  const res = await db.collection("nodes").deleteMany({
    user_id: user.id,
    $or: [{ _id: new ObjectId(nodeId) }, { ancestors: nodeId }],
  });
  return NextResponse.json({ message: "Deleted", removed: res.deletedCount });
}
