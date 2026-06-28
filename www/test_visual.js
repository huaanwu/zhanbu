/**
 * visual.js 可视化SVG测试
 */
process.chdir(__dirname);
const TestRunner = require("./test_comprehensive.js");
const runner = new TestRunner();

global.window = {};
const fs = require("fs");
eval(fs.readFileSync("visual.js", "utf-8"));
const Visual = global.window.Visual;

runner.module("可视化 (visual.js)");

runner.test("全局对象存在", () => {
  runner.assert(Visual !== undefined, "Visual 未定义");
});

runner.test("drawLiuyao 生成阳卦SVG", () => {
  const pan = { gua: { name: "乾为天", lines: [1,1,1,1,1,1], dongYaoList: [3] } };
  const svg = Visual.drawLiuyao(pan);
  runner.assert(svg.startsWith("<svg"), "应以<svg开头");
  runner.assert(svg.includes("乾为天"), "应包含卦名");
  runner.assert(svg.includes("动"), "应包含动爻标记");
});

runner.test("drawLiuyao 生成阴卦SVG", () => {
  const pan = { gua: { name: "坤为地", lines: [0,0,0,0,0,0], dongYaoList: [] } };
  const svg = Visual.drawLiuyao(pan);
  runner.assert(svg.startsWith("<svg"), "应以<svg开头");
  runner.assert(svg.includes("坤为地"), "应包含卦名");
  runner.assert(svg.includes("静"), "静卦标记");
});

runner.test("drawLiuyao 混合卦", () => {
  const pan = { gua: { name: "水火既济", lines: [1,0,1,0,1,0], dongYaoList: [2,5] } };
  const svg = Visual.drawLiuyao(pan);
  runner.assert(svg.includes("水火既济"), "卦名");
  // 同时有动爻和阴爻阳爻
  runner.assert(svg.includes("动"), "动爻标记");
});

runner.test("drawQimen 生成九宫格SVG", () => {
  const pan = {
    gong9: Array.from({length: 9}, (_, i) => ({
      number: i + 1, name: "宫" + (i+1),
      tianpan: "甲", dipan: "子", renpan: "休门",
      jiuxing: "天蓬", shenpan: "直符",
      is_dipan_zhifu: i === 0, is_renpan_zhishi: i === 1
    }))
  };
  const svg = Visual.drawQimen(pan);
  runner.assert(svg.startsWith("<svg"), "应以<svg开头");
  runner.assert(svg.includes("休门"), "应包含门信息");
  runner.assert(svg.includes("天蓬"), "应包含星信息");
});

runner.test("空数据返回空字符串", () => {
  runner.assertEq(Visual.drawLiuyao(null), "", "null 数据返回空");
  runner.assertEq(Visual.drawLiuyao({}), "", "空对象返回空");
  runner.assertEq(Visual.drawQimen(null), "", "null 宫数据返回空");
});

runner.test("包含6个爻位的标签", () => {
  const pan = { gua: { name: "乾为天", lines: [1,1,1,1,1,1], dongYaoList: [] } };
  const svg = Visual.drawLiuyao(pan);
  for (const label of ["初", "二", "三", "四", "五", "上"]) {
    runner.assert(svg.includes(label), `应包含爻位标签: ${label}`);
  }
});

runner.run();
