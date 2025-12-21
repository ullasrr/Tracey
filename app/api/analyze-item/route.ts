import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import { getBlurredCloudinaryUrl } from "@/lib/cloudinary";
// REMOVED: import { doc, updateDoc } from "firebase/firestore";
// REMOVED: import { db } from "@/lib/firebase";

// ADDED: Import the Admin DB
import { dbAdmin } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { itemId, imageUrl } = await req.json();

    if (!itemId || !imageUrl) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // 1. Fetch image
    const imageRes = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    const base64ImageData = Buffer.from(imageRes.data).toString("base64");
    const mimeType = imageRes.headers["content-type"] || "image/jpeg";

    // 2. Call Gemini
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Or "gemini-1.5-flash"
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64ImageData,
              },
            },
            {
              text: `Analyze this image. Return ONLY a JSON object.
              {
                "description": "string",
                "category": "string",
                "colors": ["string"],
                "containsSensitiveInfo": boolean
              }`
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    // 3. Parse Response
    const responseText = result.text || "{}";
    
    let analysis;
    try {
        const cleaned = responseText.replace(/```json|```/gi, "").trim();
        analysis = JSON.parse(cleaned);
    } catch (e) {
        console.warn("JSON parse failed, using fallback.");
        analysis = { 
            description: "AI Analysis Failed", 
            category: "Unknown", 
            colors: [], 
            containsSensitiveInfo: false 
        };
    }
    const embeddingResponse = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: `${analysis.description}. Category: ${analysis.category}. Colors: ${analysis.colors.join(", ")}`
    });

    const embedding = embeddingResponse.embeddings?.[0]?.values || [];

    // 4. Update Firestore (USING ADMIN SDK)
    // Admin SDK Syntax: db.collection("name").doc("id").update({...})
    // This bypasses security rules because it uses the service account key.
    const updateData: any = {
        aiDescription: analysis.description,
        category: analysis.category,
        colorTags: analysis.colors,
        containsSensitiveInfo: analysis.containsSensitiveInfo,
        embedding,
    };

    // If sensitive info detected → generate blurred image
    if (analysis.containsSensitiveInfo) {
    const blurredUrl = getBlurredCloudinaryUrl(imageUrl);
    updateData.blurredImages = [blurredUrl];
    }

    await dbAdmin.collection("items").doc(itemId).update(updateData);

    return NextResponse.json({ success: true, data: analysis });

  } catch (err: any) {
    console.error("Analysis Error:", err);
    return NextResponse.json(
      { error: "Analysis failed", details: err.message },
      { status: 500 }
    );
  }
}