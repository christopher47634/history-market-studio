const citation = (quote, source, url, kind = "人物史料原文") => ({
  quote,
  source,
  url,
  kind,
});

const urls = {
  shijiXiang: "https://zh.wikisource.org/zh-hans/史記/卷007",
  shijiGaozu: "https://zh.wikisource.org/zh-hans/史記/卷008",
  shijiHanxin: "https://zh.wikisource.org/zh-hans/史記/淮陰侯列傳",
  chushi: "https://zh.wikisource.org/zh-hans/前出師表",
  lunyu: "https://zh.wikisource.org/zh-hans/論語",
  sunzi: "https://zh.wikisource.org/zh-hans/孫子兵法",
  shangjun: "https://zh.wikisource.org/zh-hans/史記/卷068",
  lisao: "https://zh.wikisource.org/zh-hans/離騷",
  lanting: "https://zh.wikisource.org/zh-hans/蘭亭集序",
  hanfeiShiguo: "https://zh.wikisource.org/zh-hans/韓非子/十過",
  shijiGuanyan: "https://zh.wikisource.org/zh-hans/史記/卷062",
};

const eventCitations = {
  "liubang:称帝定汉": citation("诸君必以为便，便国家。", "《史记·高祖本纪》", urls.shijiGaozu),
  "liubang:彭城大败": citation("吾所以有天下者何？项氏之所以失天下者何？", "《史记·高祖本纪》", urls.shijiGaozu),
  "xiangyu:鸿门宴": citation("君王为人不忍。", "《史记·项羽本纪》", urls.shijiXiang),
  "xiangyu:乌江自刎": citation("天之亡我，我何渡为！", "《史记·项羽本纪》", urls.shijiXiang),
  "hanxin:背水破赵": citation("置之死地而后生，置之亡地而后存。", "《史记·淮阴侯列传》", urls.shijiHanxin),
  "hanxin:长乐宫死": citation("狡兔死，良狗烹；高鸟尽，良弓藏。", "《史记·淮阴侯列传》", urls.shijiHanxin),
  "zhugeliang:出师北伐": citation("受任于败军之际，奉命于危难之间。", "诸葛亮《前出师表》", urls.chushi, "人物文献原文"),
  "guanzhong:老病休居": citation("管仲老，不能用事，休居于家。", "《韩非子·十过》", urls.hanfeiShiguo),
  "guanzhong:病中论相": citation("知臣莫若君，知子莫若父。", "《韩非子·十过》", urls.hanfeiShiguo),
  "guanzhong:葵丘会盟": citation("九合诸侯，一匡天下，管仲之谋也。", "《史记·管晏列传》", urls.shijiGuanyan),
};

const figureCitations = {
  liubang: citation("此三者，皆人杰也，吾能用之，此吾所以取天下也。", "《史记·高祖本纪》", urls.shijiGaozu),
  xiangyu: citation("力能扛鼎，才气过人。", "《史记·项羽本纪》", urls.shijiXiang),
  hanxin: citation("臣多多而益善耳。", "《史记·淮阴侯列传》", urls.shijiHanxin),
  zhangliang: citation("运筹策帷帐之中，决胜于千里之外。", "《史记·高祖本纪》", urls.shijiGaozu),
  xiahe: citation("镇国家，抚百姓，给馈饷，不绝粮道。", "《史记·高祖本纪》", urls.shijiGaozu),
  xiaohe: citation("镇国家，抚百姓，给馈饷，不绝粮道。", "《史记·高祖本纪》", urls.shijiGaozu),
  fanzeng: citation("项羽有一范增而不能用，此其所以为我擒也。", "《史记·高祖本纪》", urls.shijiGaozu),
  zhugeliang: citation("受任于败军之际，奉命于危难之间。", "诸葛亮《前出师表》", urls.chushi, "人物文献原文"),
  confucius: citation("学而不思则罔，思而不学则殆。", "《论语·为政》", urls.lunyu, "人物言论原文"),
  sunwu: citation("知彼知己，百战不殆。", "《孙子兵法·谋攻》", urls.sunzi, "人物著述原文"),
  shangyang: citation("治世不一道，便国不法古。", "《史记·商君列传》", urls.shangjun),
  quyuan: citation("路漫漫其修远兮，吾将上下而求索。", "屈原《离骚》", urls.lisao, "人物著述原文"),
  qinshihuang: citation("分天下以为三十六郡，郡置守、尉、监。", "《史记·秦始皇本纪》", "https://zh.wikisource.org/zh-hans/史記/卷006"),
  simaqian: citation("究天人之际，通古今之变，成一家之言。", "司马迁《报任安书》", "https://zh.wikisource.org/zh-hans/報任少卿書", "人物文献原文"),
  caocao: citation("周公吐哺，天下归心。", "曹操《短歌行》", "https://zh.wikisource.org/zh-hans/短歌行_(曹操)", "人物著述原文"),
  liubei: citation("勿以恶小而为之，勿以善小而不为。", "《三国志·先主传》", "https://zh.wikisource.org/zh-hans/三國志/卷32"),
  lishimin: citation("以人为镜，可以明得失。", "《旧唐书·魏徵传》", "https://zh.wikisource.org/zh-hans/舊唐書/卷71"),
  libai: citation("天生我材必有用，千金散尽还复来。", "李白《将进酒》", "https://zh.wikisource.org/zh-hans/將進酒_(李白)", "人物著述原文"),
  dufu: citation("安得广厦千万间，大庇天下寒士俱欢颜。", "杜甫《茅屋为秋风所破歌》", "https://zh.wikisource.org/zh-hans/茅屋為秋風所破歌", "人物著述原文"),
  sushi: citation("竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。", "苏轼《定风波》", "https://zh.wikisource.org/zh-hans/定風波_(莫聽穿林打葉聲)", "人物著述原文"),
  yuefei: citation("文臣不爱钱，武臣不惜死，天下太平矣。", "《宋史·岳飞传》", "https://zh.wikisource.org/zh-hans/宋史/卷365"),
  wangxizhi: citation("仰观宇宙之大，俯察品类之盛。", "王羲之《兰亭集序》", urls.lanting, "人物著述原文"),
  zhuyuanzhang: citation("驱逐胡虏，恢复中华，立纲陈纪，救济斯民。", "朱元璋《谕中原檄》", "https://zh.wikisource.org/zh-hans/諭中原檄", "人物文献原文"),
  wangyangming: citation("知是行之始，行是知之成。", "王阳明《传习录》", "https://zh.wikisource.org/zh-hans/傳習錄", "人物著述原文"),
  linzexu: citation("苟利国家生死以，岂因祸福避趋之。", "林则徐《赴戍登程口占示家人》", "https://zh.wikisource.org/zh-hans/赴戍登程口占示家人", "人物著述原文"),
  guanzhong: citation("齐桓公以霸，九合诸侯，一匡天下，管仲之谋也。", "《史记·管晏列传》", urls.shijiGuanyan),
};

const eraCitations = {
  先秦: citation("国之大事，在祀与戎。", "《左传·成公十三年》", "https://zh.wikisource.org/zh-hans/春秋左氏傳/成公", "同代典籍摘句"),
  秦汉: citation("此三者，皆人杰也，吾能用之，此吾所以取天下也。", "《史记·高祖本纪》", urls.shijiGaozu, "同代典籍摘句"),
  三国: citation("治戎为长，奇谋为短，理民之干，优于将略。", "《三国志·诸葛亮传》", "https://zh.wikisource.org/zh-hans/三國志/卷35", "同代史书摘句"),
  魏晋南北朝: citation("仰观宇宙之大，俯察品类之盛。", "王羲之《兰亭集序》", urls.lanting, "同代典籍摘句"),
  隋唐: citation("居安思危，戒奢以俭。", "魏徵《谏太宗十思疏》", "https://zh.wikisource.org/zh-hans/諫太宗十思疏", "同代典籍摘句"),
  五代十国: citation("忧劳可以兴国，逸豫可以亡身。", "欧阳修《五代史伶官传序》", "https://zh.wikisource.org/zh-hans/五代史伶官傳序", "史论原文摘句"),
  宋: citation("文臣不爱钱，武臣不惜死，天下太平矣。", "《宋史·岳飞传》", "https://zh.wikisource.org/zh-hans/宋史/卷365", "同代史书摘句"),
  辽金西夏: citation("女真不满万，满万不可敌。", "《金史·兵志》", "https://zh.wikisource.org/zh-hans/金史/卷44", "同代史书摘句"),
  元: citation("人生自古谁无死，留取丹心照汗青。", "文天祥《过零丁洋》", "https://zh.wikisource.org/zh-hans/過零丁洋", "宋元之际文献摘句"),
  明: citation("知是行之始，行是知之成。", "王阳明《传习录》", "https://zh.wikisource.org/zh-hans/傳習錄", "同代典籍摘句"),
  清: citation("我劝天公重抖擞，不拘一格降人才。", "龚自珍《己亥杂诗》", "https://zh.wikisource.org/zh-hans/己亥雜詩", "同代典籍摘句"),
  近现代: citation("少年智则国智，少年富则国富，少年强则国强。", "梁启超《少年中国说》", "https://zh.wikisource.org/zh-hans/少年中國說", "近代文献摘句"),
};

export function getHistoricalCitation(event, figure = event?.figure) {
  const figureId = figure?.id || event?.figureId;
  const eventKey = figureId && event?.title ? `${figureId}:${event.title}` : "";
  const selected =
    eventCitations[eventKey] ||
    figureCitations[figureId] ||
    eraCitations[figure?.dynasty] ||
    eraCitations.秦汉;
  return { ...selected };
}

export function attachHistoricalCitations(figure) {
  return {
    ...figure,
    events: figure.events.map((event) => ({
      ...event,
      citation: getHistoricalCitation(event, figure),
    })),
  };
}
