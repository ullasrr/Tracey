import { NextRequest, NextResponse } from "next/server";
import { FCMTokenManager } from "@/lib/fcm-token-manager";
import admin from "firebase-admin";

export const runtime = "nodejs";

// API route to register FCM token using the new token manager
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.replace("Bearer ", "");
    const decoded = await admin.auth().verifyIdToken(idToken);

    const { token, deviceInfo } = await req.json();
    
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Register token using FCMTokenManager
    await FCMTokenManager.registerToken(decoded.uid, token, deviceInfo);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ 
      error: "Failed to register token", 
      details: err.message 
    }, { status: 500 });
  }
}
