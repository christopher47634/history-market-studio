"""把整个项目打成一个完整备份包（文件夹 + 同名 zip），放在项目上一级目录。

用法：python scripts/make-package.py            （先 npm run build，保证 05-已构建网站 是最新的）
输出：<上一级>/历史行情局-完整项目包-<日期>/ 和同名 .zip；同名旧包会被替换，其它日期的旧包会删掉，只留最新一份。
"""
import csv, datetime, hashlib, json, os, pathlib, shutil, subprocess, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
FONTS_SRC = pathlib.Path(os.environ.get("HMS_FONTS_SRC", ROOT.parent / "fonts-src"))
NAME_PREFIX = "历史行情局-完整项目包-"
OUT = ROOT.parent / f"{NAME_PREFIX}{datetime.date.today():%Y-%m-%d}"
SKIP_DIRS = {"node_modules", "dist", "work", ".git", ".claude", ".vercel", "__pycache__"}


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True).stdout.strip()


def copytree(src, dst, skip_dirs=(), skip_ext=()):
    n = 0
    for d, dirs, files in os.walk(src):
        dirs[:] = [x for x in dirs if x not in skip_dirs]
        for f in files:
            if f.endswith(".log") or f.lower().endswith(skip_ext):
                continue
            s = pathlib.Path(d) / f
            t = dst / s.relative_to(src)
            t.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(s, t)
            n += 1
    return n


if not (ROOT / "dist" / "client" / "index.html").exists():
    raise SystemExit("先跑 npm run build")
head = git("log", "--oneline", "-1")
if git("status", "--porcelain", "--untracked-files=no"):
    print("提醒：有未提交的改动，版本历史里不会包含它们（01-项目源码 里有）。")

# 清掉旧包（只删本脚本生成的、名字以前缀开头的）
for old in ROOT.parent.glob(f"{NAME_PREFIX}*"):
    shutil.rmtree(old) if old.is_dir() else old.unlink()

counts = {}
counts["01-项目源码"] = copytree(ROOT, OUT / "01-项目源码", SKIP_DIRS)
(OUT / "02-版本历史").mkdir(parents=True)
git("bundle", "create", str(OUT / "02-版本历史" / "history-market-studio.bundle"), "--all")
git("bundle", "verify", str(OUT / "02-版本历史" / "history-market-studio.bundle"))
counts["02-版本历史"] = 1

pdir = OUT / "03-头像图片与出处"
counts["03-头像图片与出处"] = copytree(ROOT / "public" / "portraits", pdir / "portraits")
shutil.copy2(ROOT / "data" / "v2" / "portraits.json", pdir / "portraits.json")
for f in ["pipeline/fetch-portraits.mjs", "pipeline/set-commons-portrait.mjs", "pipeline/set-baike-portraits.mjs", "pipeline/roles.py",
          "work/baike-cands.mjs", "work/baike-dl.mjs", "work/cand-ids.json", "work/cand-sheet.py", "work/picks.json"]:
    if (ROOT / f).exists():
        shutil.copy2(ROOT / f, pdir / pathlib.Path(f).name)
records = json.loads((ROOT / "data" / "v2" / "portraits.json").read_text(encoding="utf-8"))
with open(pdir / "头像出处清单.csv", "w", encoding="utf-8-sig", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["id", "姓名", "头像文件", "来源", "原始页面", "作者", "许可", "是否在包内"])
    for pid, r in records.items():
        i = r.get("img")
        if not i:
            w.writerow([pid, r.get("title"), "", "（没有头像）", "", "", "", ""])
            continue
        webp = pdir / "portraits" / (pathlib.Path(i["src"]).stem + ".webp")
        w.writerow([pid, r.get("title"), i["src"], "百度百科" if i.get("source") == "baike" else "维基共享资源",
                    i.get("page", ""), i.get("artist", ""), i.get("license", ""), "是" if webp.exists() else "否"])

counts["04-字体源文件"] = copytree(FONTS_SRC, OUT / "04-字体源文件") if FONTS_SRC.exists() else 0
counts["05-已构建网站"] = copytree(ROOT / "dist", OUT / "05-已构建网站")
counts["06-工作脚本与调研记录"] = copytree(ROOT / "work", OUT / "06-工作脚本与调研记录", {"k", "blocks"}, (".png", ".jpg", ".jpeg", ".webp"))

readme = (ROOT / "scripts" / "package-readme.md").read_text(encoding="utf-8").replace("{{HEAD}}", head).replace("{{DATE}}", f"{datetime.date.today():%Y-%m-%d}")
(OUT / "00-请先读我.md").write_text(readme, encoding="utf-8")

zp = OUT.with_suffix(".zip")
with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for d, _, files in os.walk(OUT):
        for f in files:
            p = pathlib.Path(d) / f
            z.write(p, (pathlib.Path(OUT.name) / p.relative_to(OUT)).as_posix())
with zipfile.ZipFile(zp) as z:
    assert z.testzip() is None

size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
print(f"打包完成：{OUT}（{size / 1048576:.1f} MB）+ {zp.name}（{zp.stat().st_size / 1048576:.1f} MB）；版本 {head}")
for k, v in counts.items():
    print(f"  {k}: {v} 个文件")
