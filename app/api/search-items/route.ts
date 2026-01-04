import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { dbAdmin } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const SIMILARITY_THRESHOLD = 0.50;

function cosineSimilarity(a: number[], b: number[]) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return dot / (magA * magB);
}

export async function POST(req: NextRequest) {
  try {
    const { query, searchImage } = await req.json();

    if (!query && !searchImage) {
      return NextResponse.json({ results: [] });
    }

    let textToSearch = query;

    // 1. If Image is provided, convert it to text description first
    if (searchImage) {
        // Clean base64 header if present
        const cleanBase64 = searchImage.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
        
        const visionResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    parts: [
                        { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
                        { text: "Describe this object in detail to help find it in a database of lost items. Include color, category, and distinct features." }
                    ]
                }
            ]
        });
        
        const description = visionResponse.text || "";
        
        // If user provided text AND image, combine them
        textToSearch = query ? `${query} ${description}` : description;
    }

    // 2. Generate Embedding for the text
    const embedResponse = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: [{ parts: [{ text: textToSearch }] }],
    });

    const queryEmbedding = embedResponse.embeddings?.[0]?.values || [];

    // 3. Search Database - only search "open" items (not claimed or dismissed)
    const snapshot = await dbAdmin.collection("items")
      .where("status", "==", "open")
      .get();
    const results: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.embedding) return;

      const score = cosineSimilarity(queryEmbedding, data.embedding);

      if (score >= SIMILARITY_THRESHOLD) {
        results.push({
            id: doc.id,
            score,
            ...data,
            embedding: undefined 
        });
      }
    });

    results.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      results: results.slice(0, 5), 
    });

  } catch (err: any) {
    return NextResponse.json({ error: "Search failed", details: err.message }, { status: 500 });
  }
}