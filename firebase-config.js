// STS Smart School - Firebase Configuration & Initialization
// Star Tech Solutions Limited

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

// Web app Firebase configuration for Star Tech Solutions
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDJYNRKv6EUqlr8-vwah830J33QAiBaxfI",
  authDomain: "sts-smart-school.firebaseapp.com",
  projectId: "sts-smart-school",
  storageBucket: "sts-smart-school.firebasestorage.app",
  messagingSenderId: "408636339931",
  appId: "1:408636339931:web:5bb524922382aab0f87efe",
  measurementId: "G-G3XX84VNLN"
};

// Initialize Firebase Core Application
const app = initializeApp(firebaseConfig);

// Initialize Firebase Analytics (optional)
const analytics = getAnalytics(app);

// Export Authentication and Firestore database services for modular imports across app scripts
export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };