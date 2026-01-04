// Manages FCM tokens and sends push notifications to users

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
  // Register or update FCM token for a user
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
      }
    } catch (error) {
      throw error;
    }
  }

  // Get all non-expired tokens for a user
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
      return [];
    }
  }

  // Send push notification to all user devices
  static async sendToUser(
    userId: string,
    notification: {
      title: string;
      body: string;
      data?: { [key: string]: string };
    }
  ): Promise<{ success: number; failed: number }> {
    let tokens: string[] = [];
    try {
      tokens = await this.getValidTokens(userId);

      if (tokens.length === 0) {
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
      return { success: 0, failed: tokens.length || 0 };
    }
  }

  // Remove specific tokens from user
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
    } catch (error) {
      // Failed to remove invalid tokens
    }
  }

  // Clean up expired tokens (run periodically)
  static async cleanupOldTokens(): Promise<void> {
    try {
      const cleanupDate = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000)
      );

      // This needs to be run for all users - best called via cloud function
    } catch (error) {
      // Cleanup error
    }
  }
}
