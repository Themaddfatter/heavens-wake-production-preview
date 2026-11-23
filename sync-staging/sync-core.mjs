// Storage-neutral migration primitives. No existing state is deleted by migration.
export class SyncConflictError extends Error {
  constructor() { super('The cloud library changed on another device. Reload before saving.'); this.name = 'SyncConflictError'; }
}
export async function migrateLocalLibrary({doc, appearance, preferences, readLocalMedia, uploadMedia, commit, expectedRevision, onProgress = () => {}}) {
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
  const result = await commit({doc: copy, appearance, preferences, expectedRevision});
  if (result?.conflict) throw new SyncConflictError();
  if (!result?.saved) throw new Error('Cloud library could not be saved. Local work has been preserved.');
  return {revision: result.revision, uploaded: completed, migratedDoc: copy};
}


// Merge only missing media from this computer and its safety backup. Existing
// cloud presentations, preferences, saved services, and files are never replaced.
export async function recoverMissingLocalMedia({ remoteDoc, localDocs, readLocalMedia, uploadMedia, commit, expectedRevision }) {
  if (!remoteDoc || !Array.isArray(remoteDoc.media) || !Array.isArray(remoteDoc.presentations))
    throw new TypeError('A valid cloud library is required.');
  if (!Array.isArray(localDocs) || typeof readLocalMedia !== 'function' ||
      typeof uploadMedia !== 'function' || typeof commit !== 'function')
    throw new TypeError('Local recovery adapters are required.');
  const doc = structuredClone(remoteDoc);
  const byId = new Map(doc.media.map(item => [item.id, item]));
  const candidates = new Map();
  for (const source of localDocs) {
    for (const item of Array.isArray(source?.media) ? source.media : []) {
      if (typeof item?.id !== 'string' || !item.id ||
          typeof item.src !== 'string' || !item.src.startsWith('idb:')) continue;
      const saved = byId.get(item.id);
      if (saved && !String(saved.src || '').startsWith('idb:')) continue;
      if (!candidates.has(item.id)) candidates.set(item.id, item);
    }
  }
  if (!candidates.size) return { recovered: 0, unavailable: 0 };
  let recovered = 0, unavailable = 0;
  const newIds = new Set();
  for (const [id,item] of candidates) {
    let blob;
    try { blob = await readLocalMedia(item.src.slice(4)); }
    catch (error) { if (error?.name !== 'NotFoundError') throw error; }
    if (!(blob instanceof Blob) || !blob.size) { unavailable++; continue; }
    // Upload bytes before changing any shared Firestore references.
    const result = await uploadMedia({ id, blob, name: item.name || id, kind: item.kind });
    if (!result?.id) throw new Error('The recovered media upload did not complete.');
    const saved = { ...structuredClone(item), src: 'cloud:' + result.id };
    if (byId.has(id)) Object.assign(byId.get(id), saved);
    else { doc.media.push(saved); byId.set(id, saved); }
    newIds.add(id);
    recovered++;
  }
  if (!recovered) return { recovered: 0, unavailable };
  const usesMedia = value => {
    if (!value || typeof value !== 'object') return false;
    if (typeof value.mediaId === 'string' && newIds.has(value.mediaId)) return true;
    return (Array.isArray(value) ? value : Object.values(value)).some(usesMedia);
  };
  for (const source of localDocs) {
    if (!source) continue;
    for (const folder of Array.isArray(source.mediaFolders) ? source.mediaFolders : [])
      if (folder?.id && Array.isArray(doc.mediaFolders) &&
          !doc.mediaFolders.some(x => x.id === folder.id))
        doc.mediaFolders.push(structuredClone(folder));
    for (const presentation of Array.isArray(source.presentations) ? source.presentations : []) {
      const relevant = (Array.isArray(presentation.slides) ? presentation.slides : []).filter(usesMedia);
      if (!relevant.length) continue;
      const saved = doc.presentations.find(x => x.id === presentation.id);
      if (!saved) {
        doc.presentations.push({ ...structuredClone(presentation), slides: structuredClone(relevant) });
        const library = (source.libraries || []).find(x => x.id === presentation.libraryId);
        if (library && Array.isArray(doc.libraries) && !doc.libraries.some(x => x.id === library.id))
          doc.libraries.push(structuredClone(library));
      } else if (Array.isArray(saved.slides)) {
        for (const slide of relevant) {
          const previous = saved.slides.find(x => x.id === slide.id);
          if (!previous) saved.slides.push(structuredClone(slide));
          else if (!usesMedia(previous)) {
            // Both versions are preserved; a stable recovery ID avoids duplicates.
            const mediaId = [...newIds].find(id => JSON.stringify(slide).includes('"mediaId":"' + id + '"')) || [...newIds][0];
            const recoveredId = String(slide.id) + '_recovered_' + mediaId.slice(0, 12);
            if (!saved.slides.some(x => x.id === recoveredId))
              saved.slides.push({ ...structuredClone(slide), id: recoveredId });
          }
        }
      }
    }
  }
  if (!doc.logoMediaId)
    for (const source of localDocs)
      if (newIds.has(source?.logoMediaId)) { doc.logoMediaId = source.logoMediaId; break; }
  const result = await commit({ doc, expectedRevision });
  if (result?.conflict) throw new SyncConflictError();
  if (!result?.saved) throw new Error('Cloud media recovered, but the shared library could not save.');
  return { recovered, unavailable, revision: result.revision };
}
