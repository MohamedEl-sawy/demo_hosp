import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// config
const firebaseConfig = {
  apiKey: "AIzaSyCA-QB0_T3Ano-0iIy7XME-opFc6MZXzRg",
  authDomain: "safeheart-2d878.firebaseapp.com",
  databaseURL: "https://safeheart-2d878-default-rtdb.firebaseio.com",
  projectId: "safeheart-2d878",
  storageBucket: "safeheart-2d878.firebasestorage.app",
  messagingSenderId: "968110391488",
  appId: "1:968110391488:web:235a04d5b59205b1076d25",
  measurementId: "G-68HTHJ0C0Q"
};


const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);


export { app, analytics, db };