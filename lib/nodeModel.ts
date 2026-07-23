/**
 * Node model — the single tree that powers the learning knowledge system.
 *
 * Design (see Learning-KMS-Redesign.md):
 *  - ONE `nodes` collection. Every node is either a `folder` (branch) or a
 *    `note` (leaf). A top-level folder (parent_id === null) IS a "category".
 *  - Arbitrary depth: any folder may contain folders AND notes.
 *  - Structure lives in the tree (parent_id / ancestors / path); cross-cutting
 *    connections live in `tags[]` and `links[]` (graph layer).
 *  - Notes carry a learning `status` so the tree doubles as a curriculum.
 *
 * ID convention (matches the rest of the app): Mongo `_id` is an ObjectId,
 * exposed to clients as the string `id`. `parent_id` and `ancestors[]` are
 * stored as STRING ids for consistency with existing references
 * (linked_notes, collection_id, user_id are all strings).
 */
import type { Db } from "mongodb";

export type NodeType = "folder" | "note";

/** Learning lifecycle for a note. Folders derive progress from their notes. */
export type LearningStatus = "learning" | "reviewing" | "mastered";
export const LEARNING_STATUSES: LearningStatus[] = ["learning", "reviewing", "mastered"];
export const DEFAULT_STATUS: LearningStatus = "learning";

export interface TreeNode {
  id: string;
  user_id: string;
  type: NodeType;
  title: string;
  slug: string;
  parent_id: string | null;
  ancestors: string[]; // root → parent order, e.g. [awsId, ec2Id]
  depth: number;        // 0 for top-level
  path: string;         // "aws/ec2/security-groups"
  position: number;     // manual sort order among siblings

  // note-only (absent/ignored on folders)
  content?: string;
  tags?: string[];
  links?: string[];
  status?: LearningStatus;

  // shared flags
  is_favorite?: boolean;
  is_pinned?: boolean;
  is_archived?: boolean;
  is_public?: boolean;
  share_token?: string | null;

  created_at: string;
  updated_at: string;
}

/** Convert a display name into a URL-safe slug. */
export function slugify(name: string): string {
  return (name || "")
    .toString()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")   // strip combining accent marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")        // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, "")            // trim hyphens
    .replace(/-{2,}/g, "-") || "untitled";
}

/** Join a parent path and a child slug into a full materialized path. */
export function buildPath(parentPath: string | null, slug: string): string {
  return parentPath ? `${parentPath}/${slug}` : slug;
}

/**
 * Derive the structural metadata for a NEW child, given its parent.
 * Pass `null` for a top-level node (a category).
 */
export function childMeta(
  parent: Pick<TreeNode, "id" | "ancestors" | "depth" | "path"> | null,
  slug: string
): { parent_id: string | null; ancestors: string[]; depth: number; path: string } {
  if (!parent) {
    return { parent_id: null, ancestors: [], depth: 0, path: slug };
  }
  return {
    parent_id: parent.id,
    ancestors: [...parent.ancestors, parent.id],
    depth: parent.depth + 1,
    path: buildPath(parent.path, slug),
  };
}

/**
 * Recompute ancestors/depth/path for a node (and later its subtree) after a
 * MOVE. Because we store `ancestors[]`, moving a subtree is a prefix rewrite,
 * not a recursive walk — see the move endpoint.
 */
export function recomputeForMove(
  moved: Pick<TreeNode, "slug">,
  newParent: Pick<TreeNode, "id" | "ancestors" | "depth" | "path"> | null
) {
  return childMeta(newParent, moved.slug);
}

/**
 * Create all indexes the tree relies on. Safe to call repeatedly (createIndex
 * is idempotent). Run this once at startup or from the migration script.
 */
export async function ensureNodeIndexes(db: Db): Promise<void> {
  const nodes = db.collection("nodes");
  await Promise.all([
    // Load the direct children of a node, in order — the core nav query.
    nodes.createIndex({ user_id: 1, parent_id: 1, position: 1 }, { name: "children" }),
    // Load / search / move an entire subtree with one query.
    nodes.createIndex({ user_id: 1, ancestors: 1 }, { name: "subtree" }),
    // Resolve a URL path → node. Unique per user.
    nodes.createIndex({ user_id: 1, path: 1 }, { name: "by_path", unique: true }),
    // Tag lookups (graph layer).
    nodes.createIndex({ user_id: 1, tags: 1 }, { name: "by_tag" }),
    // Learning dashboards ("what's due / still learning").
    nodes.createIndex({ user_id: 1, status: 1 }, { name: "by_status" }),
    // Idempotent migration marker.
    nodes.createIndex({ user_id: 1, legacy_note_id: 1 }, { name: "legacy_note", sparse: true }),
    // Full-text search across titles + content.
    nodes.createIndex({ title: "text", content: "text" }, { name: "fulltext" }),
  ]);
}

/**
 * Folder-level learning progress from its descendant notes.
 * Call with the note statuses found under a folder.
 */
export function progressFromStatuses(statuses: LearningStatus[]): {
  total: number; mastered: number; reviewing: number; learning: number; percent: number;
} {
  const total = statuses.length;
  const mastered = statuses.filter((s) => s === "mastered").length;
  const reviewing = statuses.filter((s) => s === "reviewing").length;
  const learning = statuses.filter((s) => s === "learning").length;
  const percent = total === 0 ? 0 : Math.round((mastered / total) * 100);
  return { total, mastered, reviewing, learning, percent };
}
