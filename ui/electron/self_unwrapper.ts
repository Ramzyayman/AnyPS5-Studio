import * as fs from 'fs';
import * as path from 'path';

export const SELF_MAGIC = 0x1d3d154f;
export const SELF_MAGIC_KERNEL = 0xeef51454;
const RECORD_OFFSET = 0x40;
const RECORD_SIZE = 0x20;
const FIRST_REGION = 0x400;
const PT_LOAD = 1;
const ENTROPY_LIMIT = 7.5;
const ENTROPY_SAMPLE = 0x10000;

export class RefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RefusedError';
  }
}

export interface ElfHeaderEntry {
  index: number;
  type: number;
  flags: number;
  offset: bigint;
  vaddr: bigint;
  size: bigint;
  memory: bigint;
  align: bigint;
  source: bigint;
  host: ElfHeaderEntry | null;
  new?: bigint;
}

interface SelfRecord {
  flags: bigint;
  segment: bigint;
  size: bigint;
}

interface Region {
  old: bigint;
  size: bigint;
  vaddr: bigint;
  align: bigint;
  new?: bigint;
}

function calculateEntropy(data: Buffer): number {
  if (data.length === 0) return 0.0;
  const counts = new Uint32Array(256);
  for (let i = 0; i < data.length; i++) {
    counts[data[i]]++;
  }
  const len = data.length;
  let sum = 0.0;
  for (let i = 0; i < 256; i++) {
    if (counts[i] > 0) {
      const p = counts[i] / len;
      sum += p * Math.log2(p);
    }
  }
  return -sum;
}

function readRecords(data: Buffer): SelfRecord[] {
  const records: SelfRecord[] = [];
  let offset = RECORD_OFFSET;
  const dataLen = BigInt(data.length);
  while (offset + RECORD_SIZE <= FIRST_REGION) {
    const flags = data.readBigUInt64LE(offset);
    const segment = data.readBigUInt64LE(offset + 8);
    const size = data.readBigUInt64LE(offset + 16);
    const sizeAgain = data.readBigUInt64LE(offset + 24);

    if (size === 0n || size !== sizeAgain) break;
    if (segment >= dataLen || segment < 0x350n || segment % 0x10n !== 0n) break;
    if (size > dataLen) break;

    records.push({ flags, segment, size });
    offset += RECORD_SIZE;
  }
  return records;
}

function alignUp(value: bigint, alignment: bigint): bigint {
  if (alignment <= 1n) return value;
  return ((value + alignment - 1n) / alignment) * alignment;
}

function parseElf(data: Buffer): { inner: number; elfHeader: Buffer; headers: ElfHeaderEntry[] } {
  const elfMagic = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
  const inner = data.indexOf(elfMagic);
  if (inner < 0) {
    throw new RefusedError('no inner ELF header');
  }
  if (inner + 0x40 > data.length) {
    throw new RefusedError('inner ELF header is truncated');
  }
  const elfHeader = Buffer.from(data.subarray(inner, inner + 0x40));
  const programOffset = elfHeader.readBigUInt64LE(0x20);
  const entrySize = elfHeader.readUInt16LE(0x36);
  const count = elfHeader.readUInt16LE(0x38);

  if (entrySize !== 56 || count === 0) {
    throw new RefusedError(`program header table is ${count} entries of ${entrySize} bytes`);
  }
  const pOffsetNum = Number(programOffset);
  if (inner + pOffsetNum + count * entrySize > data.length) {
    throw new RefusedError('ELF program header table does not fit the file');
  }

  const headers: ElfHeaderEntry[] = [];
  for (let index = 0; index < count; index++) {
    const offset = inner + pOffsetNum + index * 56;
    const kind = data.readUInt32LE(offset);
    const flags = data.readUInt32LE(offset + 4);
    const fileOffset = data.readBigUInt64LE(offset + 8);
    const vaddr = data.readBigUInt64LE(offset + 16);
    const fileSize = data.readBigUInt64LE(offset + 32);
    const memorySize = data.readBigUInt64LE(offset + 40);
    const alignment = data.readBigUInt64LE(offset + 48);

    if (kind === PT_LOAD) {
      if (fileSize > memorySize) {
        throw new RefusedError(`segment ${index} file size exceeds memory size`);
      }
      if (alignment > 0n && (alignment & (alignment - 1n)) !== 0n) {
        throw new RefusedError(`segment ${index} alignment is not a power of two`);
      }
      const maxUint64 = 0xffffffffffffffffn;
      if (memorySize > maxUint64 - vaddr) {
        throw new RefusedError(`segment ${index} memory range exceeds ELF64`);
      }
    }

    headers.push({
      index,
      type: kind,
      flags,
      offset: fileOffset,
      vaddr,
      size: fileSize,
      memory: memorySize,
      align: alignment,
      source: fileOffset,
      host: null,
    });
  }

  return { inner, elfHeader, headers };
}

function placeSegments(data: Buffer, headers: ElfHeaderEntry[], records: SelfRecord[]): void {
  const loads = headers.filter((h) => h.type === PT_LOAD);
  const used = new Set<number>();

  for (const header of loads) {
    if (header.size === 0n) continue;
    for (let index = 0; index < records.length; index++) {
      if (used.has(index)) continue;
      if (records[index].size === header.size) {
        used.add(index);
        header.source = records[index].segment;
        break;
      }
    }
  }

  function loadFor(vaddr: bigint, size: bigint): ElfHeaderEntry | null {
    for (const header of loads) {
      const end = header.vaddr + header.memory;
      if (header.memory > 0n && header.vaddr <= vaddr && (vaddr < end || (size === 0n && vaddr === end))) {
        return header;
      }
    }
    return null;
  }

  let tail: [bigint, bigint] | null = null;
  for (const header of headers) {
    if (header.type === PT_LOAD) continue;
    if (header.vaddr !== 0n) {
      const host = loadFor(header.vaddr, header.size);
      if (host === null) {
        if (header.size === 0n) {
          header.source = 0n;
          continue;
        }
        throw new RefusedError(`segment ${header.index} vaddr 0x${header.vaddr.toString(16)} is in no PT_LOAD`);
      }
      header.host = host;
      header.source = host.source + (header.vaddr - host.vaddr);
      if (tail === null || header.offset > tail[0]) {
        tail = [header.offset, header.source - header.offset];
      }
    } else if (header.size > 0n) {
      header.source = header.offset + (tail ? tail[1] : 0n);
      const dataLen = BigInt(data.length);
      if (header.source > dataLen) {
        header.source = dataLen;
      }
      const diff = dataLen - header.source;
      const keep = diff > 0n ? diff : 0n;
      if (header.size > keep) header.size = keep;
      if (header.memory > keep) header.memory = keep;
    }
  }

  const dataLen = BigInt(data.length);
  for (const header of headers) {
    if (header.type === PT_LOAD && header.size === 0n) continue;
    if (header.source > dataLen || header.size > dataLen - header.source) {
      throw new RefusedError(`segment ${header.index} does not fit the file`);
    }
  }
}

function checkDecrypted(data: Buffer, headers: ElfHeaderEntry[]): void {
  const encrypted: Array<{ index: number; source: bigint; value: number }> = [];
  const loadHeadersWithContent = headers.filter((h) => h.type === PT_LOAD && h.size > 0n);

  for (const header of headers) {
    if (header.type !== PT_LOAD || header.size === 0n) continue;
    const sampleSize = header.size < BigInt(ENTROPY_SAMPLE) ? Number(header.size) : ENTROPY_SAMPLE;
    const start = Number(header.source);
    const sample = data.subarray(start, start + sampleSize);
    const val = calculateEntropy(sample);
    if (val >= ENTROPY_LIMIT) {
      encrypted.push({ index: header.index, source: header.source, value: val });
    }
  }

  if (encrypted.length > 0 && encrypted.length === loadHeadersWithContent.length) {
    const list = encrypted
      .map((e) => `segment ${e.index} at 0x${e.source.toString(16)} (${e.value.toFixed(2)} bits per byte)`)
      .join(', ');
    throw new RefusedError(`every load segment looks encrypted: ${list}`);
  }
}

export function unwrapSelf(inputPath: string, outputPath: string): number {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);

  if (fs.existsSync(resolvedOut)) {
    try {
      const inStat = fs.statSync(resolvedIn);
      const outStat = fs.statSync(resolvedOut);
      if (inStat.ino && outStat.ino && inStat.ino === outStat.ino && inStat.dev === outStat.dev) {
        throw new RefusedError('output aliases the input container');
      }
    } catch (e) {
      if (e instanceof RefusedError) throw e;
    }
  }
  if (resolvedIn.toLowerCase() === resolvedOut.toLowerCase()) {
    throw new RefusedError('output aliases the input container');
  }

  const data = fs.readFileSync(resolvedIn);
  if (data.length < FIRST_REGION) {
    throw new RefusedError('file is smaller than the SELF header area');
  }

  const magic = data.readUInt32LE(0);
  if (magic !== SELF_MAGIC && magic !== SELF_MAGIC_KERNEL) {
    throw new RefusedError(`not a SELF container (magic 0x${magic.toString(16)})`);
  }

  const records = readRecords(data);
  const { elfHeader, headers } = parseElf(data);
  placeSegments(data, headers, records);
  checkDecrypted(data, headers);

  const regions: Region[] = [];
  for (const header of headers) {
    if (header.type === PT_LOAD && header.size > 0n) {
      regions.push({
        old: header.source,
        size: header.size,
        vaddr: header.vaddr,
        align: header.align,
      });
    }
  }

  function regionFor(offset: bigint, size: bigint): Region | null {
    for (const r of regions) {
      if (r.old <= offset && offset + size <= r.old + r.size) {
        return r;
      }
    }
    return null;
  }

  for (const header of headers) {
    if (header.type === PT_LOAD || header.size === 0n) continue;
    if (regionFor(header.source, header.size) === null) {
      regions.push({
        old: header.source,
        size: header.size,
        vaddr: 0n,
        align: 1n,
      });
    }
  }

  regions.sort((a, b) => (a.old < b.old ? -1 : a.old > b.old ? 1 : 0));

  const programOffset = elfHeader.readBigUInt64LE(0x20);
  const minCursor = BigInt(Math.max(FIRST_REGION, Number(programOffset) + headers.length * 56));
  let cursor = minCursor;

  for (const region of regions) {
    const alignment =
      region.align > 0n && (region.align & (region.align - 1n)) === 0n ? region.align : 1n;
    let placed = alignUp(cursor, alignment);
    const vaddrMod = region.vaddr % alignment;
    const placedMod = placed % alignment;
    if (vaddrMod !== placedMod) {
      placed += ((vaddrMod - placedMod) % alignment + alignment) % alignment;
    }
    region.new = placed;
    cursor = placed + region.size;
  }

  const result = Buffer.alloc(Number(cursor));

  for (const region of regions) {
    const targetStart = Number(region.new!);
    const sourceStart = Number(region.old);
    const sourceEnd = sourceStart + Number(region.size);
    data.copy(result, targetStart, sourceStart, sourceEnd);
  }

  for (const header of headers) {
    if (header.size === 0n && (header.type === PT_LOAD || header.source === 0n)) {
      header.new = 0n;
      continue;
    }
    const region = regionFor(header.source, header.size);
    header.new = region === null ? header.source : region.new! + (header.source - region.old);
    if (header.new + header.size > BigInt(result.length)) {
      throw new RefusedError(`segment ${header.index} escaped the output`);
    }
  }

  elfHeader.copy(result, 0, 0, 0x40);
  result.writeBigUInt64LE(0n, 0x28);
  result.writeUInt16LE(0, 0x3c);
  result.writeUInt16LE(0, 0x3e);

  const pOffsetNum = Number(programOffset);
  for (const item of headers) {
    const pos = pOffsetNum + item.index * 56;
    result.writeUInt32LE(item.type, pos);
    result.writeUInt32LE(item.flags, pos + 4);
    result.writeBigUInt64LE(item.new!, pos + 8);
    result.writeBigUInt64LE(item.vaddr, pos + 16);
    result.writeBigUInt64LE(item.vaddr, pos + 24);
    result.writeBigUInt64LE(item.size, pos + 32);
    result.writeBigUInt64LE(item.memory, pos + 40);
    result.writeBigUInt64LE(item.align, pos + 48);
  }

  const outDir = path.dirname(resolvedOut);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(resolvedOut, result);
  return result.length;
}
