import { NextRequest, NextResponse } from "next/server";
import { FCMTokenManager } from "@/lib/fcm-token-manager";
import admin from "firebase-admin";

export const runtime = "nodejs";

// Test endpoint to send notification to a user
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.replace("Bearer ", "");
    const decoded = await admin.auth().verifyIdToken(idToken);

    const { userId, title, body } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Send test notification
    const result = await FCMTokenManager.sendToUser(userId, {
      title: title || "Test Notification from Tracey",
      body: body || "This is a test notification to verify FCM is working correctly.",
      data: {
        type: "test",
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({ 
      success: true,
      result,
      message: `Sent to ${result.success} device(s), ${result.failed} failed`
    });
  } catch (err: any) {
    return NextResponse.json({ 
      error: "Failed to send test notification", 
      details: err.message 
    }, { status: 500 });
  }
}
