#!/usr/bin/env node
/**
 * Zero-loss migration: legacy `notes` (+ categories/subcategories/collections)
 * → the unified `nodes` tree.
 *
 * WHAT IT DOES
 *   1. Ensures the `nodes` indexes exist.
 *   2. Per user, builds top-level folder nodes from categories
 *      (the 3 built-ins + any category actually used by that user's notes).
 *   3. Builds subfolder nodes from each distinct `subcategory` used, plus any
 *      rows in the `subcategories` collection.
 *   4. Converts every note into a `type:"note"` leaf under its (sub)folder,
 *      copying content, tags, images, flags, share settings, timestamps.
 *      Adds `status:"learning"` (the new learning layer).
 *   5. Remaps `linked_notes` (old ids) → new node ids.
 *   6. Preserves collection membership as `collection:<name>` tags (nothing lost).
 *
 * SAFETY
 *   - Dry-run by DEFAULT. Prints the tree it WOULD create and writes nothing.
 *   - Pass `--commit` to actually write.
 *   - Idempotent: re-running skips notes already migrated (legacy_note_id marker)
 *     and folders that already exist (unique path). Safe to run repeatedly.
 *   - NON-DESTRUCTIVE: the original `notes` collection is never modified or
 *     deleted. If you dislike the result, just drop the `nodes` collection.
 *
 * USAGE  (run from the nextjs-app folder)
 *   node scripts/migrate-to-nodes.mjs             # dry-run (safe preview)
 *   node scripts/migrate-to-nodes.mjs --commit    # apply
 *   node scripts/migrate-to-nodes.mjs --commit --user <userId>   # one user only
 */
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BUILTIN_CATEGORIES = [
  { name: "Technical", color: "#6366F1" },
  { name: "Content Creation", color: "#EC4899" },
  { name: "Ideas", color: "#F59E0B" },
];

// ---------------------------------------------------------------------------
// env + connection (mirrors lib/db.ts, incl. Windows DoH SRV fallback)
// ---------------------------------------------------------------------------
function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : null;
}

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(join(__dirname, "..", f), "utf8");
      for (const line of txt.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
    } catch { /* file may not exist */ }
  }
}

async function resolveMongoUrl(url) {
  if (!url.startsWith("mongodb+srv://")) return url;
  try {
    const host = url.match(/@([^/?]+)/)?.[1];
    if (!host) return url;
    const srv = await (await fetch(`https://dns.google/resolve?name=_mongodb._tcp.${host}&type=SRV`)).json();
    if (!srv.Answer?.length) return url;
    const hosts = srv.Answer.map((r) => {
      const p = r.data.trim().split(/\s+/);
      return `${p[3].replace(/\.$/, "")}:${p[2]}`;
    }).join(",");
    let opts = "authSource=admin";
    const txt = await (await fetch(`https://dns.google/resolve?name=${host}&type=TXT`)).json();
    if (txt.Answer?.length) opts = txt.Answer[0].data.replace(/"/g, "");
    const rest = url.replace(/^mongodb\+srv:\/\//, "");
    const [cred, ...after] = rest.split("@");
    const afterAt = after.join("@");
    const slash = afterAt.indexOf("/");
    const pathQ = slash !== -1 ? afterAt.slice(slash) : "/";
    const [path, q] = pathQ.split("?");
    const params = new URLSearchParams(q || "");
    for (const [k, v] of new URLSearchParams(opts)) if (!params.has(k)) params.set(k, v);
    params.set("tls", "true");
    return `mongodb://${cred}@${hosts}${path}?${params.toString()}`;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function slugify(name) {
  return (name || "").toString().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "untitled";
}

async function ensureIndexes(db) {
  const n = db.collection("nodes");
  await Promise.all([
    n.createIndex({ user_id: 1, parent_id: 1, position: 1 }, { name: "children" }),
    n.createIndex({ user_id: 1, ancestors: 1 }, { name: "subtree" }),
    n.createIndex({ user_id: 1, path: 1 }, { name: "by_path", unique: true }),
    n.createIndex({ user_id: 1, tags: 1 }, { name: "by_tag" }),
    n.createIndex({ user_id: 1, status: 1 }, { name: "by_status" }),
    n.createIndex({ user_id: 1, legacy_note_id: 1 }, { name: "legacy_note", sparse: true }),
    n.createIndex({ title: "text", content: "text" }, { name: "fulltext" }),
  ]);
}

// ---------------------------------------------------------------------------
// migration (testable: takes a `db`, no connection concerns)
// ---------------------------------------------------------------------------
export async function migrateAll(db, { commit = false, onlyUser = null, log = console.log } = {}) {
  const COMMIT = commit;
  const ONLY_USER = onlyUser;
  log(`\n${COMMIT ? "🟢 COMMIT" : "🟡 DRY-RUN"}\n`);

  if (COMMIT) await ensureIndexes(db);

  const nodes = db.collection("nodes");
  const notesCol = db.collection("notes");
  const subcatsCol = db.collection("subcategories");
  const collectionsCol = db.collection("collections");

  // Which users to process
  const userFilter = ONLY_USER ? { user_id: ONLY_USER } : {};
  const userIds = ONLY_USER
    ? [ONLY_USER]
    : (await notesCol.distinct("user_id", {})).filter(Boolean);

  if (userIds.length === 0) { log("No notes found — nothing to migrate."); return { created: 0, skipped: 0 }; }

  let created = 0, skipped = 0;
  const now = () => new Date().toISOString();

  // create-or-find a folder node; returns its {id, ancestors, depth, path}
  async function upsertFolder(userId, name, parent, position) {
    const slug = slugify(name);
    const path = parent ? `${parent.path}/${slug}` : slug;
    const existing = await nodes.findOne({ user_id: userId, path });
    if (existing) return { id: String(existing._id), ancestors: existing.ancestors, depth: existing.depth, path };

    const ancestors = parent ? [...parent.ancestors, parent.id] : [];
    const depth = parent ? parent.depth + 1 : 0;
    const doc = {
      user_id: userId, type: "folder", title: name, slug,
      parent_id: parent ? parent.id : null, ancestors, depth, path, position,
      is_archived: false, created_at: now(), updated_at: now(),
    };
    if (COMMIT) {
      const r = await nodes.insertOne(doc);
      created++;
      return { id: String(r.insertedId), ancestors, depth, path };
    }
    // dry-run: synthesize a stable fake id from the path
    created++;
    return { id: `dry:${path}`, ancestors, depth, path };
  }

  async function uniquePath(userId, basePath) {
    if (!COMMIT) return basePath;
    let p = basePath, i = 2;
    while (await nodes.findOne({ user_id: userId, path: p })) { p = `${basePath}-${i++}`; }
    return p;
  }

  for (const userId of userIds) {
    const userNotes = await notesCol.find({ user_id: userId, ...userFilter }).toArray();
    log(`\n👤 user ${userId} — ${userNotes.length} notes`);

    // 1. categories = built-ins ∪ categories actually used
    const usedCats = [...new Set(userNotes.map((n) => n.category).filter(Boolean))];
    const catNames = [...new Set([...BUILTIN_CATEGORIES.map((c) => c.name), ...usedCats])];

    const catFolder = {};      // name → folder meta
    let pos = 0;
    for (const name of catNames) catFolder[name] = await upsertFolder(userId, name, null, pos++);

    // 2. subfolders from used subcategories + subcategories collection
    const subFolder = {};      // `${cat}///${sub}` → folder meta
    const subcatRows = await subcatsCol.find({ user_id: userId }).toArray();
    const subPairs = new Set();
    for (const n of userNotes) if (n.subcategory) subPairs.add(`${n.category || "Ideas"}///${n.subcategory}`);
    for (const s of subcatRows) {
      const catName = BUILTIN_CATEGORIES.find((c) => c.name === s.category_id)?.name || s.category_id;
      if (catName && s.name) subPairs.add(`${catName}///${s.name}`);
    }
    const subPos = {};
    for (const key of subPairs) {
      const [cat, sub] = key.split("///");
      const parent = catFolder[cat] || catFolder["Ideas"];
      subPos[cat] = (subPos[cat] || 0) + 1;
      subFolder[key] = await upsertFolder(userId, sub, parent, subPos[cat]);
    }

    // 3. collection id → name (for tag preservation)
    const collDocs = await collectionsCol.find({ user_id: userId }).toArray();
    const collName = {};
    for (const c of collDocs) collName[String(c._id)] = c.name;

    // 4. notes → note-nodes
    const legacyToNew = {};    // old note id → new node id
    const notePos = {};        // parentPath → running position
    for (const note of userNotes) {
      const legacyId = String(note._id);
      const already = await nodes.findOne({ user_id: userId, legacy_note_id: legacyId });
      if (already) { legacyToNew[legacyId] = String(already._id); skipped++; continue; }

      const key = note.subcategory ? `${note.category || "Ideas"}///${note.subcategory}` : null;
      const parent = (key && subFolder[key]) || catFolder[note.category] || catFolder["Ideas"];

      const slug = slugify(note.title || "untitled");
      const basePath = `${parent.path}/${slug}`;
      const path = await uniquePath(userId, basePath);

      // preserve collection membership as tags
      const collIds = [note.collection_id, ...(note.collection_ids || [])].filter(Boolean);
      const collTags = collIds.map((id) => `collection:${slugify(collName[id] || id)}`);
      const tags = [...new Set([...(note.tags || []), ...collTags])];

      notePos[parent.path] = (notePos[parent.path] || 0) + 1;
      const doc = {
        user_id: userId, type: "note",
        title: note.title || "Untitled", slug,
        parent_id: parent.id, ancestors: [...parent.ancestors, parent.id],
        depth: parent.depth + 1, path, position: notePos[parent.path],
        content: note.content || "", tags,
        links: [], // filled in pass 2
        status: "learning",
        is_favorite: !!note.is_favorite, is_pinned: !!note.is_pinned,
        is_archived: !!note.is_archived, is_public: !!note.is_public,
        share_token: note.share_token || null,
        images: note.images || [],
        reminder_date: note.reminder_date || null,
        legacy_note_id: legacyId,
        created_at: note.created_at || now(), updated_at: note.updated_at || now(),
      };
      if (COMMIT) {
        const r = await nodes.insertOne(doc);
        legacyToNew[legacyId] = String(r.insertedId);
      } else {
        legacyToNew[legacyId] = `dry:${path}`;
      }
      created++;
    }

    // 5. remap links (linked_notes → new node ids)
    if (COMMIT) {
      for (const note of userNotes) {
        const links = (note.linked_notes || []).map((id) => legacyToNew[String(id)]).filter(Boolean);
        if (links.length) {
          await nodes.updateOne(
            { user_id: userId, legacy_note_id: String(note._id) },
            { $set: { links } }
          );
        }
      }
    }

    // pretty tree preview (dry-run or after commit)
    printTree(catFolder, subFolder, userNotes, log);
  }

  log(`\n${COMMIT ? "✅ Committed" : "🔍 Would create"}: ${created} nodes; skipped ${skipped} already-migrated.`);
  if (!COMMIT) log("Re-run with --commit to apply.\n");
  return { created, skipped };
}

function printTree(catFolder, subFolder, userNotes, log) {
  log("  Tree preview:");
  for (const [catName] of Object.entries(catFolder)) {
    log(`  📁 ${catName}`);
    const subs = Object.entries(subFolder).filter(([k]) => k.startsWith(`${catName}///`));
    for (const [key] of subs) {
      const subName = key.split("///")[1];
      log(`     📁 ${subName}`);
      const inSub = userNotes.filter((n) => (n.category === catName || !catFolder[n.category]) && n.subcategory === subName);
      for (const n of inSub.slice(0, 8)) log(`        📄 ${n.title || "Untitled"}`);
      if (inSub.length > 8) log(`        … +${inSub.length - 8} more`);
    }
    const direct = userNotes.filter((n) => n.category === catName && !n.subcategory);
    for (const n of direct.slice(0, 8)) log(`     📄 ${n.title || "Untitled"}`);
    if (direct.length > 8) log(`     … +${direct.length - 8} more`);
  }
}

// ---------------------------------------------------------------------------
// CLI wrapper — connects, runs migrateAll, closes.
// ---------------------------------------------------------------------------
async function cli() {
  loadEnv();
  const raw = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "secondbrain";
  if (!raw) throw new Error("MONGO_URL not set (checked .env.local / .env / process env)");

  const url = await resolveMongoUrl(raw);
  const client = new MongoClient(url);
  await client.connect();
  try {
    await migrateAll(client.db(dbName), {
      commit: process.argv.includes("--commit"),
      onlyUser: argValue("--user"),
    });
  } finally {
    await client.close();
  }
}

// Run only when invoked directly (not when imported by a test).
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  cli().catch((e) => { console.error("Migration failed:", e); process.exit(1); });
}
