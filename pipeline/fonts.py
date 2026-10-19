"""自托管字体：把开源字体裁成本站用得到的字，按 unicode-range 分片，浏览器只下载屏幕上出现的那几片。
- 标题/人名/引文：思源宋体可变字体 Noto Serif SC（SIL OFL 1.1），字重轴截到 400–800。
  按字频排序后每 320 字一片：常用字集中在前几片，生僻字所在的片只有用到时才下载。
- 数字与西文：Inter 可变字体（SIL OFL 1.1），只留拉丁字符和常用符号，保留 tnum（等宽数字）。
输出：public/fonts/*.woff2、src/v3/fonts.css（@font-face 列表）、public/fonts/OFL.txt。
源字体用本机已安装的文件（C:\\Windows\\Fonts），也可以用环境变量 HMS_SERIF / HMS_LATIN 指定。
用法：python pipeline/fonts.py      （数据或界面文字改了以后重跑；test:ui 会检查有没有字没覆盖到）
"""
import collections, io, os, pathlib
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "fonts"
def installed(name):
    """系统字体目录或当前用户的字体目录里找。"""
    for d in (pathlib.Path(r"C:\Windows\Fonts"), pathlib.Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/Windows/Fonts"):
        if (d / name).exists():
            return d / name
    raise SystemExit(f"找不到字体 {name}，请用环境变量指定路径")
SERIF = pathlib.Path(os.environ.get("HMS_SERIF") or installed("NotoSerifSC-VF.ttf"))
LATIN = pathlib.Path(os.environ.get("HMS_LATIN") or installed("InterVariable.ttf"))
SANS = pathlib.Path(os.environ.get("HMS_SANS") or installed("NotoSansSC-VF.ttf"))
SLICE = 320
ASCII = "".join(chr(c) for c in range(0x20, 0x7F))
PUNCT = "·—–‘’“”…、。，；：？！「」『』（）《》〈〉【】〔〕～×→←↑↓↗＋－％"

def is_cjk(c):
    return ord(c) >= 0x2E80

# 全站会显示的中文：界面源码（含字符串）、人物索引、角色简介、每人的按需数据。
texts = [p.read_text(encoding="utf-8") for p in (ROOT / "src").rglob("*") if p.suffix in (".js", ".jsx") and p.name != "figures.generated.js"]
texts += [p.read_text(encoding="utf-8") for p in (ROOT / "data/v2/client").glob("*.json")]
texts.append((ROOT / "index.html").read_text(encoding="utf-8"))
freq = collections.Counter(c for t in texts for c in t if is_cjk(c))
ranked = [c for c, _ in freq.most_common()]
slices = [ranked[i:i + SLICE] for i in range(0, len(ranked), SLICE)]
slices[0] = sorted(set(slices[0]) | set(PUNCT), key=lambda c: -freq.get(c, 10**9))

def ranges(chars):
    """码位列表 → 紧凑的 unicode-range（连续码位合并）。"""
    cps = sorted(set(ord(c) for c in chars))
    out, start, prev = [], cps[0], cps[0]
    for cp in cps[1:] + [None]:
        if cp is not None and cp == prev + 1:
            prev = cp
            continue
        out.append(f"U+{start:X}" if start == prev else f"U+{start:X}-{prev:X}")
        if cp is not None:
            start = prev = cp
    return ", ".join(out)

def woff2(font, text, features):
    buf = io.BytesIO(); font.save(buf); buf.seek(0)
    f = TTFont(buf)
    opt = subset.Options()
    opt.flavor = "woff2"
    opt.layout_features = features
    opt.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    opt.notdef_outline = True
    s = subset.Subsetter(opt)
    s.populate(text=text)
    s.subset(f)
    out = io.BytesIO(); f.flavor = "woff2"; f.save(out)
    return out.getvalue()

OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob("hms-*.woff2"):
    old.unlink()

faces = []
serif = instancer.instantiateVariableFont(TTFont(SERIF), {"wght": (400, 800)})
for i, chars in enumerate(slices):
    text = "".join(chars) + (ASCII if i == 0 else "")
    data = woff2(serif, text, ["kern", "palt", "vpal", "liga"])
    name = f"hms-serif-{i}.woff2"
    (OUT / name).write_bytes(data)
    faces.append((name, "HMS Serif", "400 800", ranges(text), len(data)))

# 界面小字：思源黑体可变字体 Noto Sans SC（OFL），字重轴 400–600。Windows 上中文小字默认落到微软雅黑，10–12px 发虚；
# 换成同一套分片后各平台一致、小字清楚。西文和数字仍走前面的 Inter（字体栈里 HMS Latin 排在前面）。
sans = instancer.instantiateVariableFont(TTFont(SANS), {"wght": (400, 600)})
for i, chars in enumerate(slices):
    text = "".join(chars)
    data = woff2(sans, text, ["kern", "palt", "vpal"])
    name = f"hms-sans-{i}.woff2"
    (OUT / name).write_bytes(data)
    faces.append((name, "HMS Sans", "400 600", ranges(text), len(data)))

latin = TTFont(LATIN)
axes = {a.axisTag: a for a in latin["fvar"].axes}
pin = {"wght": (300, 700)}
if "opsz" in axes:
    pin["opsz"] = 14
latin = instancer.instantiateVariableFont(latin, pin)
lat_text = ASCII + "".join(chr(c) for c in range(0xA0, 0x100)) + "–—‘’“”…·•→←↑↓↗−×÷±≈≤≥€£¥%‰"
data = woff2(latin, lat_text, ["kern", "liga", "calt", "tnum", "case", "ss01", "cv11", "zero"])
(OUT / "hms-latin.woff2").write_bytes(data)
faces.append(("hms-latin.woff2", "HMS Latin", "300 700", ranges(lat_text), len(data)))

css = ["/* 由 pipeline/fonts.py 生成，勿手改。字体：Noto Serif SC、Noto Sans SC、Inter，均为 SIL Open Font License 1.1（见 /fonts/OFL.txt）。 */"]
for name, family, weight, urange, _ in faces:
    css.append(f'@font-face {{ font-family: "{family}"; src: url("/fonts/{name}") format("woff2"); font-weight: {weight}; font-style: normal; font-display: swap; unicode-range: {urange}; }}')
(ROOT / "src/v3/fonts.css").write_text("\n".join(css) + "\n", encoding="utf-8")
(OUT / "OFL.txt").write_text(
    "Noto Serif SC, Noto Sans SC — Copyright 2017–2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'.\n"
    "Inter — Copyright (c) 2016 The Inter Project Authors (https://github.com/rsms/inter).\n"
    "Both fonts are licensed under the SIL Open Font License, Version 1.1: https://openfontlicense.org\n"
    "The files here are subsets made by pipeline/fonts.py and are renamed (HMS Serif / HMS Sans / HMS Latin) as the licence requires for modified versions.\n",
    encoding="utf-8",
)
total = sum(f[4] for f in faces)
print(f"字体：宋体、黑体各 {len(slices)} 片（{len(ranked)} 字），西文 1 片；共 {total / 1024:.0f} KB，最大一片 {max(f[4] for f in faces) / 1024:.0f} KB")
