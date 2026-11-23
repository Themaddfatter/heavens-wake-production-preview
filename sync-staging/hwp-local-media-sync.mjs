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
      return { file, version: saved.version, size: saved.size, type: saved.type || file.type || 'application/octet-stream' };
    } catch (error) {
      if (error?.name === 'NotFoundError') return null;
      throw error;
    }
  }

  async function runSync() {
    if (running) return running;
    running = (async () => {
      const persistent = (await persistence().catch(() => false)) === true; // never assume persistence
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
          state.files[item.id] = { version: item.version, size: blob.size, type: item.type || blob.type || 'application/octet-stream', fileName };
          await writeIndex(state); // publish new version only after completed write
        } catch (error) {
          await writer.abort().catch(() => {});
          await dir.removeEntry(fileName).catch(() => {});
          throw error;
        }
        completed++;
        onStatus({ status: 'downloaded', id: item.id, completed, total: entries.length });
      }
      return { completed, skipped, total: entries.length, persistent };
    })().finally(() => { running = null; });
    return running;
  }

  async function playback(id) {
    const local = await localEntry(id);
    if (!local) return null;
    const media = local.file.type === local.type ? local.file : new Blob([local.file], { type: local.type });
    const url = URL.createObjectURL(media);
    return { url, file: media, release: () => URL.revokeObjectURL(url) };
  }
  async function readiness(ids) {
    const missing = [];
    for (const id of ids) if (!await localEntry(id)) missing.push(id);
    return { ready: missing.length === 0, missing, checked: ids.length };
  }
  // An online check can distinguish locally playable media from current media.
  // If the cloud cannot be reached, callers should show an offline warning and
  // may separately use readiness() to confirm what is physically on the disk.
  async function readinessAgainstCloud(ids) {
    const remote = await listRemote();
    if (!Array.isArray(remote)) throw new TypeError('Invalid cloud media listing.');
    const versions = new Map(remote.filter(x => validId(x?.id)).map(x => [x.id, x.version]));
    const missing = [], outdated = [];
    for (const id of ids) {
      const local = await localEntry(id);
      if (!local) missing.push(id);
      else if (!versions.has(id) || local.version !== versions.get(id)) outdated.push(id);
    }
    return { ready: missing.length === 0 && outdated.length === 0, missing, outdated, checked: ids.length };
  }
  return { runSync, playback, readiness, readinessAgainstCloud, localEntry, index };
}
