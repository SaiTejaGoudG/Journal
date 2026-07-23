import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import OpenAI from "openai";
import { MARKTEXT_SYSTEM_PROMPT } from "@/lib/marktextPrompt";

/** Returns an OpenAI-compatible client + model name.
 *  Priority: GROQ_API_KEY → OPENAI_API_KEY */
function getAIClient() {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (groqKey) {
    return {
      client: new OpenAI({
        apiKey: groqKey,
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    };
  }
  if (openaiKey) {
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: "gpt-4o-mini",
    };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const ai = getAIClient();
  if (!ai)
    return NextResponse.json(
      { detail: "AI not configured — set GROQ_API_KEY or OPENAI_API_KEY" },
      { status: 500 }
    );

  const { content, action } = await req.json();
  const prompts: Record<string, string> = {
    summarize: `Summarize the following note in 2-3 concise sentences:\n\n${content}`,
    expand: `Expand and elaborate on the following note, adding more detail and context:\n\n${content}`,
    caption: `Convert the following note into an engaging social media caption (suitable for LinkedIn/Twitter):\n\n${content}`,
  };

  const prompt = prompts[action];
  if (!prompt)
    return NextResponse.json({ detail: "Invalid action. Use: summarize, expand, caption" }, { status: 400 });

  const completion = await ai.client.chat.completions.create({
    model: ai.model,
    messages: [
      { role: "system", content: MARKTEXT_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  return NextResponse.json({ result: completion.choices[0].message.content });
}
