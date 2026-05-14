import admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
});

const adminDb = admin.firestore();
const adminAuth = admin.auth();

async function checkUIDs() {
  const users = await adminAuth.listUsers();
  console.log("Usuarios en Firebase Auth:");
  for (const u of users.users) {
    console.log(`- ${u.email}: ${u.uid}`);
  }
  
  const docs = await adminDb.collection('users').get();
  console.log("\nUsuarios en Firestore (users collection):");
  docs.forEach(d => {
    console.log(`- ${d.id}: ${d.data().email}`);
  });
}
checkUIDs();
