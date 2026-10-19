"""朝代字体：给不同年代的人物配不同风格的中文字体（分组见 src/v3/eras.json）。
- 人名用该时代风格的标题字（毛笔楷书、行书、宋风标题字、明刻本宋体……），只裁出该组人物名字里的字，每款一个小文件。
- 简介、K 线卡片、阅读面板用好读的正文字（霞鹜文楷 / 霞鹜新致宋），只裁该组人物的数据里出现的字，按字频分片。
- 全部是开源可再分发的字体：OFL 1.1（马善政、志莽行书、站酷小薇、霞鹜文楷）和 IPA 1.0（霞鹜新致宋）。
  裁剪后改名为 HMS ×××（两种许可都要求改动后的字体换名），许可证和来源一并放进 public/fonts/era/。
源文件：E:\\Claude local\\fonts-src（马善政、志莽行书、站酷小薇、新致宋，从 Google Fonts / GitHub 下载）+ 系统字体目录里的霞鹜文楷；
也可用环境变量 HMS_FONTS_SRC 指定目录。输出：public/fonts/era/*.woff2、src/v3/era-fonts.css。
用法：python pipeline/era-fonts.py     （数据改了以后重跑；test:ui 会检查人名有没有字没覆盖到）
"""
import collections, io, json, os, pathlib, re, shutil
from fontTools.ttLib import TTFont
from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "fonts" / "era"
SRC = pathlib.Path(os.environ.get("HMS_FONTS_SRC") or r"E:\Claude local\fonts-src")
SLICE = 320
PUNCT = "·—–‘’“”…、。，；：？！「」『』（）《》〈〉【】〔〕～"
ERAS = json.loads((ROOT / "src/v3/eras.json").read_text(encoding="utf-8"))

def find(name):
    for d in (SRC, pathlib.Path(r"C:\Windows\Fonts"), pathlib.Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/Windows/Fonts"):
        if (d / name).exists():
            return d / name
    raise SystemExit(f"找不到字体源文件 {name}（放进 {SRC} 或设 HMS_FONTS_SRC）")

def js_default(path):
    """读 `export default {...};` 形式的生成文件。"""
    t = path.read_text(encoding="utf-8")
    return json.loads(t[t.index("export default") + len("export default"):].strip().rstrip(";"))

index = js_default(ROOT / "src/v2/index.generated.js")
roles = js_default(ROOT / "src/v2/roles.generated.js")
group_of = {d: g for g, v in ERAS["groups"].items() for d in v["dynasties"]}
is_cjk = lambda c: ord(c) >= 0x2E80

# 每组人物：名字里的字（给标题字）和数据里的全部字（给正文字）。
names, texts = collections.defaultdict(str), collections.defaultdict(collections.Counter)
for f in index:
    g = group_of.get(f["dynasty"], "jin")
    names[g] += f["name"]
    client = ROOT / "data/v2/client" / f"{f['id']}.json"
    blob = (client.read_text(encoding="utf-8") if client.exists() else "") + json.dumps(f, ensure_ascii=False) + json.dumps(roles.get(f["id"], {}), ensure_ascii=False)
    texts[g].update(c for c in blob if is_cjk(c))

def woff2(path, text, features=("kern", "palt", "vpal", "liga")):
    f = TTFont(path)
    opt = subset.Options()
    opt.flavor = "woff2"
    opt.layout_features = list(features)
    opt.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    opt.notdef_outline = True
    s = subset.Subsetter(opt)
    s.populate(text=text)
    s.subset(f)
    out = io.BytesIO(); f.flavor = "woff2"; f.save(out)
    return out.getvalue()

def ranges(chars):
    cps = sorted(set(ord(c) for c in chars))
    out, start, prev = [], cps[0], cps[0]
    for cp in cps[1:] + [None]:
        if cp is not None and cp == prev + 1:
            prev = cp; continue
        out.append(f"U+{start:X}" if start == prev else f"U+{start:X}-{prev:X}")
        if cp is not None:
            start = prev = cp
    return ", ".join(out)

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
faces = []  # (file, family, weight, unicode-range, bytes)
slug = lambda fam: fam.replace("HMS ", "").lower()

# 标题字：每款一个文件，只含用它当人名字体的那几组人物的名字。
for fam, spec in ERAS["faces"].items():
    groups = [g for g, v in ERAS["groups"].items() if v["name"] == fam]
    chars = "".join(sorted(set("".join(names[g] for g in groups))))
    if not chars:
        continue
    weight = max(ERAS["groups"][g]["nameWeight"] for g in groups)
    # 同一款字既当人名字又当正文字、字重也一样时，名字里的字已经在正文分片里了，不再单出一个文件。
    if weight == 400 and any(v["text"] == fam for v in ERAS["groups"].values()):
        continue
    src = find(spec["srcBold"] if weight >= 500 and spec.get("srcBold") else spec["src"])
    data = woff2(src, chars + "·")
    name = f"{slug(fam)}-name.woff2"
    (OUT / name).write_bytes(data)
    faces.append((name, fam, weight, ranges(chars + "·"), len(data)))

# 正文字：用它当正文字体的那几组人物数据里的全部汉字，按字频分片。
for fam, spec in ERAS["faces"].items():
    groups = [g for g, v in ERAS["groups"].items() if v["text"] == fam]
    if not groups:
        continue
    freq = sum((texts[g] for g in groups), collections.Counter())
    ranked = [c for c, _ in freq.most_common()]
    slices = [ranked[i:i + SLICE] for i in range(0, len(ranked), SLICE)]
    slices[0] = list(dict.fromkeys(slices[0] + list(PUNCT)))
    src = find(spec["src"])
    for i, chars in enumerate(slices):
        text = "".join(chars)
        data = woff2(src, text)
        name = f"{slug(fam)}-{i}.woff2"
        (OUT / name).write_bytes(data)
        faces.append((name, fam, 400, ranges(text), len(data)))

css = ["/* 由 pipeline/era-fonts.py 生成，勿手改。朝代字体（分组见 eras.json）；许可证与来源见 /fonts/era/LICENSES.md。 */"]
for name, fam, weight, urange, _ in faces:
    # size-adjust：有的字体字面偏小（志莽行书），按比例放大到和别的字视觉上一样大。
    adj = ERAS["faces"][fam].get("sizeAdjust")
    css.append(f'@font-face {{ font-family: "{fam}"; src: url("/fonts/era/{name}") format("woff2"); font-weight: {weight}; font-style: normal; font-display: swap; {f"size-adjust: {adj}; " if adj else ""}unicode-range: {urange}; }}')
(ROOT / "src/v3/era-fonts.css").write_text("\n".join(css) + "\n", encoding="utf-8")

# 许可证：OFL 全文、IPA 全文，加一份说明（来源、改动、改名）。
lic = ["# 朝代字体的来源与许可", "", "这些文件是对下列开源字体的子集化版本（只保留本站用到的字，转成 WOFF2），按许可要求改名为 HMS ×××。", ""]
for fam, spec in ERAS["faces"].items():
    lic.append(f"- {fam} ← {spec['origin']}，许可：{spec['license']}")
lic += ["", "改动：仅子集化与格式转换，未改动字形。原始字体可从上面的地址获取。", "OFL 1.1 全文见 OFL.txt；IPA Font License 1.0 全文见 IPA-LICENSE.md。"]
(OUT / "LICENSES.md").write_text("\n".join(lic) + "\n", encoding="utf-8")
shutil.copy(find("OFL-MaShanZheng.txt"), OUT / "OFL.txt")
shutil.copy(find("LICENSE-LXGWNeoZhiSong.md"), OUT / "IPA-LICENSE.md")
total = sum(f[4] for f in faces)
print(f"朝代字体：{len(faces)} 个文件，共 {total / 1024:.0f} KB，最大 {max(f[4] for f in faces) / 1024:.0f} KB；" + "，".join(f"{g}={len(set(names[g]))}字名" for g in ERAS["groups"]))
