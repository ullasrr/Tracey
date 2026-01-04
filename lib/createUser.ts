import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { User } from "firebase/auth";

export const createUserIfNotExists = async (user: User) => {
  const ref = doc(db, "users", user.uid);

  // Check if user already exists
  const existingDoc = await getDoc(ref);
  
  if (existingDoc.exists()) {
    // User exists - only update basic profile info, preserve notification preferences
    await setDoc(
      ref,
      {
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        photoURL: user.photoURL,
      },
      { merge: true }
    );
  } else {
    // New user - set all defaults including notification preferences
    await setDoc(
      ref,
      {
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        photoURL: user.photoURL,
        fcmToken: "",
        notificationPreferences: {
          pushEnabled: false, // Default to OFF - prompt user on first report
          userDeclined: false, // Track if user has declined the notification prompt
        },
        createdAt: serverTimestamp(),
      }
    );
  }
};
