import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export const createTestItem = async (uid: string) => {
  await addDoc(collection(db, "items"), {
    type: "found",
    status: "open",

    images: [],
    blurredImages: [],

    aiDescription: "",
    category: "unknown",
    colorTags: [],

    embedding: [],

    location: { lat: 0, lng: 0 },

    createdAt: serverTimestamp(),
    createdBy: uid,
  });
};
