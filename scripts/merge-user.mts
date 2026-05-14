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

async function mergeUser() {
  const oldId = 'a1e410ed-af7f-414c-b39a-2e386e05057f';
  const newId = 'BmojqBSbedMIFhOlH1WMIVDiFZU2';
  
  const batch = adminDb.batch();
  
  // 1. Copy old user profile to new ID, then delete old
  const oldUserDoc = await adminDb.collection('users').doc(oldId).get();
  if (oldUserDoc.exists) {
    batch.set(adminDb.collection('users').doc(newId), oldUserDoc.data()!);
    batch.delete(adminDb.collection('users').doc(oldId));
  }

  // 2. Update projects where owner_id == oldId
  const projects = await adminDb.collection('projects').where('owner_id', '==', oldId).get();
  projects.forEach(doc => {
    batch.update(doc.ref, { owner_id: newId });
  });

  // 3. Update project members array
  const allProjects = await adminDb.collection('projects').get();
  allProjects.forEach(doc => {
    const data = doc.data();
    if (data.members && data.members.includes(oldId)) {
      const newMembers = data.members.map((id: string) => id === oldId ? newId : id);
      batch.update(doc.ref, { members: newMembers });
    }
  });

  // 4. Update project_member_roles
  const roles = await adminDb.collection('project_member_roles').where('user_id', '==', oldId).get();
  roles.forEach(doc => {
    const data = doc.data();
    batch.set(adminDb.collection('project_member_roles').doc(`${data.project_id}_${newId}`), {
      ...data,
      user_id: newId
    });
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`Usuario ${oldId} fusionado exitosamente en ${newId}`);
}

mergeUser();
