# @jesusacd/mediafire

Complete MediaFire SDK for Node.js. **Just use your email and password** to access all API features.

[![npm version](https://badge.fury.io/js/%40jesusacd%2Fmediafire.svg)](https://www.npmjs.com/package/@jesusacd/mediafire)

## ✨ Features

- 🔐 **Simple Authentication** - Just email and password, no API keys needed
- 📁 **Full Management** - Files and folders (create, move, copy, delete)
- 📤 **File Upload** - Supports large files
- 🔍 **Smart Search** - Advanced search with automatic keyword extraction
- 🔗 **Direct Links** - Get download URLs
- 📊 **TypeScript** - Full type definitions included

## 📦 Installation

```bash
npm install @jesusacd/mediafire
```

## 🚀 Quick Start

```javascript
const { MediaFireClient } = require("@jesusacd/mediafire");

const client = new MediaFireClient();

async function main() {
  // Just email and password - that's it!
  await client.login("your-email@example.com", "your-password");

  // Get user info
  const user = await client.user.getInfo();
  console.log(`Hello, ${user.displayName}!`);

  // Upload a file
  const result = await client.upload.file("./my-file.pdf");
  console.log(`Uploaded: ${result.quickKey}`);

  // Get download link
  const links = await client.files.getLinks(result.quickKey);
  console.log(`Link: ${links.directDownload}`);
}

main();
```

## 📚 API Reference

### Authentication

```javascript
const client = new MediaFireClient();

// Login with email and password
await client.login("email@example.com", "password");

// Check if authenticated
client.isAuthenticated(); // true

// Get session data
const session = client.getSession();

// Restore previous session
client.setSession(session);

// Logout
client.logout();
```

---

### 👤 User Module

```javascript
// User information
const user = await client.user.getInfo();
// { displayName, email, firstName, lastName, gender, birthDate, premium, emailVerified, createdAt }

// Storage info
const storage = await client.user.getStorage();
// { used, total, usedFormatted: "500 MB", totalFormatted: "10 GB", percentUsed: 5 }
```

---

### 📁 Folders Module

```javascript
// List folder contents
const content = await client.folders.getContent("folderKey");
// { items: [...], moreChunks, chunkNumber }

// Get only files
const files = await client.folders.getFiles("folderKey");

// Get only folders
const folders = await client.folders.getFolders("folderKey");

// Get folder info
const info = await client.folders.getInfo("folderKey");
// { folderKey, name, description, created, privacy, fileCount, folderCount, totalSize }

// Create folder
const newFolder = await client.folders.create("My Folder", "parentKey");
// { folderKey, name }

// Rename folder
await client.folders.rename("folderKey", "New Name");

// Move to another folder
await client.folders.move("folderKey", "destFolderKey");

// Copy folder
const newKey = await client.folders.copy("folderKey", "destFolderKey");

// Change privacy
await client.folders.setPrivacy("folderKey", "public"); // or 'private'

// Delete (move to trash)
await client.folders.delete("folderKey");

// Permanently delete
await client.folders.purge("folderKey");
```

---

### 📄 Files Module

```javascript
// Get file info
const fileInfo = await client.files.getInfo("quickKey");
// { quickKey, name, size, sizeFormatted, hash, created, privacy, mimeType, ... }

// Get links
const links = await client.files.getLinks("quickKey");
// { viewLink, normalDownload, directDownload }

// Search files (basic)
const results = await client.files.search("document");
// { items: [...], total }

// Smart search (recommended for complex names)
const results = await client.files.smartSearch(
  "La empresa de sillas (2025) Temporada 1 [1080p] {MAX} WEB-DL",
);
// Automatically extracts unique keywords and filters results

// Smart search with filters
const folders = await client.files.smartSearch("My Series", {
  filter: "folders", // 'files' | 'folders' | 'everything'
});

// Exact match
const exact = await client.files.smartSearch("exact name", {
  exactMatch: true,
});

// Change privacy
await client.files.setPrivacy("quickKey", "public");
await client.files.makePublic("quickKey"); // Shortcut
await client.files.makePrivate("quickKey"); // Shortcut

// Rename file
await client.files.rename("quickKey", "new-name.pdf");

// Move to another folder
await client.files.move("quickKey", "folderKey");

// Copy file
const newKeys = await client.files.copy("quickKey", "folderKey");

// Delete (move to trash)
await client.files.delete("quickKey");

// Restore from trash
await client.files.restore("quickKey");

// Permanently delete
await client.files.purge("quickKey");

// Get file versions
const versions = await client.files.getVersions("quickKey");

// Get recently modified files
const recent = await client.files.getRecentlyModified();
```

---

### 📤 Upload Module

```javascript
// Upload file from disk
const result = await client.upload.file("./file.pdf", {
  folderKey: "destFolderKey", // Optional: destination folder
  actionOnDuplicate: "keep", // 'skip' | 'keep' | 'replace'
});
// { quickKey, filename, size, uploadKey }

// Upload from Buffer
const buffer = Buffer.from("File content");
const result = await client.upload.buffer(buffer, "file.txt", {
  folderKey: "destFolderKey",
});

// Check if file exists (for instant upload)
const check = await client.upload.check(sha256Hash, "file.pdf", fileSize);
// { hashExists, inAccount, inFolder, duplicateQuickKey }

// Instant upload (if file already exists on MediaFire)
const result = await client.upload.instant(
  sha256Hash,
  "file.pdf",
  fileSize,
  "folderKey",
);
```

---

## 💡 Usage Examples

### Upload multiple files

```javascript
const files = ["doc1.pdf", "doc2.pdf", "image.png"];

for (const file of files) {
  const result = await client.upload.file(file);
  console.log(`✅ ${file} -> ${result.quickKey}`);
}
```

### Create folder structure

```javascript
// Create main folder
const main = await client.folders.create("Project 2024");

// Create subfolders
await client.folders.create("Documents", main.folderKey);
await client.folders.create("Images", main.folderKey);
await client.folders.create("Videos", main.folderKey);
```

### Backup local folder

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
      console.log(`✅ ${file} uploaded`);
    }
  }
}

// Usage
const folder = await client.folders.create("Backup-" + Date.now());
await backupFolder("./my-documents", folder.folderKey);
```

### Get all links from a folder

```javascript
const files = await client.folders.getFiles("folderKey");

for (const file of files) {
  const links = await client.files.getLinks(file.quickKey);
  console.log(`${file.name}: ${links.directDownload || links.viewLink}`);
}
```

### Search and download

```javascript
// Use smartSearch for complex file names
const results = await client.files.smartSearch(
  "Prison Break (2005-2017) Temporada 1-5 [Full 1080p]",
);

for (const file of results.items.filter((i) => !i.isFolder)) {
  const links = await client.files.getLinks(file.quickKey);
  console.log(`📄 ${file.name}`);
  console.log(`   Download: ${links.directDownload}`);
}
```

---

## ⚠️ Error Handling

```javascript
const { MediaFireClient, MediaFireError } = require("@jesusacd/mediafire");

try {
  await client.login("email", "wrong-password");
} catch (error) {
  if (error instanceof MediaFireError) {
    console.log("MediaFire Error:", error.message);
    console.log("Code:", error.code);
  }
}
```

---

## 📊 Limits and Performance

- **Max file size**: Depends on your MediaFire plan
- **Upload speed**: ~16 MB/s (depends on your connection)
- **Session**: Automatically managed with key rotation

---

## 🔧 Advanced Configuration

```javascript
const client = new MediaFireClient({
  appId: "42511", // App ID (optional, uses default)
  apiVersion: "1.3", // API version
  timeout: 30000, // Timeout in ms
});
```

---

## 📋 Available Methods

| Module      | Method                          | Description                |
| ----------- | ------------------------------- | -------------------------- |
| **Auth**    | `login(email, password)`        | Log in                     |
|             | `logout()`                      | Log out                    |
|             | `isAuthenticated()`             | Check authentication       |
|             | `getSession()`                  | Get session data           |
|             | `setSession(session)`           | Restore session            |
| **User**    | `getInfo()`                     | User info                  |
|             | `getStorage()`                  | Storage used               |
| **Folders** | `getContent(key, options)`      | List contents              |
|             | `getFiles(key, options)`        | List files                 |
|             | `getFolders(key, options)`      | List folders               |
|             | `getInfo(key)`                  | Folder info                |
|             | `create(name, parentKey)`       | Create folder              |
|             | `rename(key, newName)`          | Rename                     |
|             | `move(key, destKey)`            | Move                       |
|             | `copy(key, destKey)`            | Copy                       |
|             | `setPrivacy(key, privacy)`      | Change privacy             |
|             | `delete(key)`                   | Delete (trash)             |
|             | `purge(key)`                    | Permanently delete         |
| **Files**   | `getInfo(quickKey)`             | File info                  |
|             | `getLinks(quickKey)`            | Get links                  |
|             | `search(query)`                 | Basic search               |
|             | `smartSearch(query, options)`   | Smart search (recommended) |
|             | `setPrivacy(quickKey, privacy)` | Change privacy             |
|             | `makePublic(quickKey)`          | Make public                |
|             | `makePrivate(quickKey)`         | Make private               |
|             | `rename(quickKey, newName)`     | Rename                     |
|             | `move(quickKey, folderKey)`     | Move                       |
|             | `copy(quickKey, folderKey)`     | Copy                       |
|             | `delete(quickKey)`              | Delete (trash)             |
|             | `restore(quickKey)`             | Restore                    |
|             | `purge(quickKey)`               | Permanently delete         |
|             | `getVersions(quickKey)`         | Version history            |
|             | `getRecentlyModified()`         | Recent files               |
| **Upload**  | `file(path, options)`           | Upload from disk           |
|             | `buffer(buffer, name, options)` | Upload from buffer         |
|             | `check(hash, name, size)`       | Check existence            |
|             | `instant(hash, name, size)`     | Instant upload             |

---

## 📄 License

MIT © JesusACD
