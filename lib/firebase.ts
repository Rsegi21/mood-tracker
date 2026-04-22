import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

try {
  // Solo inicializa Firebase si se han configurado valores válidos
  if (firebaseConfig.projectId && firebaseConfig.projectId !== "") {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig as any);
    } else {
      app = getApps()[0];
    }
    
    db = getFirestore(app);
    auth = getAuth(app);
  }
} catch (error) {
  console.error("Error al inicializar Firebase:", error);
}

export { app, db, auth };
