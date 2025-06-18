import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDRKc-pQiX638Yyxs7yM0J0X15SEqYNxA8",
  authDomain: "paritalk2.firebaseapp.com",
  databaseURL: "https://paritalk2-default-rtdb.firebaseio.com",
  projectId: "paritalk2",
  storageBucket: "paritalk2.firebasestorage.app",
  messagingSenderId: "397674011717",
  appId: "1:397674011717:web:ea38dd11091027cd04972c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);