import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENIA;


if (!OPENAI_API_KEY) {
  console.warn(process.env.OPENIA)
  console.warn("OPENIA env var is not set. /api/patient-query will return 500.");
}

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI API key not configured" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const query: string = body?.query ?? "";

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Missing 'query' in request body" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an assistant that converts free-text clinical search queries into simple JSON filters for a patient-explorer UI.

Return ONLY a JSON object with this exact structure:

{
  "filters": {
    "selectedStudy": string | null,
    "selectedStatus": "Eligible" | "To review" | "Not eligible" | null,
    "ageMin": number | null,
    "ageMax": number | null,
    "diagnosis": "Alzheimer" | "MCI" | "No diagnosis" | null,
    "symptom": "Memory loss" | "Difficulty concentrating" | "Difficulty finding words" | "Mood changes" | null,
    "showHospitals": boolean | null
  },
  "explanation": string
}

RULES:
- Interpret queries written in Spanish or English.
- Infer filters conservatively.
- If the query does not clearly specify a filter, set it to null.
- If uncertain, choose null.
- Do NOT add properties, remove properties, or modify allowed values.
- Do NOT include markdown, comments, or text outside the JSON object.
- "explanation" must be a brief sentence (max 1, 2 lines) describing how the filters were inferred.

Your output must always be a valid JSON object following this schema exactly.`;

    const payload = {
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      temperature: 1,
    } as const;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("OpenAI error", response.status, text);
      return NextResponse.json(
        { error: "LLM request failed" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "Empty LLM response" },
        { status: 502 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse LLM JSON", content);
      return NextResponse.json(
        { error: "Invalid JSON from LLM" },
        { status: 502 }
      );
    }

    const filters = parsed?.filters ?? {};
    const explanation: string = parsed?.explanation ?? "";

    return NextResponse.json({ filters, explanation });
  } catch (error) {
    console.error("/api/patient-query error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
