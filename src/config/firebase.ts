import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA8Yj1Z1Mpv2lyt9SRxJ_w4U04BXt8hajk",
  authDomain: "paritalk.firebaseapp.com",
  databaseURL: "https://paritalk-default-rtdb.firebaseio.com",
  projectId: "paritalk",
  storageBucket: "paritalk.firebasestorage.app",
  messagingSenderId: "441945619664",
  appId: "1:441945619664:web:045e0c872e67e0eb9fb2d5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);
