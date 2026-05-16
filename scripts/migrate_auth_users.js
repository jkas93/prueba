/**
 * ============================================================
 * CRONOGRAMA — Script de Migración de Usuarios a Firebase Auth
 * ============================================================
 *
 * Este script crea cuentas en Firebase Authentication para todos
 * los usuarios que existen en Firestore (migrados de Supabase)
 * pero que aún no tienen cuenta en Firebase Auth.
 *
 * Ejecutar con:
 *   npm run migrate:auth
 *
 * Asegúrate de tener las variables de entorno configuradas en .env.local
 *
 * ⚠️ IMPORTANTE: Este script NO puede migrar contraseñas.
 * Se usará la API nativa de Firebase para enviar un correo 
 * de restablecimiento de contraseña a cada usuario.
 * ============================================================
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// ── Inicializar Firebase Admin ──────────────────────────────
if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Faltan variables de entorno de Firebase Admin.');
    console.error('   Necesitas: NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();
const auth = admin.auth();

// ── Envío de email (nativo de Firebase via REST) ───────────────────
async function sendFirebaseResetEmail(email) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    console.warn('  ⚠ No hay NEXT_PUBLIC_FIREBASE_API_KEY. No se puede enviar el email.');
    return false;
  }
  
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'PASSWORD_RESET',
        email,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn(`  ⚠ Email error: ${err.message}`);
    return false;
  }
}

// ── Lógica principal ────────────────────────────────────────
async function migrateAuthUsers() {
  console.log('\n🚀 Iniciando migración de usuarios a Firebase Auth...\n');

  // 1. Obtener todos los usuarios de Firestore
  const usersSnap = await db.collection('users').get();
  const totalUsers = usersSnap.docs.length;
  console.log(`📋 Encontrados ${totalUsers} usuarios en Firestore.\n`);

  const results = {
    alreadyExists: 0,
    created: 0,
    emailSent: 0,
    emailFailed: 0,
    errors: 0,
    ghostLinks: [],
  };

  for (const docSnap of usersSnap.docs) {
    const uid = docSnap.id;
    const userData = docSnap.data();
    const fullName = userData.full_name || 'Usuario';

    process.stdout.write(`  Procesando ${fullName} (${uid.slice(0, 8)}...)  `);

    // 2. Verificar si ya existe en Firebase Auth
    try {
      await auth.getUser(uid);
      console.log('✅ Ya existe en Auth — omitiendo.');
      results.alreadyExists++;
      continue;
    } catch (err) {
      if (err.code !== 'auth/user-not-found') {
        console.log(`❌ Error verificando: ${err.message}`);
        results.errors++;
        continue;
      }
    }

    // 3. Intentar crear con el mismo UID para mantener referencias en Firestore
    // Necesitamos el email: buscarlo en el doc o pedirlo
    const email = userData.email; // Solo si fue guardado en Firestore al migrar
    
    if (!email) {
      console.log('⚠ Sin email en Firestore — no se puede crear la cuenta.');
      console.log('    → Usa el panel Admin (/admin) para invitar manualmente a este usuario.');
      results.errors++;
      continue;
    }

    try {
      // Intentar con el mismo UID de Supabase para preservar referencias
      const newUser = await auth.createUser({
        uid,
        email,
        displayName: fullName,
      });

      console.log(`✅ Creado en Auth (${newUser.uid.slice(0, 8)}...)`);
      results.created++;

      // 4. Actualizar system_role si falta
      if (!userData.system_role) {
        await docSnap.ref.update({ system_role: 'user' });
      }

      // 5. Intentar enviar por email usando la API de Firebase
      const emailSent = await sendFirebaseResetEmail(email);
      
      if (emailSent) {
        console.log(`  📧 Email de reseteo nativo enviado a ${email}`);
        results.emailSent++;
      } else {
        // Fallback: Generar link de reset de contraseña manual
        const resetLink = await auth.generatePasswordResetLink(email, {
          url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login?welcome=true`,
          handleCodeInApp: false,
        });
        
        console.log(`  📋 Link (email falló): ${resetLink.slice(0, 60)}...`);
        results.emailFailed++;
        results.ghostLinks.push({ email, fullName, resetLink });
      }

    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        // El email ya existe en Auth pero con distinto UID — vincular Firestore al UID real
        try {
          const existingUser = await auth.getUserByEmail(email);
          console.log(`⚡ Email existe con UID diferente (${existingUser.uid.slice(0, 8)}...) — actualizando Firestore...`);
          
          // Copiar el documento al nuevo UID
          const existingData = await db.collection('users').doc(existingUser.uid).get();
          if (!existingData.exists) {
            await db.collection('users').doc(existingUser.uid).set({
              ...userData,
              system_role: userData.system_role || 'user',
            });
          }
          
          results.alreadyExists++;
        } catch (e2) {
          console.log(`❌ Error vinculando: ${e2.message}`);
          results.errors++;
        }
      } else {
        console.log(`❌ Error creando: ${err.message}`);
        results.errors++;
      }
    }
  }

  // ── Resumen ─────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESUMEN DE MIGRACIÓN');
  console.log('═'.repeat(60));
  console.log(`  ✅ Ya existían en Auth:   ${results.alreadyExists}`);
  console.log(`  🆕 Creados nuevos:        ${results.created}`);
  console.log(`  📧 Emails nativos env.:   ${results.emailSent}`);
  console.log(`  📋 Falló email (links):   ${results.emailFailed}`);
  console.log(`  ❌ Errores:               ${results.errors}`);

  if (results.ghostLinks.length > 0) {
    console.log('\n⚠️  LINKS DE ACCESO PARA COMPARTIR MANUALMENTE (Email falló):');
    console.log('─'.repeat(60));
    for (const { email, fullName, resetLink } of results.ghostLinks) {
      console.log(`\n  👤 ${fullName} <${email}>`);
      console.log(`     ${resetLink}`);
    }
    console.log('\n  💡 Copia estos links y envíalos directamente a cada usuario.');
  }

  console.log('\n🎉 Migración completada.\n');
}

migrateAuthUsers().catch(err => {
  console.error('\n💥 Error fatal durante la migración:', err.message);
  process.exit(1);
});
