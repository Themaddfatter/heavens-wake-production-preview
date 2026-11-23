// HWP local-media synchronization adapter for Firefox, Chrome and Edge.
// OPFS stores real bytes on each user's disk, managed by their browser.
// No Google Drive login, no PC-hosted server and no background process required.
// Wire to the Firebase adapter after the bucket/rules have been provisioned.
const MEDIA_ID = /^[A-Za-z0-9_-]{12,80}$/;
const APP_DIR = 'hwp-media-v1';
const INDEX_FILE = 'index.json';
const validId = id => typeof id === 'string' && MEDIA_ID.test(id);

export function createHwpLocalMediaSync({
  listRemote, download,
  rootDirectory = async () => navigator.storage.getDirectory(),
  persistence = async () => navigator.storage.persist?.(),
  onStatus = () => {}
}) {
  if (typeof listRemote !== 'function' || typeof download !== 'function')
    throw new TypeError('Firebase listing and download adapters are required.');
  let running = null, directoryPromise = null;
  const getDir = () => directoryPromise ||= (async () =>
    (await rootDirectory()).getDirectoryHandle(APP_DIR, { create: true }))();

  async function index() {
    const dir = await getDir();
    try {
      const handle = await dir.getFileHandle(INDEX_FILE);
      const text = await (await handle.getFile()).text();
      const obj = JSON.parse(text);
      return obj && obj.version === 1 && obj.files && typeof obj.files === 'object'
        ? obj : { version: 1, files: {} };
    } catch (error) {
      if (error?.name === 'NotFoundError') return { version: 1, files: {} };
      throw error; // corrupted index is not silently overwritten
    }
  }

  async function writeIndex(value) {
    const dir = await getDir();
    const handle = await dir.getFileHandle(INDEX_FILE, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(JSON.stringify(value));
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => {});
      throw error;
    }
  }

  async function localEntry(id) {
    if (!validId(id)) throw new TypeError('Invalid media identifier.');
    const saved = (await index()).files[id];
    if (!saved) return null;
    try {
      const file = await (await getDir()).getFileHandle(saved.fileName).then(h => h.getFile());
      if (file.size !== saved.size) return null;
      return { file, version: saved.version, size: saved.size };
    } catch (error) {
      if (error?.name === 'NotFoundError') return null;
      throw error;
    }
  }

  async function runSync() {
    if (running) return running;
    running = (async () => {
      await persistence().catch(() => false); // best effort, never a silent guarantee
      const entries = await listRemote();
      if (!Array.isArray(entries)) throw new TypeError('Invalid cloud media listing.');
      const state = await index();
      let completed = 0, skipped = 0;
      for (const item of entries) {
        if (!validId(item?.id) || !Number.isSafeInteger(Number(item.size))
          || Number(item.size) < 1 || typeof item.version !== 'string' || !item.version)
          throw new TypeError('Cloud media metadata is invalid.');
        const previous = state.files[item.id];
        if (previous?.version === item.version && await localEntry(item.id)) {
          skipped++;
          continue;
        }
        onStatus({ status: 'downloading', id: item.id, completed, total: entries.length });
        const blob = await download(item);
        if (!(blob instanceof Blob) || blob.size !== Number(item.size))
          throw new Error('Downloaded file size did not match Firebase metadata.');
        // Versioned physical filenames prevent incomplete downloads from replacing
        // the last known-good local copy.
        const fileName = item.id + '-' + crypto.randomUUID() + '.media';
        const dir = await getDir();
        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writer = await fileHandle.createWritable();
        try {
          await writer.write(blob);
          await writer.close();
          const verified = await fileHandle.getFile();
          if (verified.size !== blob.size)
            throw new Error('Local file size verification failed.');
          state.files[item.id] = { version: item.version, size: blob.size, fileName };
          await writeIndex(state); // publish new version only after completed write
        } catch (error) {
          await writer.abort().catch(() => {});
          await dir.removeEntry(fileName).catch(() => {});
          throw error;
        }
        completed++;
        onStatus({ status: 'downloaded', id: item.id, completed, total: entries.length });
      }
      return { completed, skipped, total: entries.length, persistent: true };
    })().finally(() => { running = null; });
    return running;
  }

  async function playback(id) {
    const local = await localEntry(id);
    if (!local) return null;
    const url = URL.createObjectURL(local.file);
    return { url, file: local.file, release: () => URL.revokeObjectURL(url) };
  }
  async function readiness(ids) {
    const missing = [];
    for (const id of ids) if (!await localEntry(id)) missing.push(id);
    return { ready: missing.length === 0, missing, checked: ids.length };
  }
  return { runSync, playback, readiness, localEntry, index };
}
