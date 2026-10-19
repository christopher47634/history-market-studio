// 把人工从百度百科词条配图里挑好的头像放进站点：node pipeline/set-baike-portraits.mjs work/picks.json
// picks.json：{ 人物id: 候选序号 }，候选图在 work/cand/<id>/<序号>.jpg（work/baike-dl.mjs 下载）。
// 只用没有水印的图；署名写明「百度百科「词条」配图，未标注许可」。之后跑 python pipeline/roles.py。
import { readFile, writeFile, copyFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("data/v2/portraits.json", ROOT);
const LEMMA = {
  liyuanhao: "李元昊", duguhuanghou: "独孤伽罗", mengtian: "蒙恬", songyingxing: "宋应星", duguxin: "独孤信", zhengchenggong: "郑成功",
  jikang: "嵇康", xuanzang: "玄奘", xuxiake: "徐霞客", jingke: "荆轲", liuyong: "柳永", yeludashi: "耶律大石", wangmian: "王冕",
  wuchengen: "吴承恩", shangguanwaner: "上官婉儿", xiaowendi: "拓跋宏", xinqiji: "辛弃疾", abaoji: "耶律阿保机", jiasixie: "贾思勰",
  yangguifei: "杨玉环", tolui: "孛儿只斤·拖雷", hulagu: "孛儿只斤·旭烈兀", xielingyun: "谢灵运",
};
const store = JSON.parse(await readFile(OUT, "utf8"));
const picks = JSON.parse(await readFile(process.argv[2], "utf8"));
for (const [id, n] of Object.entries(picks)) {
  const src = new URL(`work/cand/${id}/${n}.jpg`, ROOT);
  if (!existsSync(src) || !LEMMA[id]) { console.log(`✗ ${id}`); continue; }
  const webp = new URL(`public/portraits/${id}.webp`, ROOT);
  if (existsSync(webp)) await unlink(webp);
  await copyFile(src, new URL(`public/portraits/${id}.jpg`, ROOT));
  const title = LEMMA[id];
  store[id] = { ...store[id], img: { src: `portraits/${id}.jpg`, file: null, page: `https://baike.baidu.com/item/${encodeURIComponent(title)}`, license: "百度百科词条配图（未标注许可）", artist: "百度百科", source: "baike", pageTitle: title } };
  console.log(`✓ ${id} ← ${title} #${n}`);
}
await writeFile(OUT, JSON.stringify(store, null, 1));
