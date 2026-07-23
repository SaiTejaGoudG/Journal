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
  const db = await getDb();
  const note = await db.collection("notes").findOne({ _id: new ObjectId(noteId), user_id: user.id });
  if (!note) return NextResponse.json({ detail: "Note not found" }, { status: 404 });
  const d = docToDict(note)!;
  let md = `# ${d.title || "Untitled"}\n\n`;
  md += `**Category:** ${d.category || ""}  \n`;
  if (d.subcategory) md += `**Subcategory:** ${d.subcategory}  \n`;
  if (d.tags?.length) md += `**Tags:** ${d.tags.join(", ")}  \n`;
  md += `**Created:** ${(d.created_at || "").slice(0, 10)}  \n`;
  if (d.reminder_date) md += `**Reminder:** ${(d.reminder_date || "").slice(0, 10)}  \n`;
  md += `\n---\n\n${d.content || ""}`;
  return NextResponse.json({ markdown: md, filename: `${(d.title || "note").replace(/ /g, "_").slice(0, 50)}.md` });
}
