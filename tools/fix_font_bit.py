# -*- coding: utf-8 -*-
import json, re, base64

p = r'D:\CMIT-zisheng\js\evo-index.js'
s = open(p, encoding='utf-8').read()
chars = json.loads(re.search(r'EVO_CHARS = ("(?:[^"\\]|\\.)*");', s).group(1))
b64 = re.search(r'EVO_BITS = "([^"]+)"', s).group(1)
bits = bytearray(base64.b64decode(b64))
changed = 0
for i, ch in enumerate(chars):
    cp = ord(ch)
    # 只对实际有字体分块/基础档覆盖的 BMP CJK 区间标记 bit5（3400-9FFF）
    if not (0x3400 <= cp <= 0x9FFF) and (bits[i] & 0x20):
        bits[i] &= ~0x20
        changed += 1
print('bit5 cleared:', changed)
new_b64 = base64.b64encode(bytes(bits)).decode()
s = s.replace('export const EVO_BITS = "' + b64 + '";', 'export const EVO_BITS = "' + new_b64 + '";')
open(p, 'w', encoding='utf-8').write(s)
print('index updated')
