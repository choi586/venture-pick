import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { FIREBASE_CONFIG } from "./firebase-config.js";

let initializationError = null;

export function firebaseConfigured() {
  return ["apiKey", "projectId", "authDomain", "appId"].every((key) =>
    typeof FIREBASE_CONFIG[key] === "string" && FIREBASE_CONFIG[key].trim() && !FIREBASE_CONFIG[key].startsWith("PASTE_")
  ) && !initializationError;
}

let app = null;
let db = null;
let auth = null;

if (firebaseConfigured()) {
  try {
    app = initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    initializationError = error;
    console.error("Firebase 초기화 실패", error);
  }
}

export { app, db, auth };
