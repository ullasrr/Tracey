// Handles failed notification retries with exponential backoff

import { dbAdmin } from "./firebase-admin";
import { FCMTokenManager } from "./fcm-token-manager";
import { sendMatchEmail } from "./email";
import admin from "firebase-admin";

interface QueueItem {
  id: string;
  matchId: string;
  userId: string;
  type: "email" | "fcm";
  status: "pending" | "processing" | "completed" | "failed";
  retryCount: number;
  createdAt: admin.firestore.Timestamp;
  nextRetryAt: admin.firestore.Timestamp;
  lastError?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [60000, 300000, 900000]; // 1min, 5min, 15min

export class NotificationQueueProcessor {
  private static isProcessing = false;

  // Process pending notifications with exponential backoff
  static async processQueue() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const now = admin.firestore.Timestamp.now();

      // Get pending items ready for retry
      const queueSnapshot = await dbAdmin
        .collection("notificationQueue")
        .where("status", "==", "pending")
        .where("nextRetryAt", "<=", now)
        .where("retryCount", "<", MAX_RETRIES)
        .limit(10)
        .get();

      for (const docSnap of queueSnapshot.docs) {
        const item = { id: docSnap.id, ...docSnap.data() } as QueueItem;
        await this.processItem(item);
      }
    } catch (error) {
      // Queue processing error - will retry on next run
    } finally {
      this.isProcessing = false;
    }
  }

  // Process a single queue item
  private static async processItem(item: QueueItem) {
    try {
      // Mark as processing
      await dbAdmin.collection("notificationQueue").doc(item.id).update({
        status: "processing",
      });

      // Get match details
      const matchDoc = await dbAdmin.collection("matches").doc(item.matchId).get();
      if (!matchDoc.exists) {
        await this.markFailed(item.id, "Match not found");
        return;
      }

      const matchData = matchDoc.data();
      if (!matchData) {
        await this.markFailed(item.id, "Match data empty");
        return;
      }

      // Get user data
      const userDoc = await dbAdmin.collection("users").doc(item.userId).get();
      if (!userDoc.exists) {
        await this.markFailed(item.id, "User not found");
        return;
      }

      const userData = userDoc.data();
      if (!userData) {
        await this.markFailed(item.id, "User data empty");
        return;
      }

      // Send notification based on type
      let success = false;

      if (item.type === "email") {
        if (userData.email) {
          try {
            await sendMatchEmail(
              userData.email,
              matchData.similarityScore,
              item.matchId,
              matchData.lostItemCategory
            );
            success = true;
          } catch (error: any) {
            // Email failed - will retry
          }
        }
      } else if (item.type === "fcm") {
        try {
          const result = await FCMTokenManager.sendToUser(item.userId, {
            title: "Item Match Found!",
            body: `We found a ${(matchData.similarityScore * 100).toFixed(0)}% match for your lost ${matchData.lostItemCategory || "item"}`,
            data: {
              matchId: item.matchId,
              type: "match_found",
              action: "view_match",
              score: matchData.similarityScore.toString(),
              timestamp: Date.now().toString(),
            },
          });

          success = result.success > 0;
        } catch (error: any) {
          // FCM failed - will retry
        }
      }

      if (success) {
        // Mark as completed
        await dbAdmin.collection("notificationQueue").doc(item.id).update({
          status: "completed",
        });

        // Update match
        const updateData: any = {};
        if (item.type === "email") updateData.emailSent = true;
        if (item.type === "fcm") updateData.notificationSent = true;

        await dbAdmin.collection("matches").doc(item.matchId).update(updateData);

      } else {
        // Schedule retry
        await this.scheduleRetry(item);
      }
    } catch (error: any) {
      await this.scheduleRetry(item, error.message);
    }
  }

  // Schedule retry with backoff delay
  private static async scheduleRetry(item: QueueItem, errorMessage?: string) {
    const newRetryCount = item.retryCount + 1;

    if (newRetryCount >= MAX_RETRIES) {
      await this.markFailed(item.id, errorMessage || "Max retries exceeded");
      return;
    }

    const delay = RETRY_DELAYS[newRetryCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
    const nextRetryAt = new Date(Date.now() + delay);

    await dbAdmin.collection("notificationQueue").doc(item.id).update({
      status: "pending",
      retryCount: newRetryCount,
      nextRetryAt: admin.firestore.Timestamp.fromDate(nextRetryAt),
      lastError: errorMessage || "Unknown error",
    });
  }

  // Mark item as permanently failed
  private static async markFailed(itemId: string, reason: string) {
    await dbAdmin.collection("notificationQueue").doc(itemId).update({
      status: "failed",
      lastError: reason,
    });
  }

  // Remove old completed/failed items (7+ days)
  static async cleanup() {
    try {
      const sevenDaysAgo = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );

      const oldItems = await dbAdmin
        .collection("notificationQueue")
        .where("status", "in", ["completed", "failed"])
        .where("createdAt", "<=", sevenDaysAgo)
        .get();

      const batch = dbAdmin.batch();
      oldItems.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error) {
      // Cleanup error - non-critical
    }
  }
}
