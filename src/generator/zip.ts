import { crc32, deflateRawSync } from 'node:zlib';

/**
 * A minimal zip writer (PKWARE APPNOTE 4.3): local headers, deflate or store, one central
 * directory. Enough for the asset bundles, with no dependency. Every entry carries the same fixed
 * timestamp (1980-01-01, the format's epoch), so the same input always gives the same bytes.
 * Entries over 4 GB (zip64) are refused; no asset bundle comes near that.
 */

export interface ZipEntry {
  readonly path: string;
  readonly data: Buffer | string;
}

const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01

export function zip(entries: readonly ZipEntry[]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  const seen = new Set<string>();
  let offset = 0;

  for (const entry of entries) {
    if (entry.path === '' || entry.path.startsWith('/') || entry.path.split('/').includes('..')) throw new Error(`zip: unsafe entry path "${entry.path}"`);
    if (seen.has(entry.path)) throw new Error(`zip: duplicate entry "${entry.path}"`);
    seen.add(entry.path);

    const name = Buffer.from(entry.path, 'utf8');
    const raw = typeof entry.data === 'string' ? Buffer.from(entry.data, 'utf8') : entry.data;
    const deflated = deflateRawSync(raw, { level: 9 });
    // PNGs are already compressed; store whatever deflate does not shrink.
    const [method, body] = deflated.length < raw.length ? [8, deflated] : [0, raw];
    if (raw.length > 0xffffffff || offset > 0xffffffff) throw new Error('zip: entry too large for a non-zip64 archive');
    const crc = crc32(raw);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0x0800, 6); // UTF-8 names
    header.writeUInt16LE(method, 8);
    header.writeUInt16LE(DOS_TIME, 10);
    header.writeUInt16LE(DOS_DATE, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, name, body);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4); // version made by
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(method, 10);
    dir.writeUInt16LE(DOS_TIME, 12);
    dir.writeUInt16LE(DOS_DATE, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);

    offset += header.length + name.length + body.length;
  }

  if (entries.length > 0xffff) throw new Error(`zip: ${entries.length} entries is over the non-zip64 limit of 65535`);
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
