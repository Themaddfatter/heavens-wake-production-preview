// Firebase Cloud Storage adapter for HWP's existing Ministry Connect Firebase session.
// SDK functions are injected because HWP is currently a static website (not a Vite app).
// Import this module only after the bucket is enabled and restrictive rules deployed.
const ROOT = 'zion-shared-v1/hwp/shared';
const VALID_ID = /^[A-Za-z0-9_-]{12,80}$/;
const MEDIA_TYPE = /^(image|video|audio)\//;

export function createHwpFirebaseMediaRemote({ storage, auth, sdk }) {
  for (const method of ['ref','list','getMetadata','getBlob','uploadBytesResumable'])
    if (typeof sdk?.[method] !== 'function') throw new TypeError('Firebase Storage SDK is required.');
  const signedIn = () => {
    const user = auth?.currentUser;
    if (!user?.uid) throw new Error('Sign in to Ministry Connect to synchronize media.');
    return user;
  };
  const byId = id => {
    if (typeof id !== 'string' || !VALID_ID.test(id)) throw new TypeError('Invalid media ID.');
    return sdk.ref(storage, ROOT + '/' + id);
  };
  async function listRemote() {
    signedIn();
    const records = [];
    let pageToken;
    do {
      const page = await sdk.list(sdk.ref(storage, ROOT), { maxResults: 100, ...(pageToken ? {pageToken} : {}) });
      for (const fileRef of page.items) {
        if (!VALID_ID.test(fileRef.name)) continue;
        const meta = await sdk.getMetadata(fileRef);
        const size = Number(meta.size);
        if (!Number.isSafeInteger(size) || size < 1) continue;
        records.push({
          id: fileRef.name,
          version: String(meta.generation || meta.updated || meta.md5Hash || ''),
          size, type: meta.contentType || '',
          name: meta.customMetadata?.displayName || fileRef.name
        });
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
    return records;
  }
  async function download(item) {
    signedIn();
    // Firebase getBlob enforces Storage rules; this is not a public download URL.
    // Bucket CORS must allow the HWP origin for browser-to-cloud downloads.
    return sdk.getBlob(byId(item?.id));
  }
  async function upload(blob, displayName) {
    const uid = signedIn().uid;
    if (!(blob instanceof Blob) || !blob.size || blob.size > 4 * 1024 * 1024 * 1024
      || !MEDIA_TYPE.test(blob.type)) throw new TypeError('Choose a supported media file (up to 4 GB).');
    const id = crypto.randomUUID();
    const metadata = {
      contentType: blob.type,
      customMetadata: { ownerUid: uid, displayName: String(displayName || id).slice(0, 160) }
    };
    const task = sdk.uploadBytesResumable(byId(id), blob, metadata);
    await new Promise((resolve, reject) => task.on('state_changed', null, reject, resolve));
    const meta = await sdk.getMetadata(byId(id));
    return { id, name: metadata.customMetadata.displayName, size: Number(meta.size),
      version: String(meta.generation || meta.updated || '') };
  }
  return { listRemote, download, upload };
}
