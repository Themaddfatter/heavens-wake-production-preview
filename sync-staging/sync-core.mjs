// Storage-neutral migration primitives. No existing state is deleted by migration.
export class SyncConflictError extends Error {
  constructor() { super('The cloud library changed on another device. Reload before saving.'); this.name = 'SyncConflictError'; }
}
export async function migrateLocalLibrary({doc, appearance, readLocalMedia, uploadMedia, commit, expectedRevision, onProgress = () => {}}) {
  if (!doc || !Array.isArray(doc.presentations) || !Array.isArray(doc.media)) throw new TypeError('Invalid local library');
  if (typeof readLocalMedia !== 'function' || typeof uploadMedia !== 'function' || typeof commit !== 'function') throw new TypeError('Storage adapters are required');
  const copy = structuredClone(doc), sources = new Map();
  for (const item of copy.media) {
    if (typeof item.src !== 'string' || !item.src.startsWith('idb:')) continue;
    const localId = item.src.slice(4);
    if (!localId) throw new Error('An uploaded file is missing its local ID.');
    if (!sources.has(localId)) sources.set(localId, []);
    sources.get(localId).push(item);
  }
  let completed = 0;
  for (const [id, entries] of sources) {
    const blob = await readLocalMedia(id);
    if (!(blob instanceof Blob) || !blob.size) throw new Error(`Could not read local media ${entries[0].name || id}; the library has not been changed.`);
    const result = await uploadMedia({id, blob, name: entries[0].name, kind: entries[0].kind});
    if (!result || typeof result.id !== 'string' || !result.id) throw new Error('Media upload did not return a saved file ID.');
    for (const item of entries) item.src = `cloud:${result.id}`;
    onProgress({completed: ++completed, total: sources.size});
  }
  const result = await commit({doc: copy, appearance, expectedRevision});
  if (result?.conflict) throw new SyncConflictError();
  if (!result?.saved) throw new Error('Cloud library could not be saved. Local work has been preserved.');
  return {revision: result.revision, uploaded: completed, migratedDoc: copy};
}
