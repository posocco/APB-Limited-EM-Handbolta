import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCLVXfZPQiYtFQLlAn0yvzUPg6rwzhzlCo",
    authDomain: "tipp-kerfi.firebaseapp.com",
    projectId: "tipp-kerfi",
    storageBucket: "tipp-kerfi.firebasestorage.app",
    messagingSenderId: "412668084664",
    appId: "1:412668084664:web:adbe312831b9cc305e4f4d"
  };

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);