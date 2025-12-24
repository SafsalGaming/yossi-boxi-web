const admin = require("firebase-admin");

function init(){
  if(admin.apps.length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if(!projectId || !clientEmail || !privateKey){
    throw new Error("Missing FIREBASE_* env vars");
  }

  privateKey = privateKey.replace(/\\n/g, "\n");

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

function db(){
  init();
  return admin.firestore();
}

function auth(){
  init();
  return admin.auth();
}

async function requireUser(event){
  const h = event.headers || {};
  const authHeader = h.authorization || h.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if(!token) throw new Error("Missing auth token");

  const decoded = await auth().verifyIdToken(token);
  return decoded;
}

module.exports = { admin, db, auth, requireUser };
