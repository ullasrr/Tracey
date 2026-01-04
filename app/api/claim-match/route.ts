import { NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { matchId, userId } = await req.json();

    if (!matchId || !userId) {
      return NextResponse.json(
        { error: "matchId and userId are required" },
        { status: 400 }
      );
    }

    // Get the match
    const matchDoc = await dbAdmin.collection("matches").doc(matchId).get();
    
    if (!matchDoc.exists) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      );
    }

    const matchData = matchDoc.data();

    // Verify match data exists and user is the lost item owner
    if (!matchData || matchData.lostItemUserId !== userId) {
      return NextResponse.json(
        { error: "Only the lost item owner can claim this match" },
        { status: 403 }
      );
    }

    // Update match status to claimed
    await dbAdmin.collection("matches").doc(matchId).update({
      status: "claimed",
    });

    // Mark both items as claimed (using admin SDK bypasses security rules)
    const batch = dbAdmin.batch();
    
    const lostItemRef = dbAdmin.collection("items").doc(matchData.lostItemId);
    const foundItemRef = dbAdmin.collection("items").doc(matchData.foundItemId);
    
    batch.update(lostItemRef, { status: "claimed" });
    batch.update(foundItemRef, { status: "claimed" });
    
    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      message: "Match claimed successfully" 
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to claim match" },
      { status: 500 }
    );
  }
}
