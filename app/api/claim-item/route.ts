import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { itemId, userId } = await req.json();

    if (!itemId || !userId) {
      return NextResponse.json({ error: "Missing itemId or userId" }, { status: 400 });
    }

    // Get the found item
    const itemDoc = await dbAdmin.collection("items").doc(itemId).get();
    if (!itemDoc.exists) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const itemData = itemDoc.data();
    if (!itemData) {
      return NextResponse.json({ error: "Item data not found" }, { status: 404 });
    }

    // Check if user is trying to claim their own item
    if (itemData.createdBy === userId) {
      return NextResponse.json({ error: "You cannot claim your own item" }, { status: 400 });
    }

    // Check if this item was already claimed by this user
    const existingClaim = await dbAdmin.collection("matches")
      .where("foundItemId", "==", itemId)
      .where("lostItemUserId", "==", userId)
      .get();

    if (!existingClaim.empty) {
      // Return the existing match ID
      return NextResponse.json({ 
        success: true, 
        matchId: existingClaim.docs[0].id,
        message: "You have already claimed this item" 
      });
    }

    // Create a match document
    const matchRef = await dbAdmin.collection("matches").add({
      lostItemId: null,
      foundItemId: itemId,
      lostItemUserId: userId,
      foundItemUserId: itemData.createdBy,
      lostItemCategory: itemData.category || "Unknown",
      lostItemDescription: "Claimed from search",
      foundItemDescription: itemData.aiDescription || "",
      similarityScore: 1.0,
      status: "claimed",
      notificationSent: false,
      emailSent: false,
      createdAt: new Date(),
      viewedAt: new Date(),
      claimedFromSearch: true,
    });

    return NextResponse.json({ 
      success: true, 
      matchId: matchRef.id,
      message: "Item claimed successfully" 
    });

  } catch (error: any) {
    console.error("Claim item error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to claim item" 
    }, { status: 500 });
  }
}
