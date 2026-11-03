// 测试驱动必须明确输入设备，不能继承 Linux headless 的 hover:none。
import assert from "node:assert/strict";
import { launch } from "../scripts/cdp.mjs";

for (const mobile of [false, true]) {
  const page = await launch({ mobile });
  try {
    const actual = await page.eval(`({
    hover: matchMedia('(hover: hover)').matches,
    fine: matchMedia('(pointer: fine)').matches,
    coarse: matchMedia('(pointer: coarse)').matches,
    touch: navigator.maxTouchPoints > 0
    })`);
    assert.deepEqual(actual, mobile
      ? { hover: false, fine: false, coarse: true, touch: true }
      : { hover: true, fine: true, coarse: false, touch: false });
    console.log(`✓ ${mobile ? "手机触屏" : "桌面鼠标"}：输入设备能力正确`);
  } finally {
    await page.close();
  }
}
process.exit(0);
