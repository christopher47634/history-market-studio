"""角色卡素材的第二步：压缩头像、生成前端用的角色数据。
- public/portraits/ 下的原图统一转成 240px 宽的 WebP（约十几 KB），删除原图。
- 从 data/v2/portraits.json 生成 src/v2/roles.generated.js：简介截到整句，
  brief = 悬停卡片用的一两句，intro = 完整角色卡用的导语。
用法：python pipeline/roles.py   （先跑 node pipeline/fetch-portraits.mjs）
"""
import json, re, pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMG = ROOT / "public" / "portraits"
store = json.loads((ROOT / "data/v2/portraits.json").read_text(encoding="utf-8"))

for src in list(IMG.glob("*")):
    if src.suffix.lower() == ".webp":
        continue
    try:
        im = Image.open(src)
        im.load()
    except OSError:
        continue  # 还在下载中 / 损坏，下次再转
    im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
    if im.width > 240:
        im = im.resize((240, round(im.height * 240 / im.width)), Image.LANCZOS)
    out = src.with_suffix(".webp")
    q = 74
    im.save(out, "WEBP", quality=q, method=6)
    while out.stat().st_size > 38 * 1024 and q > 40:  # 长图、细节多的画像再压一压，单张不超 38KB
        q -= 8
        im.save(out, "WEBP", quality=q, method=6)
    src.unlink()

def cut(text, limit):
    """截到 limit 字以内的最后一个句号（没有句号就硬截加省略号）。"""
    text = re.sub(r"\s+", "", text.split("\n")[0] if len(text.split("\n")[0]) > 40 else text.replace("\n", ""))
    if len(text) <= limit:
        return text
    head = text[:limit]
    stop = max(head.rfind("。"), head.rfind("；"))
    return head[: stop + 1] if stop > limit * 0.45 else head.rstrip("，、；：") + "…"

roles = {}
intros = {}
for pid, v in store.items():
    if v.get("miss"):
        continue
    img = v.get("img")
    if img:
        webp = IMG / f"{pid}.webp"
        if webp.exists():
            w, h = Image.open(webp).size
            img = {**img, "src": f"portraits/{pid}.webp", "w": w, "h": h}
        else:
            img = None
    roles[pid] = {
        "title": v["title"], "revid": v.get("revid"), "date": v.get("date"),
        "brief": cut(v["extract"], 88),
        **({"img": img} if img else {}),
    }
    # 完整导语进每人的按需数据分包（pipeline/client-index.mjs 合进 data/v2/client/<id>.json），不进角色包。
    intros[pid] = cut(v["extract"].replace("\n", ""), 360)

(ROOT / "data/v2/role-intros.json").write_text(json.dumps(intros, ensure_ascii=False, indent=0), encoding="utf-8")

out = ROOT / "src/v2/roles.generated.js"
out.write_text("// 由 pipeline/roles.py 生成，勿手改。维基百科导语 CC BY-SA 4.0；头像来自 Wikimedia Commons，许可见各条。\nexport default " + json.dumps(roles, ensure_ascii=False) + ";\n", encoding="utf-8")
size = sum(p.stat().st_size for p in IMG.glob("*.webp"))
print(f"角色 {len(roles)} 人，头像 {sum(1 for r in roles.values() if 'img' in r)} 张（共 {size / 1024:.0f} KB）→ {out.relative_to(ROOT)}（{out.stat().st_size / 1024:.0f} KB）")
