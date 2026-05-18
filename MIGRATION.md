# Guía de Migración de Proyecto Firebase

Esta guía detalla los pasos para migrar los datos de tu proyecto actual de Firebase a uno nuevo, permitiéndote conectar la versión mejorada del sistema a una copia fresca de tus datos.

## 1. Requisitos Previos

1. Tener instalada la **Firebase CLI**: `npm install -g firebase-tools`.
2. Descargar los archivos JSON de las **Cuentas de Servicio** (Service Account Keys) de ambos proyectos:
   - Ve a Firebase Console > Configuración del proyecto > Cuentas de servicio.
   - Haz clic en "Generar nueva clave privada".
   - Guarda el archivo del proyecto de **Origen** como `source-key.json`.
   - Guarda el archivo del proyecto de **Destino** como `dest-key.json`.

## 2. Migración de Usuarios (Authentication)

Firebase Authentication no se puede migrar mediante scripts de base de datos simples. Se debe usar la CLI:

1. Inicia sesión: `firebase login`.
2. Exporta los usuarios del proyecto de **Origen**:
   ```bash
   firebase auth:export users.json --project <ID_PROYECTO_ORIGEN>
   ```
3. Importa los usuarios al proyecto de **Destino**:
   ```bash
   firebase auth:import users.json --project <ID_PROYECTO_DESTINO>
   ```

## 3. Migración de Base de Datos (Firestore)

He incluido un script especializado en el repositorio para realizar esta tarea.

1. Asegúrate de que las llaves JSON (`source-key.json` y `dest-key.json`) estén en la raíz del proyecto.
2. Ejecuta el comando de migración:
   ```bash
   SOURCE_SERVICE_ACCOUNT_PATH=./source-key.json \
   DEST_SERVICE_ACCOUNT_PATH=./dest-key.json \
   npx tsx scripts/migrate-firestore.mts
   ```
   *El script copiará automáticamente las colecciones de usuarios, proyectos, elementos del Gantt, avances diarios y alertas.*

## 4. Configuración en Vercel

Para que la nueva versión del código funcione con el nuevo proyecto de Firebase, debes actualizar las variables de entorno en tu nuevo despliegue de Vercel:

### Variables Públicas (Client SDK)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Variables Privadas (Admin SDK / Auth Edge)
- `FIREBASE_ADMIN_PROJECT_ID` (Igual al Project ID)
- `FIREBASE_ADMIN_CLIENT_EMAIL` (Encontrado en el JSON del proyecto destino)
- `FIREBASE_ADMIN_PRIVATE_KEY` (Encontrado en el JSON, asegúrate de que incluya los saltos de línea `\n`)
- `COOKIE_SIGNATURE_KEYS` (Genera una clave aleatoria larga, ej: `openssl rand -base64 32`)

## 5. Reglas de Seguridad y Storage

1. **Firestore:** Copia el contenido del archivo `firestore.rules` del repositorio y pégalo en la pestaña "Rules" de Firestore en tu nuevo proyecto.
2. **Storage:** Asegúrate de habilitar Firebase Storage en el nuevo proyecto y crea la carpeta `evidence/` (se creará automáticamente al subir la primera foto, pero verifica que las reglas permitan escritura).

---
**Nota:** Este proceso preserva todos los IDs, por lo que los vínculos entre usuarios, proyectos y tareas se mantendrán intactos.
