#!/usr/bin/env python3
"""Minimal 7z extractor (LZMA / LZMA2 / BCJ / Copy / Delta) using Python's lzma module.
Usage: un7z.py archive.7z outdir [--list]
"""
import sys, os, struct, lzma, zlib, bz2

class R:
    def __init__(s, b): s.b = b; s.p = 0
    def byte(s): v = s.b[s.p]; s.p += 1; return v
    def bytes(s, n): v = s.b[s.p:s.p+n]; s.p += n; return v
    def num(s):
        first = s.byte(); mask = 0x80; val = 0
        for i in range(8):
            if first & mask == 0:
                hi = first & (mask - 1)
                return val | (hi << (8 * i))
            val |= s.byte() << (8 * i)
            mask >>= 1
        return val
    def u32(s): return struct.unpack('<I', s.bytes(4))[0]
    def u64(s): return struct.unpack('<Q', s.bytes(8))[0]

def bits(r, n, allcheck=True):
    if allcheck:
        a = r.byte()
        if a: return [True] * n
    out = []; mask = 0; cur = 0
    for i in range(n):
        if mask == 0: cur = r.byte(); mask = 0x80
        out.append(bool(cur & mask)); mask >>= 1
    return out

def read_pack_info(r):
    pack_pos = r.num(); n = r.num(); sizes = []; crcs = None
    while True:
        t = r.byte()
        if t == 0: break
        if t == 9: sizes = [r.num() for _ in range(n)]
        elif t == 10:
            d = bits(r, n); crcs = [r.u32() if x else None for x in d]
        else: raise Exception('packinfo %d' % t)
    return pack_pos, sizes

def read_folder(r):
    nc = r.num(); coders = []
    for _ in range(nc):
        flag = r.byte(); idsize = flag & 0xF
        cid = r.bytes(idsize)
        ni = no = 1
        if flag & 0x10: ni = r.num(); no = r.num()
        props = b''
        if flag & 0x20: props = r.bytes(r.num())
        coders.append(dict(id=cid, ni=ni, no=no, props=props))
    tot_out = sum(c['no'] for c in coders); tot_in = sum(c['ni'] for c in coders)
    bonds = [(r.num(), r.num()) for _ in range(tot_out - 1)]
    npacked = tot_in - len(bonds)
    packed = [r.num() for _ in range(npacked)] if npacked > 1 else None
    if packed is None:
        bound_in = {b[0] for b in bonds}
        packed = [i for i in range(tot_in) if i not in bound_in]
    return dict(coders=coders, bonds=bonds, packed=packed, tot_out=tot_out)

def read_unpack_info(r):
    assert r.byte() == 0x0B
    nf = r.num(); assert r.byte() == 0
    folders = [read_folder(r) for _ in range(nf)]
    assert r.byte() == 0x0C
    for f in folders: f['usizes'] = [r.num() for _ in range(f['tot_out'])]
    t = r.byte()
    if t == 10:
        d = bits(r, nf)
        for f, x in zip(folders, d): f['crc'] = r.u32() if x else None
        t = r.byte()
    assert t == 0
    return folders

def folder_usize(f):
    bound_out = {b[1] for b in f['bonds']}
    for i in range(f['tot_out']):
        if i not in bound_out: return f['usizes'][i]

def read_substreams(r, folders):
    nums = [1] * len(folders); sizes = []; t = r.byte()
    if t == 0x0D:
        nums = [r.num() for _ in folders]; t = r.byte()
    if t == 0x09:
        for f, n in zip(folders, nums):
            if n == 0: continue
            s = 0
            for _ in range(n - 1):
                v = r.num(); sizes.append(v); s += v
            sizes.append(folder_usize(f) - s)
        t = r.byte()
    else:
        for f, n in zip(folders, nums):
            if n == 1: sizes.append(folder_usize(f))
    while t != 0:
        if t == 0x0A:
            ndig = sum(n for f, n in zip(folders, nums) if not (n == 1 and f.get('crc') is not None))
            d = bits(r, ndig)
            for x in d:
                if x: r.u32()
        else: raise Exception('substream %d' % t)
        t = r.byte()
    return nums, sizes

def read_streams_info(r):
    pack = None; folders = []; sub = None
    while True:
        t = r.byte()
        if t == 0: break
        if t == 6: pack = read_pack_info(r)
        elif t == 7: folders = read_unpack_info(r)
        elif t == 8: sub = read_substreams(r, folders)
        else: raise Exception('streams %d' % t)
    if sub is None: sub = ([1] * len(folders), [folder_usize(f) for f in folders])
    return pack, folders, sub

def decode_coder(c, data, usize):
    cid = c['id']
    if cid == b'\x00': return data
    if cid == b'\x21':
        dsz = c['props'][0]
        filt = [{'id': lzma.FILTER_LZMA2, 'dict_size': lzma_dict(dsz)}]
        return lzma.LZMADecompressor(lzma.FORMAT_RAW, filters=filt).decompress(data)[:usize]
    if cid == b'\x03\x01\x01':
        p = c['props']; d = p[0]
        lc = d % 9; d //= 9; lp = d % 5; pb = d // 5
        ds = struct.unpack('<I', p[1:5])[0]
        filt = [{'id': lzma.FILTER_LZMA1, 'lc': lc, 'lp': lp, 'pb': pb, 'dict_size': ds}]
        dec = lzma.LZMADecompressor(lzma.FORMAT_RAW, filters=filt)
        return dec.decompress(data, max_length=usize)
    if cid == b'\x03\x03\x01\x03':
        return lzma.LZMADecompressor(lzma.FORMAT_RAW, filters=[{'id': lzma.FILTER_X86}]).decompress(data)
    if cid == b'\x03':
        dist = c['props'][0] + 1 if c['props'] else 1
        return lzma.LZMADecompressor(lzma.FORMAT_RAW, filters=[{'id': lzma.FILTER_DELTA, 'dist': dist}]).decompress(data)
    if cid == b'\x04\x01\x08': return zlib.decompress(data, -15)
    if cid == b'\x04\x02\x02': return bz2.decompress(data)
    raise Exception('unsupported coder %s' % cid.hex())

def lzma_dict(b):
    if b == 40: return 0xFFFFFFFF
    return (2 | (b & 1)) << (b // 2 + 11)

def decode_folder(f, packstreams):
    # resolve coder graph: find main output (unbound), recursively decode
    coders = f['coders']
    in_index = []; out_index = []; ii = oi = 0
    for c in coders:
        in_index.append(ii); out_index.append(oi); ii += c['ni']; oi += c['no']
    def coder_of_out(o):
        for k, c in enumerate(coders):
            if out_index[k] <= o < out_index[k] + c['no']: return k
    def input_data(inp):
        if inp in f['packed']: return packstreams[f['packed'].index(inp)]
        for a, b in f['bonds']:
            if a == inp: return out_data(b)
        raise Exception('unbound input')
    def out_data(o):
        k = coder_of_out(o); c = coders[k]
        if c['ni'] != 1: raise Exception('multi-input coder (BCJ2) unsupported')
        return decode_coder(c, input_data(in_index[k]), f['usizes'][o])
    bound_out = {b[1] for b in f['bonds']}
    main = [i for i in range(f['tot_out']) if i not in bound_out][0]
    return out_data(main)

def decode_streams(fh, base, pack, folders):
    pack_pos, sizes = pack; pos = base + pack_pos; si = 0; outs = []
    for f in folders:
        ps = []
        for _ in f['packed']:
            fh.seek(pos); ps.append(fh.read(sizes[si])); pos += sizes[si]; si += 1
        outs.append(decode_folder(f, ps))
    return outs

def read_files_info(r):
    n = r.num(); files = [dict() for _ in range(n)]
    empty = [False] * n; emptyfile = [];
    while True:
        t = r.byte()
        if t == 0: break
        size = r.num(); end = r.p + size
        if t == 0x0E: empty = bits(r, n, allcheck=False)
        elif t == 0x0F: emptyfile = bits(r, sum(empty), allcheck=False)
        elif t == 0x11:
            ext = r.byte(); assert ext == 0
            raw = r.bytes(size - 1).decode('utf-16-le')
            for f, name in zip(files, raw.split('\x00')): f['name'] = name
        elif t == 0x15:
            d = bits(r, n); ext = r.byte(); assert ext == 0
            for f, x in zip(files, d):
                if x: f['attr'] = r.u32()
        r.p = end
    ei = 0
    for i, f in enumerate(files):
        f['empty'] = empty[i]
        if empty[i]:
            f['isdir'] = not (emptyfile[ei] if ei < len(emptyfile) else False); ei += 1
        else: f['isdir'] = False
        if 'attr' in f and f['attr'] & 0x10: f['isdir'] = True
    return files

def main():
    path, out = sys.argv[1], sys.argv[2]; listonly = '--list' in sys.argv
    fh = open(path, 'rb'); sig = fh.read(32)
    off, size = struct.unpack('<QQ', sig[12:28]); base = 32
    fh.seek(base + off); hdr = fh.read(size)
    r = R(hdr); t = r.byte()
    while t == 0x17:
        pack, folders, _ = read_streams_info(r)
        hdr = decode_streams(fh, base, pack, folders)[0]
        r = R(hdr); t = r.byte()
    assert t == 0x01
    t = r.byte(); pack = folders = sub = None; files = []
    while t != 0:
        if t == 0x04: pack, folders, sub = read_streams_info(r)
        elif t == 0x05: files = read_files_info(r)
        elif t == 0x02 or t == 0x03: raise Exception('archive props unsupported')
        t = r.byte()
    if listonly:
        for f in files: print(('D ' if f['isdir'] else 'F ') + f['name'])
        return
    nums, sizes = sub
    fi = 0; si = 0
    def target(name):
        p = os.path.normpath(os.path.join(out, name.replace('\\', '/')))
        if not p.startswith(os.path.abspath(out)): raise Exception('bad path ' + name)
        return p
    out = os.path.abspath(out)
    nonempty = [f for f in files if not f['empty']]
    pack_pos, psizes = pack; pos = base + pack_pos; pi = 0
    for k, fo in enumerate(folders):
        ps = []
        for _ in fo['packed']:
            fh.seek(pos); ps.append(fh.read(psizes[pi])); pos += psizes[pi]; pi += 1
        data = decode_folder(fo, ps); o = 0
        for _ in range(nums[k]):
            f = nonempty[fi]; fi += 1; sz = sizes[si]; si += 1
            p = target(f['name']); os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'wb') as w: w.write(data[o:o + sz])
            o += sz
        del data
    for f in files:
        if f['empty']:
            p = target(f['name'])
            if f['isdir']: os.makedirs(p, exist_ok=True)
            else:
                os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'wb').close()
    print('extracted', len(files), 'entries')

main()
