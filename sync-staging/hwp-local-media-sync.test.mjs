import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createHwpLocalMediaSync } from './hwp-local-media-sync.mjs';

if (!globalThis.crypto?.randomUUID) globalThis.crypto = webcrypto;
const ID = '123e4567-e89b-42d3-a456-426614174000';

class FakeFile {
  constructor() { this.data = null; }
  async getFile() {
    if (!this.data) throw new DOMException('No file', 'NotFoundError');
    return new Blob([this.data]); // OPFS File can report no useful MIME type
  }
  async createWritable() {
    let staged = null;
    return {
      write: async input => { staged = input instanceof Blob ? input : new Blob([input]); },
      close: async () => { this.data = staged || new Blob([]); },
      abort: async () => { staged = null; }
    };
  }
}
class FakeDirectory {
  constructor() { this.files = new Map(); this.dirs = new Map(); }
  async getDirectoryHandle(name, { create = false } = {}) {
    if (!this.dirs.has(name)) {
      if (!create) throw new DOMException('No dir', 'NotFoundError');
      this.dirs.set(name, new FakeDirectory());
    }
    return this.dirs.get(name);
  }
  async getFileHandle(name, { create = false } = {}) {
    if (!this.files.has(name)) {
      if (!create) throw new DOMException('No file', 'NotFoundError');
      this.files.set(name, new FakeFile());
    }
    return this.files.get(name);
  }
  async removeEntry(name) { this.files.delete(name); }
}

test('downloads a cloud video to a local OPFS file, then skips identical revisions', async () => {
  const root = new FakeDirectory();
  let downloads = 0;
  let version = 'cloud-revision-1';
  const client = createHwpLocalMediaSync({
    rootDirectory: async () => root,
    persistence: async () => true,
    listRemote: async () => [{ id: ID, version, size: 3 }],
    download: async () => { downloads++; return new Blob(['abc'], { type: 'video/mp4' }); }
  });
  assert.deepEqual(await client.runSync(), { completed: 1, skipped: 0, total: 1, persistent: true });
  assert.equal((await client.localEntry(ID)).file.size, 3);
  assert.deepEqual(await client.runSync(), { completed: 0, skipped: 1, total: 1, persistent: true });
  assert.equal(downloads, 1);
  assert.deepEqual(await client.readiness([ID]), { ready: true, missing: [], checked: 1 });
  const media = await client.playback(ID);
  assert.ok(media.url.startsWith('blob:'));
  assert.equal(media.file.type, 'video/mp4', 'local playback must preserve video type');
  media.release();
  version = 'cloud-revision-2';
  await client.runSync();
  assert.equal(downloads, 2);
  assert.equal((await client.localEntry(ID)).version, version);
});

test('an invalid downloaded file does not replace the last known-good local version', async () => {
  const root = new FakeDirectory();
  let broken = false;
  const client = createHwpLocalMediaSync({
    rootDirectory: async () => root,
    persistence: async () => false,
    listRemote: async () => [{ id: ID, version: broken ? 'v2' : 'v1', size: 5 }],
    download: async () => new Blob([broken ? 'bad' : 'good!'])
  });
  const first = await client.runSync();
  assert.equal(first.persistent, false);
  broken = true;
  await assert.rejects(client.runSync(), /size did not match/);
  const previous = await client.localEntry(ID);
  assert.equal(previous.version, 'v1');
  assert.equal(await previous.file.text(), 'good!');
});

test('reports missing media before a service', async () => {
  const client = createHwpLocalMediaSync({
    rootDirectory: async () => new FakeDirectory(),
    listRemote: async () => [],
    download: async () => { throw Error('should not download'); }
  });
  assert.deepEqual(await client.readiness([ID]), { ready: false, missing: [ID], checked: 1 });
});
