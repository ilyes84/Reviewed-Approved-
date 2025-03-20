// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    getFirestore, 
    enableIndexedDbPersistence,
    CACHE_SIZE_UNLIMITED
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC11wuZ5zOBynfXt0YyZPACMyT4bt3gYaA",
    authDomain: "linktree-775a7.firebaseapp.com",
    projectId: "linktree-775a7",
    storageBucket: "linktree-775a7.firebasestorage.app",
    messagingSenderId: "1031829625878",
    appId: "1:1031829625878:web:4630dfbc086a9bb6802937"
};

// ImgBB API Key
const imgbbApiKey = "758bf78669241fab46096d7cb679bb2e";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// تحسين أداء Firestore باستخدام التخزين المؤقت
// استخدام enableIndexedDbPersistence بدلاً من settings
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled
      // in one tab at a a time.
      console.log('Persistence failed: Multiple tabs open');
    } else if (err.code == 'unimplemented') {
      // The current browser does not support all of the
      // features required to enable persistence
      console.log('Persistence not supported by this browser');
    }
  });

// Export everything needed
export { 
    app, 
    auth, 
    db,
    imgbbApiKey  // إضافة تصدير مفتاح ImgBB
}; 