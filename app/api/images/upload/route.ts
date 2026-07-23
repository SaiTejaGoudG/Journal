import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file || !file.type.startsWith("image/"))
    return NextResponse.json({ detail: "Only image files allowed" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ detail: "Image too large (max 5MB)" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const b64 = Buffer.from(buffer).toString("base64");
  return NextResponse.json({ url: `data:${file.type};base64,${b64}` });
}
