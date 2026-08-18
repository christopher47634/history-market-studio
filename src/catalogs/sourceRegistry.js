const primary = (label, url, scope = "collection") => ({
  label,
  url,
  type: "primary",
  scope,
  publisher: "维基文库（公版史籍）",
});

const institutional = (label, url, scope = "collection") => ({
  label,
  url,
  type: "institutional",
  scope,
  publisher: "机构人物资料",
});

export const sourceRegistry = {
  shiji32: primary("《史记·齐太公世家》", "https://zh.wikisource.org/zh-hans/史記/卷032", "biography"),
  shiji33: primary("《史记·鲁周公世家》", "https://zh.wikisource.org/zh-hans/史記/卷033", "biography"),
  shiji43: primary("《史记·赵世家》", "https://zh.wikisource.org/zh-hans/史記/卷043", "biography"),
  shiji48: primary("《史记·陈涉世家》", "https://zh.wikisource.org/zh-hans/史記/卷048", "biography"),
  shiji57: primary("《史记·绛侯周勃世家》", "https://zh.wikisource.org/zh-hans/史記/卷057", "biography"),
  shiji62: primary("《史记·管晏列传》", "https://zh.wikisource.org/zh-hans/史記/卷062", "biography"),
  shiji65: primary("《史记·孙子吴起列传》", "https://zh.wikisource.org/zh-hans/史記/卷065", "biography"),
  shiji75: primary("《史记·孟尝君列传》", "https://zh.wikisource.org/zh-hans/史記/卷075", "biography"),
  shiji77: primary("《史记·魏公子列传》", "https://zh.wikisource.org/zh-hans/史記/卷077", "biography"),
  shiji80: primary("《史记·乐毅列传》", "https://zh.wikisource.org/zh-hans/史記/卷080", "biography"),
  shiji82: primary("《史记·田单列传》", "https://zh.wikisource.org/zh-hans/史記/卷082", "biography"),
  shiji84: primary("《史记·屈原贾生列传》", "https://zh.wikisource.org/zh-hans/史記/卷084", "biography"),
  shiji86: primary("《史记·刺客列传》", "https://zh.wikisource.org/zh-hans/史記/卷086", "biography"),
  shiji87: primary("《史记·李斯列传》", "https://zh.wikisource.org/zh-hans/史記/卷087", "biography"),
  shiji88: primary("《史记·蒙恬列传》", "https://zh.wikisource.org/zh-hans/史記/卷088", "biography"),
  shiji91: primary("《史记·黥布列传》", "https://zh.wikisource.org/zh-hans/史記/卷091", "biography"),
  shiji07: primary("《史记·项羽本纪》", "https://zh.wikisource.org/zh-hans/史記/卷007", "biography"),
  hanshu54: primary("《汉书·李广苏建传》", "https://zh.wikisource.org/zh-hans/漢書/卷054", "biography"),
  hanshu56: primary("《汉书·董仲舒传》", "https://zh.wikisource.org/zh-hans/漢書/卷056", "biography"),
  hanshu61: primary("《汉书·张骞李广利传》", "https://zh.wikisource.org/zh-hans/漢書/卷061", "biography"),
  houhanshu23: primary("《后汉书·窦融列传》", "https://zh.wikisource.org/zh-hans/後漢書/卷23", "biography"),
  houhanshu24: primary("《后汉书·马援列传》", "https://zh.wikisource.org/zh-hans/後漢書/卷24", "biography"),
  houhanshu35: primary("《后汉书·张曹郑列传》", "https://zh.wikisource.org/zh-hans/後漢書/卷35", "biography"),
  houhanshu49: primary("《后汉书·王充王符仲长统列传》", "https://zh.wikisource.org/zh-hans/後漢書/卷49", "biography"),
  sanguozhi06: primary("《三国志·袁绍刘表传》", "https://zh.wikisource.org/zh-hans/三國志/卷06", "biography"),
  sanguozhi07: primary("《三国志·吕布张邈臧洪传》", "https://zh.wikisource.org/zh-hans/三國志/卷07", "biography"),
  sanguozhi10: primary("《三国志·荀彧荀攸贾诩传》", "https://zh.wikisource.org/zh-hans/三國志/卷10", "biography"),
  sanguozhi44: primary("《三国志·蒋琬费祎姜维传》", "https://zh.wikisource.org/zh-hans/三國志/卷44", "biography"),
  sanguozhi54: primary("《三国志·周瑜鲁肃吕蒙传》", "https://zh.wikisource.org/zh-hans/三國志/卷54", "biography"),
  jinshu: primary("《晋书》相关本纪与列传", "https://zh.wikisource.org/zh-hans/晉書"),
  songshu: primary("《宋书》相关本纪与列传", "https://zh.wikisource.org/zh-hans/宋書"),
  liangshu: primary("《梁书》相关本纪与列传", "https://zh.wikisource.org/zh-hans/梁書"),
  weishu: primary("《魏书》相关本纪与列传", "https://zh.wikisource.org/zh-hans/魏書"),
  beishishu: primary("《北史》相关本纪与列传", "https://zh.wikisource.org/zh-hans/北史"),
  zhoushu: primary("《周书》相关本纪与列传", "https://zh.wikisource.org/zh-hans/周書"),
  beiqishu: primary("《北齐书》相关本纪与列传", "https://zh.wikisource.org/zh-hans/北齊書"),
  jiutangshu: primary("《旧唐书》相关本纪与列传", "https://zh.wikisource.org/zh-hans/舊唐書"),
  xinwudaishi: primary("《新五代史》相关本纪与列传", "https://zh.wikisource.org/zh-hans/新五代史"),
  songshi: primary("《宋史》相关本纪与列传", "https://zh.wikisource.org/zh-hans/宋史"),
  liaoshi: primary("《辽史》相关本纪与列传", "https://zh.wikisource.org/zh-hans/遼史"),
  jinshi: primary("《金史》相关本纪与列传", "https://zh.wikisource.org/zh-hans/金史"),
  yuanshi: primary("《元史》相关本纪与列传", "https://zh.wikisource.org/zh-hans/元史"),
  mingshi: primary("《明史》相关本纪与列传", "https://zh.wikisource.org/zh-hans/明史"),
  qingshigao: primary("《清史稿》相关本纪与列传", "https://zh.wikisource.org/zh-hans/清史稿"),
  modernPeople: institutional("近现代人物资料库", "https://cpc.people.com.cn/GB/443712/443829/index.html"),
  casPeople: institutional("中国科学院科学家资料", "https://www.cas.cn/zt/rwzt/"),
};

const subjectTitles = {
  杨素: "楊素",
};

export function getSubjectReference(name) {
  const title = subjectTitles[name] || name;
  return {
    label: `人物专页 · ${name}`,
    url: `https://zh.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    type: "secondary",
    scope: "subject",
    publisher: "中文维基百科（辅助校对）",
  };
}
