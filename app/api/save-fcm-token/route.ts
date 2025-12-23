import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";
import admin from "firebase-admin";

export const runtime = "nodejs";

// API route to save FCM token for the authenticated user
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.replace("Bearer ", "");
    const decoded = await admin.auth().verifyIdToken(idToken);

    const { fcmToken } = await req.json();
    if (!fcmToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    await dbAdmin.collection("users").doc(decoded.uid).set(
      { fcmToken },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("FCM save error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
