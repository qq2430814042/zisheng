import json, zstandard

MAGIC = b"CEDS0002"


class CEDReader:
    def __init__(self, path):
        self.bytes = open(path, "rb").read()
        assert self.bytes[:8] == MAGIC, "bad magic"
        hlen = int.from_bytes(self.bytes[8:12], "little")
        self.header = json.loads(zstandard.ZstdDecompressor().decompress(self.bytes[12:12 + hlen]))
        self.body = 12 + hlen
        keys = self.header["keys"].split("\n") if self.header["keys"] else []
        widths, heights, chans = self.header["widths"], self.header["heights"], self.header["channels"]
        bs = self.header["blockSize"]
        self.entries = {}
        self.order = []
        off = 0
        for i, k in enumerate(keys):
            if i % bs == 0:
                off = 0
            w, h, c = widths[i], heights[i], chans[i]
            ln = w * h * c
            self.entries[k] = (i // bs, off, ln, w, h, c)
            self.order.append(k)
            off += ln
        self.chars = self.header.get("characters") or {}
        self._cache = {}
        self._dctx = zstandard.ZstdDecompressor()

    def block(self, idx):
        if idx in self._cache:
            return self._cache[idx]
        ref = self.header["blocks"][idx]
        s = self.body + ref["fileOffset"]
        raw = self._dctx.decompress(self.bytes[s:s + ref["compressedLength"]],
                                    max_output_size=ref.get("rawLength", 1 << 31))
        if len(self._cache) > 12:
            self._cache.pop(next(iter(self._cache)))
        self._cache[idx] = raw
        return raw

    def raw(self, key):
        b, off, ln, w, h, c = self.entries[key]
        return w, h, c, self.block(b)[off:off + ln]

    def keys_for(self, ch):
        for cid, c in self.chars.items():
            if c == ch:
                return [k for k in self.order if k.startswith(cid + "/")]
        return []

    def glyphs_for(self, ch):
        ORDER = {"O_": 0, "J_": 1, "W_": 2, "Z_": 3, "L_": 4, "K_": 5, "X_": 5}
        out = []
        for k in self.keys_for(ch):
            fn = k.split("/")[-1]
            pre = fn[:2]
            out.append((k, ORDER.get(pre, 6)))
        return sorted(out, key=lambda t: (t[1], t[0]))

    def chars_with_id(self):
        return list(self.chars.values())
