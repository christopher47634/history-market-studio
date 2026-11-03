// 启动看门狗（10-20）：主程序脚本没下载下来时，页面会一直停在骨架屏，什么提示都没有。
// - 主程序的脚本 / 样式加载出错：立刻提示；
// - 12 秒后骨架屏还在（慢网络或脚本卡住）：温和提示一句，并给「重新载入」。
// React 一旦挂载，骨架屏就被整体替换，这里的提示自然消失。
(function () {
  function show(text) {
    var card = document.querySelector(".sk-card");
    if (!card || card.querySelector("[data-boot-note]")) return;
    var note = document.createElement("div");
    note.setAttribute("data-boot-note", "");
    note.style.cssText = "display:grid;justify-items:center;gap:10px;margin-top:6px";
    var p = document.createElement("span");
    p.textContent = text;
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = "重新载入";
    b.style.cssText = "border:1px solid var(--sk-line);background:transparent;color:var(--sk-ink);border-radius:99px;padding:8px 18px;font:inherit;cursor:pointer";
    b.addEventListener("click", function () { location.reload(); });
    note.appendChild(p);
    note.appendChild(b);
    card.appendChild(note);
  }
  addEventListener("error", function (e) {
    var t = e.target;
    if (t && (t.tagName === "SCRIPT" || t.tagName === "LINK") && /\/assets\//.test(t.src || t.href || "")) show("页面程序没有下载下来，可能是网络抖了一下。");
  }, true);
  setTimeout(function () { show("加载比平常慢，网络可能不太稳定。"); }, 12000);
})();
