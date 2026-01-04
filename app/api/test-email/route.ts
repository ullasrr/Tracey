import { NextRequest, NextResponse } from "next/server";
import { sendMatchEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check environment variables
    const envCheck = {
      hasResendKey: !!process.env.RESEND_API_KEY,
      resendKeyLength: process.env.RESEND_API_KEY?.length || 0,
      emailFrom: process.env.EMAIL_FROM || "NOT SET",
      appUrl: process.env.NEXT_PUBLIC_APP_URL || "NOT SET",
    };

    console.log("[Test Email] Environment check:", envCheck);

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "RESEND_API_KEY not configured",
        envCheck,
      }, { status: 500 });
    }

    if (!process.env.EMAIL_FROM) {
      return NextResponse.json({
        success: false,
        error: "EMAIL_FROM not configured. Use 'onboarding@resend.dev' for testing.",
        envCheck,
      }, { status: 500 });
    }

    // Try to send test email
    const result = await sendMatchEmail(
      email,
      0.95, // 95% match score
      "test-match-id",
      "Test Item"
    );

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully",
      result,
      envCheck,
    });
  } catch (error: any) {
    console.error("[Test Email] Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        name: error.name,
        statusCode: error.statusCode,
      },
    }, { status: 500 });
  }
}
