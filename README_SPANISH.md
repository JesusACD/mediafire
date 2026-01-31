# @jesusacd/mediafire

SDK completo de MediaFire para Node.js. **Solo necesitas tu correo y contraseña** para acceder a todas las funcionalidades de la API.

[![npm version](https://badge.fury.io/js/%40jesusacd%2Fmediafire.svg)](https://www.npmjs.com/package/@jesusacd/mediafire)

## ✨ Características

- 🔐 **Autenticación simple** - Solo correo y contraseña, sin API keys
- 📁 **Gestión completa** - Archivos y carpetas (crear, mover, copiar, eliminar)
- 📤 **Subida de archivos** - Soporta archivos grandes
- 🔍 **Búsqueda Inteligente** - Búsqueda avanzada con extracción automática de palabras clave
- 🔗 **Enlaces directos** - Obtener URLs de descarga
- 📊 **TypeScript** - Tipos completos incluidos

## 📦 Instalación

```bash
npm install @jesusacd/mediafire
```

## 🚀 Inicio Rápido

```javascript
const { MediaFireClient } = require("@jesusacd/mediafire");

const client = new MediaFireClient();

async function main() {
  // Solo necesitas correo y contraseña
  await client.login("tu-email@example.com", "tu-password");

  // Obtener información del usuario
  const user = await client.user.getInfo();
  console.log(`Hola, ${user.displayName}!`);

  // Subir un archivo
  const result = await client.upload.file("./mi-archivo.pdf");
  console.log(`Subido: ${result.quickKey}`);

  // Obtener enlace de descarga
  const links = await client.files.getLinks(result.quickKey);
  console.log(`Link: ${links.directDownload}`);
}

main();
```

## 📚 API Reference

### Autenticación

```javascript
const client = new MediaFireClient();

// Login con correo y contraseña
await client.login("email@example.com", "password");

// Verificar si está autenticado
client.isAuthenticated(); // true

// Obtener datos de sesión
const session = client.getSession();

// Restaurar sesión previa
client.setSession(session);

// Cerrar sesión
client.logout();
```

---

### 👤 User Module

```javascript
// Información del usuario
const user = await client.user.getInfo();
// { displayName, email, firstName, lastName, gender, birthDate, premium, emailVerified, createdAt }

// Almacenamiento
const storage = await client.user.getStorage();
// { used, total, usedFormatted: "500 MB", totalFormatted: "10 GB", percentUsed: 5 }
```

---

### 📁 Folders Module

```javascript
// Listar contenido de una carpeta
const content = await client.folders.getContent("folderKey");
// { items: [...], moreChunks, chunkNumber }

// Solo archivos
const files = await client.folders.getFiles("folderKey");

// Solo carpetas
const folders = await client.folders.getFolders("folderKey");

// Información de carpeta
const info = await client.folders.getInfo("folderKey");
// { folderKey, name, description, created, privacy, fileCount, folderCount, totalSize }

// Crear carpeta
const newFolder = await client.folders.create("Mi Carpeta", "parentKey");
// { folderKey, name }

// Renombrar
await client.folders.rename("folderKey", "Nuevo Nombre");

// Mover a otra carpeta
await client.folders.move("folderKey", "destFolderKey");

// Copiar
const newKey = await client.folders.copy("folderKey", "destFolderKey");

// Cambiar privacidad
await client.folders.setPrivacy("folderKey", "public"); // o 'private'

// Eliminar (a papelera)
await client.folders.delete("folderKey");

// Eliminar permanentemente
await client.folders.purge("folderKey");
```

---

### 📄 Files Module

```javascript
// Información del archivo
const fileInfo = await client.files.getInfo("quickKey");
// { quickKey, name, size, sizeFormatted, hash, created, privacy, mimeType, ... }

// Obtener enlaces
const links = await client.files.getLinks("quickKey");
// { viewLink, normalDownload, directDownload }

// Buscar archivos (básico)
const results = await client.files.search("documento");
// { items: [...], total }

// Búsqueda inteligente (recomendado para nombres complejos)
const results = await client.files.smartSearch(
  "La empresa de sillas (2025) Temporada 1 [1080p] {MAX} WEB-DL",
);
// Extrae palabras clave únicas automáticamente y filtra resultados

// Búsqueda inteligente con filtros
const folders = await client.files.smartSearch("Mi Serie", {
  filter: "folders", // 'files' | 'folders' | 'everything'
});

// Coincidencia exacta
const exact = await client.files.smartSearch("nombre exacto", {
  exactMatch: true,
});

// Cambiar privacidad
await client.files.setPrivacy("quickKey", "public");
await client.files.makePublic("quickKey"); // Shortcut
await client.files.makePrivate("quickKey"); // Shortcut

// Renombrar
await client.files.rename("quickKey", "nuevo-nombre.pdf");

// Mover a otra carpeta
await client.files.move("quickKey", "folderKey");

// Copiar
const newKeys = await client.files.copy("quickKey", "folderKey");

// Eliminar (a papelera)
await client.files.delete("quickKey");

// Restaurar de papelera
await client.files.restore("quickKey");

// Eliminar permanentemente
await client.files.purge("quickKey");

// Obtener versiones
const versions = await client.files.getVersions("quickKey");

// Archivos modificados recientemente
const recent = await client.files.getRecentlyModified();
```

---

### 📤 Upload Module

```javascript
// Subir archivo desde disco
const result = await client.upload.file("./archivo.pdf", {
  folderKey: "destFolderKey", // Opcional: carpeta destino
  actionOnDuplicate: "keep", // 'skip' | 'keep' | 'replace'
});
// { quickKey, filename, size, uploadKey }

// Subir desde Buffer
const buffer = Buffer.from("Contenido del archivo");
const result = await client.upload.buffer(buffer, "archivo.txt", {
  folderKey: "destFolderKey",
});

// Verificar si archivo existe (para instant upload)
const check = await client.upload.check(sha256Hash, "archivo.pdf", fileSize);
// { hashExists, inAccount, inFolder, duplicateQuickKey }

// Instant upload (si el archivo ya existe en MediaFire)
const result = await client.upload.instant(
  sha256Hash,
  "archivo.pdf",
  fileSize,
  "folderKey",
);
```

---

## 💡 Ejemplos de Uso

### Subir múltiples archivos

```javascript
const files = ["doc1.pdf", "doc2.pdf", "image.png"];

for (const file of files) {
  const result = await client.upload.file(file);
  console.log(`✅ ${file} -> ${result.quickKey}`);
}
```

### Crear estructura de carpetas

```javascript
// Crear carpeta principal
const main = await client.folders.create("Proyecto 2024");

// Crear subcarpetas
await client.folders.create("Documentos", main.folderKey);
await client.folders.create("Imágenes", main.folderKey);
await client.folders.create("Videos", main.folderKey);
```

### Backup de carpeta local

```javascript
const fs = require("fs");
const path = require("path");

async function backupFolder(localPath, remoteFolderKey) {
  const files = fs.readdirSync(localPath);

  for (const file of files) {
    const filePath = path.join(localPath, file);

    if (fs.statSync(filePath).isFile()) {
      const result = await client.upload.file(filePath, {
        folderKey: remoteFolderKey,
      });
      console.log(`✅ ${file} subido`);
    }
  }
}

// Uso
const folder = await client.folders.create("Backup-" + Date.now());
await backupFolder("./mis-documentos", folder.folderKey);
```

### Obtener todos los enlaces de una carpeta

```javascript
const files = await client.folders.getFiles("folderKey");

for (const file of files) {
  const links = await client.files.getLinks(file.quickKey);
  console.log(`${file.name}: ${links.directDownload || links.viewLink}`);
}
```

### Buscar y descargar

```javascript
// Usar smartSearch para nombres complejos de archivos
const results = await client.files.smartSearch(
  "Prison Break (2005-2017) Temporada 1-5 [Full 1080p]",
);

for (const file of results.items.filter((i) => !i.isFolder)) {
  const links = await client.files.getLinks(file.quickKey);
  console.log(`📄 ${file.name}`);
  console.log(`   Descargar: ${links.directDownload}`);
}
```

---

## ⚠️ Manejo de Errores

```javascript
const { MediaFireClient, MediaFireError } = require("@jesusacd/mediafire");

try {
  await client.login("email", "wrong-password");
} catch (error) {
  if (error instanceof MediaFireError) {
    console.log("Error de MediaFire:", error.message);
    console.log("Código:", error.code);
  }
}
```

---

## 📊 Límites y Rendimiento

- **Tamaño máximo de archivo**: Probado hasta 900MB (límite de MediaFire según plan)
- **Velocidad de subida**: ~16 MB/s (depende de tu conexión)
- **Sesión**: Se maneja automáticamente con rotación de claves

---

## 🔧 Configuración Avanzada

```javascript
const client = new MediaFireClient({
  appId: "42511", // App ID (opcional, usa el predeterminado)
  apiVersion: "1.3", // Versión de API
  timeout: 30000, // Timeout en ms
});
```

---

## 📋 Métodos Disponibles

| Módulo      | Método                          | Descripción                        |
| ----------- | ------------------------------- | ---------------------------------- |
| **Auth**    | `login(email, password)`        | Iniciar sesión                     |
|             | `logout()`                      | Cerrar sesión                      |
|             | `isAuthenticated()`             | Verificar autenticación            |
|             | `getSession()`                  | Obtener datos de sesión            |
|             | `setSession(session)`           | Restaurar sesión                   |
| **User**    | `getInfo()`                     | Info del usuario                   |
|             | `getStorage()`                  | Almacenamiento usado               |
| **Folders** | `getContent(key, options)`      | Listar contenido                   |
|             | `getFiles(key, options)`        | Listar archivos                    |
|             | `getFolders(key, options)`      | Listar carpetas                    |
|             | `getInfo(key)`                  | Info de carpeta                    |
|             | `create(name, parentKey)`       | Crear carpeta                      |
|             | `rename(key, newName)`          | Renombrar                          |
|             | `move(key, destKey)`            | Mover                              |
|             | `copy(key, destKey)`            | Copiar                             |
|             | `setPrivacy(key, privacy)`      | Cambiar privacidad                 |
|             | `delete(key)`                   | Eliminar (papelera)                |
|             | `purge(key)`                    | Eliminar permanente                |
| **Files**   | `getInfo(quickKey)`             | Info del archivo                   |
|             | `getLinks(quickKey)`            | Obtener enlaces                    |
|             | `search(query)`                 | Búsqueda básica                    |
|             | `smartSearch(query, options)`   | Búsqueda inteligente (recomendado) |
|             | `setPrivacy(quickKey, privacy)` | Cambiar privacidad                 |
|             | `makePublic(quickKey)`          | Hacer público                      |
|             | `makePrivate(quickKey)`         | Hacer privado                      |
|             | `rename(quickKey, newName)`     | Renombrar                          |
|             | `move(quickKey, folderKey)`     | Mover                              |
|             | `copy(quickKey, folderKey)`     | Copiar                             |
|             | `delete(quickKey)`              | Eliminar (papelera)                |
|             | `restore(quickKey)`             | Restaurar                          |
|             | `purge(quickKey)`               | Eliminar permanente                |
|             | `getVersions(quickKey)`         | Historial versiones                |
|             | `getRecentlyModified()`         | Archivos recientes                 |
| **Upload**  | `file(path, options)`           | Subir desde disco                  |
|             | `buffer(buffer, name, options)` | Subir desde buffer                 |
|             | `check(hash, name, size)`       | Verificar existencia               |
|             | `instant(hash, name, size)`     | Subida instantánea                 |

---

## 📄 Licencia

MIT © JesusACD
