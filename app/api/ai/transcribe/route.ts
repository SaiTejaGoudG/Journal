import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import OpenAI from "openai";
import { toFile } from "openai";

export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  // Prefer Groq (whisper-large-v3) → fall back to OpenAI (whisper-1)
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!groqKey && !openaiKey)
    return NextResponse.json(
      { detail: "AI not configured — set GROQ_API_KEY or OPENAI_API_KEY" },
      { status: 500 }
    );

  const client = groqKey
    ? new OpenAI({ apiKey: groqKey, baseURL: "https://api.groq.com/openai/v1" })
    : new OpenAI({ apiKey: openaiKey! });

  const whisperModel = groqKey ? "whisper-large-v3" : "whisper-1";

  const formData = await req.formData();
  const audio = formData.get("audio") as File | null;
  if (!audio) return NextResponse.json({ detail: "No audio file provided" }, { status: 400 });

  const audioFile = await toFile(audio, audio.name || "audio.webm", { type: audio.type || "audio/webm" });
  const transcription = await client.audio.transcriptions.create({
    file: audioFile,
    model: whisperModel,
    response_format: "json",
  });
  return NextResponse.json({ text: transcription.text });
}
