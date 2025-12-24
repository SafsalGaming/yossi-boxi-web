import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

const cfg = window.__FIREBASE_CONFIG__;
if(!cfg || !cfg.apiKey) throw new Error("Missing Firebase config: js/firebase-config.js");

const app = initializeApp(cfg);
export const auth = getAuth(app);

export async function initAuthPersistence(){
  await setPersistence(auth, browserLocalPersistence);
}

export async function register(email, password){
  return await createUserWithEmailAndPassword(auth, email, password);
}

export async function login(email, password){
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function logout(){
  await signOut(auth);
}

export async function getToken(){
  const u = auth.currentUser;
  if(!u) return "";
  return await u.getIdToken();
}
