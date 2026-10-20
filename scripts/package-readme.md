# 历史行情局 · 完整项目包（{{DATE}}）

把历史人物的一生做成 K 线走势的网站，共 300 人。这个文件夹是它的**完整备份**：源码、全部版本历史、头像图片和出处、字体源文件、已构建的网站、工作记录都在这里，不依赖任何临时文件。

- 线上地址：https://history-market-studio.vercel.app （推送到 GitHub 的 `rebuild/v2` 分支就自动部署）
- GitHub：https://github.com/christopher47634/history-market-studio
- 打包时的版本：`{{HEAD}}`
- 重新打包：在项目里 `npm run build` 后跑 `python scripts/make-package.py`，会生成新日期的包并替换旧包

## 文件夹里有什么

| 文件夹 | 内容 | 什么时候用 |
| --- | --- | --- |
| `01-项目源码` | 整个项目：`src`（界面）、`data`（300 人的数据和头像记录）、`pipeline`（生成数据、头像、字体的脚本）、`public`（头像、字体、离线缓存）、`tests`、`scripts`、`AGENTS.md`（所有设计决定）。不含 `node_modules`（可重新装） | 想继续改网站 |
| `02-版本历史` | `history-market-studio.bundle`：包含每一次提交的完整 git 历史，已校验 | 想回到某个旧版本、或在新电脑上还原 |
| `03-头像图片与出处` | `portraits`（网站用的 299 张头像）、`头像出处清单.csv`（每个人的头像来自哪个页面、作者、许可）、`portraits.json`（原始记录）、下载和挑选用的脚本 | 查头像出处，或头像丢了从这里拿 |
| `04-字体源文件` | 子集化之前的原始字体（马善政、志莽行书、站酷小薇、霞鹜新致宋）和各自的许可证 | 数据变了要重新生成朝代字体时 |
| `05-已构建网站` | `npm run build` 的成品（静态文件） | 想直接把成品放到别的服务器上 |
| `06-工作脚本与调研记录` | 开发中写的检查脚本（界面审计、搜索、头像加载测试等）和调研日志，不含截图 | 回头查当时怎么验证的 |

## 头像的情况

- 300 人里：258 张来自维基共享资源（公有领域或 CC 许可），41 张来自百度百科词条配图（已人工逐张挑选，带水印的没用），1 人（耶律洪基）没有头像。
- 图片都是已压缩的 `.webp`，每张不超过 40 KB。
- `头像出处清单.csv` 用 Excel 打开即可，每一行写明来源页面、作者和许可。维基部分要求署名，网站的完整角色卡里已经标注。

## 在新电脑上还原

需要装 Node.js 24 和 Git。

```bash
# 方法一：从版本历史还原（带全部历史）
git clone history-market-studio.bundle history-market-studio
cd history-market-studio
git checkout rebuild/v2

# 方法二：直接用 01-项目源码（没有历史）
cd 01-项目源码

npm ci
npm run build          # 构建
npm test               # 单元和静态检查
npx vite preview       # 本机预览，默认 http://localhost:4173
```

部署到 Vercel：把代码推到 GitHub 的 `rebuild/v2` 即可，Vercel 会自动构建。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm test` | 类型检查、数据校验、界面规则、搜索回归等 |
| `npm run test:faults` | 故障注入：对每类按需下载的资源制造网络失败，确认能自动恢复（要先 `npx vite preview --port 4174`） |
| `npm run test:monkey -- 250 1` | 随机操作测试：250 步随机点按、按键、滚动、改窗口，每步查崩溃、报错、横向溢出 |
| `npm run test:motion` | 动效验证：卡片重排滑动、滚动进场、退场动画、减少动态效果时全关 |
| `npm run test:regress` | 回归用例：随机测试抓到过的崩溃，按原样复现 |
| `npm run test:production` | 构建后检查体积、头像、字体、许可 |
| `node tests/e2e-app.mjs [网址]` | 浏览器里的 34 项功能测试（默认测 http://localhost:4174，所有 e2e 测试都可以传线上网址） |
| `python pipeline/fonts.py` | 改了界面文字或数据后，重新生成宋体 / 黑体分片 |
| `python pipeline/era-fonts.py` | 重新生成朝代字体（要 `04-字体源文件` 里的原始字体） |
| `npm run v2:portraits` | 重新从维基抓头像并压缩 |

## 注意

- 这个包不含任何密码、密钥或登录信息。
- 本项目所有设计约定和踩过的坑，按日期记在 `01-项目源码/AGENTS.md`，接着改之前先读一遍。
- 新增人物时，除了数据，还要在 `src/v3/search-terms.js` 里补搜索别名，然后跑 `npm run test:search`。
