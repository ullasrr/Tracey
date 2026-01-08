// Matches found items against lost items and notifies owners

import { sendMatchEmail } from "@/lib/email";
import { dbAdmin } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { FCMTokenManager } from "@/lib/fcm-token-manager";

export const runtime = "nodejs";

// Calculate similarity between two embedding vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

export async function POST(req: NextRequest) {
  try {
    const { itemId } = await req.json();

    if (!itemId) {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    // Get the found item
    const foundItemDoc = await dbAdmin.collection("items").doc(itemId).get();
    if (!foundItemDoc.exists) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const foundItem = foundItemDoc.data();
    
    if (foundItem?.type !== "found") {
      return NextResponse.json({ 
        error: "Invalid item for matching - must be found item with embedding" 
      }, { status: 400 });
    }
    
    if (!foundItem.embedding || foundItem.embedding.length === 0) {
      return NextResponse.json({ 
        error: "Found item has no embedding - AI analysis may not be complete" 
      }, { status: 400 });
    }

    // Search all open lost items
    const lostItemsSnapshot = await dbAdmin
      .collection("items")
      .where("type", "==", "lost")
      .where("status", "==", "open")
      .get();

    const matches: any[] = [];
    const MATCH_THRESHOLD = 0.7; // 70% similarity threshold

    lostItemsSnapshot.forEach((doc) => {
      const lostItem = doc.data();
      
      if (!lostItem.embedding || lostItem.embedding.length === 0) {
        return;
      }

      const score = cosineSimilarity(foundItem.embedding, lostItem.embedding);

      if (score >= MATCH_THRESHOLD) {
        matches.push({ 
          id: doc.id, 
          score, 
          createdBy: lostItem.createdBy,
          category: lostItem.category,
          aiDescription: lostItem.aiDescription
        });
      }
    });

    // Send notifications for all matches
    const notificationResults = [];
    
    for (const match of matches) {
      try {
        // Step 1: Store match in Firestore FIRST
        const matchRef = await dbAdmin.collection("matches").add({
          lostItemId: match.id,
          foundItemId: itemId,
          lostItemUserId: match.createdBy,
          foundItemUserId: foundItem.createdBy,
          lostItemCategory: match.category,
          lostItemDescription: match.aiDescription,
          foundItemDescription: foundItem.aiDescription,
          similarityScore: match.score,
          status: "pending",
          notificationSent: false,
          emailSent: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          viewedAt: null,
        });

        // Step 2: Send notifications (non-blocking)
        sendNotificationsAsync(matchRef.id, match.createdBy, match.score, match.category || "item").catch(() => {
          // Notification error - will be queued for retry
        });

        notificationResults.push({
          matchId: matchRef.id,
          userId: match.createdBy,
          score: match.score,
          status: "match_created",
        });
      } catch (err) {
        // Match processing error - continue with other matches
      }
    }

    const result = { 
      success: true, 
      matchCount: matches.length,
      notificationsSent: notificationResults.length,
      results: notificationResults
    };
    
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ 
      error: "Auto-match failed", 
      details: err.message 
    }, { status: 500 });
  }
}

// Async notification sending function
async function sendNotificationsAsync(
  matchId: string,
  userId: string,
  score: number,
  itemCategory: string
) {
  try {
    const userDoc = await dbAdmin.collection("users").doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      return;
    }

    let emailSent = false;
    let notificationSent = false;

    // Check notification preferences
    const prefs = userData.notificationPreferences || {};
    const emailEnabled = prefs.emailEnabled !== false; // Default true
    const pushEnabled = prefs.pushEnabled !== false; // Default true
    const minScore = prefs.minMatchScore || 0.7;

    // Skip if score below user's threshold
    if (score < minScore) {
      return;
    }

    // Send email
    if (emailEnabled && userData.email) {
      try {
        await sendMatchEmail(userData.email, score, matchId, itemCategory);
        emailSent = true;
      } catch (err) {
        // Add to retry queue
        await addToNotificationQueue(matchId, userId, "email");
      }
    }

    // Send FCM
    if (pushEnabled) {
      try {
        const fcmResult = await FCMTokenManager.sendToUser(userId, {
          title: "Item Match Found!",
          body: `We found a ${(score * 100).toFixed(0)}% match for your lost ${itemCategory}`,
          data: {
            matchId: matchId,
            type: "match_found",
            action: "view_match",
            score: score.toString(),
            timestamp: Date.now().toString(),
          },
        });

        notificationSent = fcmResult.success > 0;

        if (fcmResult.failed > 0) {
          // Add to retry queue
          await addToNotificationQueue(matchId, userId, "fcm");
        }
      } catch (err) {
        await addToNotificationQueue(matchId, userId, "fcm");
      }
    }

    // Update match with notification status
    await dbAdmin.collection("matches").doc(matchId).update({
      notificationSent,
      emailSent,
      lastNotificationAttempt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // Fatal error - notification failed
  }
}

// Add failed notification to retry queue
async function addToNotificationQueue(
  matchId: string,
  userId: string,
  type: "email" | "fcm"
) {
  try {
    await dbAdmin.collection("notificationQueue").add({
      matchId,
      userId,
      type,
      status: "pending",
      retryCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      nextRetryAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // Failed to add to queue
  }
}


