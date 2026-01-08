// Matches lost items against found items and notifies both parties

import { dbAdmin } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { FCMTokenManager } from "@/lib/fcm-token-manager";

export const runtime = "nodejs";

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

    // Get the lost item
    const lostItemDoc = await dbAdmin.collection("items").doc(itemId).get();
    if (!lostItemDoc.exists) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const lostItem = lostItemDoc.data();
    
    if (lostItem?.type !== "lost") {
      return NextResponse.json({ 
        error: "Invalid item for matching - must be lost item with embedding" 
      }, { status: 400 });
    }
    
    if (!lostItem.embedding || lostItem.embedding.length === 0) {
      // Return success but with 0 matches - don't block the request
      return NextResponse.json({
        success: true,
        matchCount: 0,
        message: "Item created, matching will occur after AI analysis completes"
      });
    }

    // Search all open FOUND items
    const foundItemsSnapshot = await dbAdmin
      .collection("items")
      .where("type", "==", "found")
      .where("status", "==", "open")
      .get();

    const matches: any[] = [];
    const MATCH_THRESHOLD = 0.7; // 70% similarity threshold

    foundItemsSnapshot.forEach((doc) => {
      const foundItem = doc.data();
      
      if (!foundItem.embedding || foundItem.embedding.length === 0) {
        return;
      }

      const score = cosineSimilarity(lostItem.embedding, foundItem.embedding);

      if (score >= MATCH_THRESHOLD) {
        matches.push({ 
          id: doc.id, 
          score, 
          createdBy: foundItem.createdBy,
          category: foundItem.category,
          aiDescription: foundItem.aiDescription
        });
      }
    });

    // Send notifications for all matches
    const notificationResults = [];
    
    for (const match of matches) {
      try {
        // Step 1: Store match in Firestore FIRST
        const matchRef = await dbAdmin.collection("matches").add({
          lostItemId: itemId,
          foundItemId: match.id,
          lostItemUserId: lostItem.createdBy,
          foundItemUserId: match.createdBy,
          lostItemCategory: lostItem.category,
          lostItemDescription: lostItem.aiDescription,
          foundItemDescription: match.aiDescription,
          similarityScore: match.score,
          status: "pending",
          notificationSent: false,
          emailSent: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          viewedAt: null,
        });

        // Step 2: Send notifications to BOTH users and update match record
        let notificationSentToOwner = false;
        let notificationSentToFinder = false;

        try {
          // Notify the LOST item owner
          notificationSentToOwner = await sendNotificationsToLostOwner(
            matchRef.id,
            lostItem.createdBy,
            match.score,
            lostItem.category || "item"
          );

          // Notify the FINDER
          notificationSentToFinder = await sendNotificationsToFinder(
            matchRef.id,
            match.createdBy,
            match.score,
            lostItem.category || "item"
          );

          // Update match with notification status
          const notificationSent = notificationSentToOwner || notificationSentToFinder;
          await dbAdmin.collection("matches").doc(matchRef.id).update({
            notificationSent,
            lastNotificationAttempt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (notifErr) {
          // Notification error - match still created
        }

        notificationResults.push({
          matchId: matchRef.id,
          lostUserId: lostItem.createdBy,
          foundUserId: match.createdBy,
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

// Notify the lost item owner
async function sendNotificationsToLostOwner(
  matchId: string,
  userId: string,
  score: number,
  itemCategory: string
) {
  try {
    const userDoc = await dbAdmin.collection("users").doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      return false;
    }

    const prefs = userData.notificationPreferences || {};
    const pushEnabled = prefs.pushEnabled !== false; // Default true (matches auto-match behavior)

    if (pushEnabled) {
      try {
        const result = await FCMTokenManager.sendToUser(userId, {
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
        
        // Add to retry queue if failed
        if (result.failed > 0 || result.success === 0) {
          await addToNotificationQueue(matchId, userId, "fcm");
        }
        
        return result.success > 0;
      } catch (err) {
        // Add to retry queue on error
        await addToNotificationQueue(matchId, userId, "fcm");
        return false;
      }
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}

// Notify the finder that someone is looking for their found item
async function sendNotificationsToFinder(
  matchId: string,
  userId: string,
  score: number,
  itemCategory: string
) {
  try {
    const userDoc = await dbAdmin.collection("users").doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      return false;
    }

    const prefs = userData.notificationPreferences || {};
    const pushEnabled = prefs.pushEnabled !== false; // Default true (matches auto-match behavior)

    if (pushEnabled) {
      try {
        const result = await FCMTokenManager.sendToUser(userId, {
          title: "Someone is Looking for Your Found Item!",
          body: `Your found ${itemCategory} matches a lost item report (${(score * 100).toFixed(0)}% match)`,
          data: {
            matchId: matchId,
            type: "match_found",
            action: "view_match",
            score: score.toString(),
            timestamp: Date.now().toString(),
          },
        });
        
        // Add to retry queue if failed
        if (result.failed > 0 || result.success === 0) {
          await addToNotificationQueue(matchId, userId, "fcm");
        }
        
        return result.success > 0;
      } catch (err) {
        // Add to retry queue on error
        await addToNotificationQueue(matchId, userId, "fcm");
        return false;
      }
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}
