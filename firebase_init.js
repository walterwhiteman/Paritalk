// firebase_init.js

// ✅ Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDRKc-pQiX638Yyxs7yM0J0X15SEqYNxA8",
  authDomain: "paritalk2.firebaseapp.com",
  projectId: "paritalk2",
  storageBucket: "paritalk2.firebasestorage.app",
  messagingSenderId: "397674011717",
  appId: "1:397674011717:web:ea38dd11091027cd04972c"
};

// ✅ Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// ✅ Supabase configuration
const SUPABASE_URL = "https://uokpkgybjzvpngoxasnm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVva3BrZ3lianp2cG5nb3hhc25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MjE4NTcsImV4cCI6MjA2NTQ5Nzg1N30.FNv_13S3oj7fjartmY2PzKL25T3AWbMxP2KRI0rFU2E";

// ✅ Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ✅ Upload file to Supabase Storage
async function uploadFile(file) {
  const fileName = `${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage
    .from("chat-files")
    .upload(fileName, file);

  if (error) {
    console.error("Upload error:", error.message);
    return null;
  }

  const { data: publicUrlData } = await supabase
    .storage
    .from("chat-files")
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

// ✅ File upload handling
const fileInput = document.getElementById("fileInput");
if (fileInput) {
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileUrl = await uploadFile(file);
    if (fileUrl) {
      const message = {
        sender: username,
        type: "file",
        content: fileUrl,
        fileName: file.name,
        timestamp: Date.now(),
      };
      push(messagesRef, message);
    }
  });
}
