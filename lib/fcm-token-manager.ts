import { dbAdmin } from "./firebase-admin";
import admin from "firebase-admin";

interface TokenData {
  token: string;
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
  };
  createdAt: admin.firestore.Timestamp;
  lastUsedAt: admin.firestore.Timestamp;
  expiresAt: admin.firestore.Timestamp;
}

const TOKEN_EXPIRY_DAYS = 60; // Token considered expired after 60 days
const CLEANUP_DAYS = 90; // Delete tokens older than 90 days

export class FCMTokenManager {
  /**
   * Register a new FCM token for a user
   */
  static async registerToken(
    userId: string,
    token: string,
    deviceInfo?: { userAgent?: string; platform?: string }
  ): Promise<void> {
    try {
      const now = admin.firestore.Timestamp.now();
      const expiresAt = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      );

      // Check if token already exists
      const existingTokens = await dbAdmin
        .collection("users")
        .doc(userId)
        .collection("fcmTokens")
        .where("token", "==", token)
        .limit(1)
        .get();

      if (!existingTokens.empty) {
        // Update existing token
        const tokenDoc = existingTokens.docs[0];
        await tokenDoc.ref.update({
          lastUsedAt: now,
          expiresAt: expiresAt,
          deviceInfo: deviceInfo || tokenDoc.data().deviceInfo,
        });
        console.log(`[FCM] Updated existing token for user ${userId}`);
      } else {
        // Add new token
        await dbAdmin
          .collection("users")
          .doc(userId)
          .collection("fcmTokens")
          .add({
            token,
            deviceInfo,
            createdAt: now,
            lastUsedAt: now,
            expiresAt: expiresAt,
          });
        console.log(`[FCM] Registered new token for user ${userId}`);
      }
    } catch (error) {
      console.error(`[FCM] Error registering token:`, error);
      throw error;
    }
  }

  /**
   * Get all valid (non-expired) tokens for a user
   */
  static async getValidTokens(userId: string): Promise<string[]> {
    try {
      const now = admin.firestore.Timestamp.now();

      const tokensSnapshot = await dbAdmin
        .collection("users")
        .doc(userId)
        .collection("fcmTokens")
        .where("expiresAt", ">", now)
        .get();

      return tokensSnapshot.docs.map((doc) => doc.data().token);
    } catch (error) {
      console.error(`[FCM] Error getting tokens:`, error);
      return [];
    }
  }

  /**
   * Send notification to all devices of a user
   */
  static async sendToUser(
    userId: string,
    notification: {
      title: string;
      body: string;
      data?: { [key: string]: string };
    }
  ): Promise<{ success: number; failed: number }> {
    try {
      const tokens = await this.getValidTokens(userId);

      if (tokens.length === 0) {
        console.log(`[FCM] No valid tokens for user ${userId}`);
        return { success: 0, failed: 0 };
      }

      const messages = tokens.map((token) => ({
        token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
      }));

      const result = await admin.messaging().sendEach(messages);

      console.log(
        `[FCM] Sent to user ${userId}: ${result.successCount} success, ${result.failureCount} failed`
      );

      // Remove invalid tokens
      const invalidTokens: string[] = [];
      result.responses.forEach((response, idx) => {
        if (!response.success) {
          const error = response.error;
          if (
            error?.code === "messaging/invalid-registration-token" ||
            error?.code === "messaging/registration-token-not-registered"
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      // Delete invalid tokens
      if (invalidTokens.length > 0) {
        await this.removeTokens(userId, invalidTokens);
      }

      return {
        success: result.successCount,
        failed: result.failureCount,
      };
    } catch (error) {
      console.error(`[FCM] Error sending to user:`, error);
      return { success: 0, failed: tokens.length || 0 };
    }
  }

  /**
   * Remove specific tokens for a user
   */
  static async removeTokens(userId: string, tokens: string[]): Promise<void> {
    try {
      const batch = dbAdmin.batch();

      for (const token of tokens) {
        const tokenDocs = await dbAdmin
          .collection("users")
          .doc(userId)
          .collection("fcmTokens")
          .where("token", "==", token)
          .get();

        tokenDocs.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
      }

      await batch.commit();
      console.log(`[FCM] Removed ${tokens.length} invalid tokens for user ${userId}`);
    } catch (error) {
      console.error(`[FCM] Error removing tokens:`, error);
    }
  }

  /**
   * Clean up old/expired tokens (should be called periodically)
   */
  static async cleanupOldTokens(): Promise<void> {
    try {
      const cleanupDate = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000)
      );

      // This needs to be run for all users - best called via cloud function
      console.log("[FCM] Cleanup should be implemented as a scheduled function");
    } catch (error) {
      console.error("[FCM] Error during cleanup:", error);
    }
  }
}
