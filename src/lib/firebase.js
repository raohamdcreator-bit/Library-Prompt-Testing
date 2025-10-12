// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";          // 👈 you need this import
import { getFirestore } from "firebase/firestore"; // 👈 and this one for db
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCOav-SjCq72u9HO3iRz-gc2Mb8fC8_hxs",
  authDomain: "prompt-library-21b7f.firebaseapp.com",
  projectId: "prompt-library-21b7f",
  storageBucket: "prompt-library-21b7f.firebasestorage.app",
  messagingSenderId: "400039035923",
  appId: "1:400039035923:web:1ef6e898e966a40bdbebe6",
  measurementId: "G-W4KF3TQH27"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);   // 🔥 must be exported
export const db = getFirestore(app);