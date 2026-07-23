import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { docToDict } from "@/lib/utils";
import {
  slugify, childMeta, ensureNodeIndexes, DEFAULT_STATUS, LEARNING_STATUSES,
  type NodeType, type LearningStatus,
} from "@/lib/nodeModel";

/**
 * GET /api/nodes?parent_id=<id|null>
 * Returns the DIRECT children of one node (lazy, one level) — the core
 * navigation query. Omit parent_id (or pass "root"/"null") for top-level
 * folders ("categories"). Folders come first, then notes, each by `position`.
 * Each folder includes lightweight learning progress from its descendants.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("parent_id");
  const parentId = !raw || raw === "root" || raw === "null" ? null : raw;

  const db = await getDb();
  const children = (await db
    .collection("nodes")
    .find({ user_id: user.id, parent_id: parentId, is_archived: { $ne: true } })
    .sort({ type: 1, position: 1, title: 1 }) // "folder" < "note" alphabetically → folders first
    .toArray()).map(docToDict);

  // attach progress to folder children (mastered/total among descendant notes)
  const folderIds = children.filter((c: any) => c.type === "folder").map((c: any) => c.id);
  if (folderIds.length) {
    const agg = await db.collection("nodes").aggregate([
      { $match: { user_id: user.id, type: "note", ancestors: { $in: folderIds } } },
      { $unwind: "$ancestors" },
      { $match: { ancestors: { $in: folderIds } } },
      { $group: { _id: { f: "$ancestors", s: "$status" }, n: { $sum: 1 } } },
    ]).toArray();
    const prog: Record<string, { total: number; mastered: number }> = {};
    for (const row of agg) {
      const f = row._id.f;
      prog[f] = prog[f] || { total: 0, mastered: 0 };
      prog[f].total += row.n;
      if (row._id.s === "mastered") prog[f].mastered += row.n;
    }
    for (const c of children as any[]) {
      if (c.type === "folder") {
        const p = prog[c.id] || { total: 0, mastered: 0 };
        c.progress = { ...p, percent: p.total ? Math.round((p.mastered / p.total) * 100) : 0 };
      }
    }
  }

  return NextResponse.json({ parent_id: parentId, children });
}

/**
 * POST /api/nodes
 * Create a folder or note IN CONTEXT (under parent_id; null = new category).
 * Body: { type, title, parent_id?, content?, tags?, status? }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const type: NodeType = body.type === "folder" ? "folder" : "note";
  const title: string = (body.title || "").trim() || (type === "folder" ? "New Folder" : "Untitled");
  const parentId: string | null = body.parent_id || null;

  const db = await getDb();
  await ensureNodeIndexes(db); // cheap + idempotent; guarantees indexes on first write

  // resolve parent (null = top-level)
  let parent = null;
  if (parentId) {
    const { ObjectId } = await import("mongodb");
    let pdoc;
    try { pdoc = await db.collection("nodes").findOne({ _id: new ObjectId(parentId), user_id: user.id }); }
    catch { return NextResponse.json({ detail: "Invalid parent_id" }, { status: 400 }); }
    if (!pdoc) return NextResponse.json({ detail: "Parent not found" }, { status: 404 });
    if (pdoc.type !== "folder") return NextResponse.json({ detail: "Parent must be a folder" }, { status: 400 });
    parent = { id: String(pdoc._id), ancestors: pdoc.ancestors, depth: pdoc.depth, path: pdoc.path };
  }

  // unique slug/path among siblings
  const baseSlug = slugify(title);
  let slug = baseSlug, meta = childMeta(parent, slug), i = 2;
  while (await db.collection("nodes").findOne({ user_id: user.id, path: meta.path })) {
    slug = `${baseSlug}-${i++}`;
    meta = childMeta(parent, slug);
  }

  // next sibling position
  const last = await db.collection("nodes")
    .find({ user_id: user.id, parent_id: meta.parent_id })
    .sort({ position: -1 }).limit(1).toArray();
  const position = (last[0]?.position ?? -1) + 1;

  const status: LearningStatus =
    type === "note" && LEARNING_STATUSES.includes(body.status) ? body.status : DEFAULT_STATUS;

  const now = new Date().toISOString();
  const doc: any = {
    user_id: user.id, type, title, slug,
    parent_id: meta.parent_id, ancestors: meta.ancestors, depth: meta.depth, path: meta.path,
    position, is_archived: false, created_at: now, updated_at: now,
  };
  if (type === "note") {
    doc.content = body.content || "";
    doc.tags = Array.isArray(body.tags) ? body.tags : [];
    doc.links = [];
    doc.status = status;
    doc.is_favorite = false; doc.is_pinned = false; doc.is_public = false; doc.share_token = null;
  }

  const r = await db.collection("nodes").insertOne(doc);
  return NextResponse.json(docToDict({ ...doc, _id: r.insertedId }), { status: 201 });
}
