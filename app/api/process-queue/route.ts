import { NextRequest, NextResponse } from "next/server";
import { NotificationQueueProcessor } from "@/lib/notification-queue";

export const runtime = "nodejs";

// This endpoint can be called by a cron job or manually to process the queue
export async function POST(req: NextRequest) {
  try {
    // Optional: Verify cron secret for security
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await NotificationQueueProcessor.processQueue();

    return NextResponse.json({ 
      success: true, 
      message: "Queue processed successfully" 
    });
  } catch (error: any) {
    console.error("[Cron] Error:", error);
    return NextResponse.json({ 
      error: "Queue processing failed", 
      details: error.message 
    }, { status: 500 });
  }
}

// Also allow GET for manual testing
export async function GET(req: NextRequest) {
  return POST(req);
}
