// Firebase configuration and initialization
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { getFirestore, Firestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCoM-QpxBOro8GJgW_x6vKUVwyDsj6tY4Y",
  authDomain: "rtcentral-7b3a4.firebaseapp.com",
  projectId: "rtcentral-7b3a4",
  storageBucket: "rtcentral-7b3a4.firebasestorage.app",
  messagingSenderId: "792557428774",
  appId: "1:792557428774:web:f703162ed1083fd79306e7",
  measurementId: "G-0VESFCSEMY"
};

// Initialize Firebase
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Firebase Authentication and get a reference to the service
export const auth: Auth = getAuth(app);

// Initialize Firestore
export const db: Firestore = getFirestore(app);

// Initialize Analytics (only in browser)
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export default app;





