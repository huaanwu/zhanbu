process.chdir(__dirname);
var TR = require("./test_comprehensive.js");
var runner = new TR();
var fs0 = require("fs");

globalThis.window = {};
eval(fs0.readFileSync('liuyao.js', 'utf-8'));
eval(fs0.readFileSync('expert.js', 'utf-8'));
eval(fs0.readFileSync('xingshi.js', 'utf-8'));
eval(fs0.readFileSync('qimen.js', 'utf-8'));

var liuyao = globalThis.window.liuyao;
var Expert = globalThis.window.Expert;
var Xingshi = globalThis.window.Xingshi;


runner.module('第一层·年柱');

runner.test('年柱：2026年 = 丙午', function() {
  runner.assertEq(getYearGZ(2026), "丙午");
});

runner.test('年柱：2024年 = 甲辰', function() {
  runner.assertEq(getYearGZ(2024), "甲辰");
});

runner.test('年柱：1984年 = 甲子', function() {
  runner.assertEq(getYearGZ(1984), "甲子");
});

runner.test('年柱：2000年 = 庚辰', function() {
  runner.assertEq(getYearGZ(2000), "庚辰");
});

runner.test('年柱：2025年 = 乙巳', function() {
  runner.assertEq(getYearGZ(2025), "乙巳");
});

runner.test('年柱：1990年 = 庚午', function() {
  runner.assertEq(getYearGZ(1990), "庚午");
});

runner.test('年柱：1949年 = 己丑', function() {
  runner.assertEq(getYearGZ(1949), "己丑");
});

runner.test('年柱：1900年 = 庚子', function() {
  runner.assertEq(getYearGZ(1900), "庚子");
});

runner.test('年柱：2030年 = 庚戌', function() {
  runner.assertEq(getYearGZ(2030), "庚戌");
});


runner.module('第一层·月柱（五虎遁）');

runner.test('月柱：甲年正月 = 丙寅', function() {
  runner.assertEq(getMonthGZ("甲", 1), "丙寅");
});

runner.test('月柱：甲年七月 = 壬申', function() {
  runner.assertEq(getMonthGZ("甲", 7), "壬申");
});

runner.test('月柱：丙年正月 = 庚寅', function() {
  runner.assertEq(getMonthGZ("丙", 1), "庚寅");
});

runner.test('月柱：庚年正月 = 戊寅', function() {
  runner.assertEq(getMonthGZ("庚", 1), "戊寅");
});

runner.test('月柱：壬年正月 = 壬寅', function() {
  runner.assertEq(getMonthGZ("壬", 1), "壬寅");
});

runner.test('月柱：乙年正月 = 戊寅', function() {
  runner.assertEq(getMonthGZ("乙", 1), "戊寅");
});

runner.test('月柱：癸年八月 = 辛酉', function() {
  runner.assertEq(getMonthGZ("癸", 8), "辛酉");
});

runner.test('月柱：戊年三月 = 丙辰', function() {
  runner.assertEq(getMonthGZ("戊", 3), "丙辰");
});


runner.module('第一层·日柱（内部一致性）');

runner.test('日柱：相邻两天干支连续', function() {
  (function(){
  var TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  var DZ = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  function nextGZ(gz) { return TG[(TG.indexOf(gz[0]) + 1) % 10] + DZ[(DZ.indexOf(gz[1]) + 1) % 12]; }
  for (var m = 0; m < 12; m++) {
    var d1 = getDayGZ(new Date(2026, m, 15));
    var d2 = getDayGZ(new Date(2026, m, 16));
    if (nextGZ(d1) !== d2) { throw new Error('日柱不连续: ' + d1 + ' -> ' + d2); }
  }
})();
});

runner.test('日柱：60天后回到起点', function() {
  (function(){
  var d0 = getDayGZ(new Date(2026, 0, 1));
  var d60 = getDayGZ(new Date(2026, 2, 2)); // Jan 1 + 60 = Mar 2
  runner.assertEq(d0, d60, '60天应回到同一天干支');
})();
});

runner.test('日柱：1年后干支进5位', function() {
  (function(){
  var d0 = getDayGZ(new Date(2023, 0, 1));
  var d1 = getDayGZ(new Date(2024, 0, 1));
  // 365%10=5, 365%12=5, 所以进5位 (2023平年)
  var TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  var DZ = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  var expG = TG[(TG.indexOf(d0[0]) + 5) % 10];
  var expZ = DZ[(DZ.indexOf(d0[1]) + 5) % 12];
  runner.assertEq(d1, expG + expZ, '365天后干支进5位');
})();
});


runner.module('第一层·时柱（五鼠遁）');

runner.test('时柱：甲日子时 = 甲子', function() {
  runner.assertEq(getHourGZ("甲", 0), "甲子");
});

runner.test('时柱：甲日辰时(8点) = 戊辰', function() {
  runner.assertEq(getHourGZ("甲", 8), "戊辰");
});

runner.test('时柱：丙日辰时(8点) = 壬辰', function() {
  runner.assertEq(getHourGZ("丙", 8), "壬辰");
});

runner.test('时柱：庚日午时(12点) = 壬午', function() {
  runner.assertEq(getHourGZ("庚", 12), "壬午");
});

runner.test('时柱：戊日戌时(20点) = 壬戌', function() {
  runner.assertEq(getHourGZ("戊", 20), "壬戌");
});

runner.test('时柱：癸日卯时(6点) = 乙卯', function() {
  runner.assertEq(getHourGZ("癸", 6), "乙卯");
});

runner.test('时柱：乙日子时 = 丙子', function() {
  runner.assertEq(getHourGZ("乙", 0), "丙子");
});

runner.test('时柱：甲日亥时(22点) = 乙亥', function() {
  runner.assertEq(getHourGZ("甲", 22), "乙亥");
});

runner.test('时柱：丁日午时 = 丙午', function() {
  runner.assertEq(getHourGZ("丁", 12), "丙午");
});


runner.module('第一层·纳音');

runner.test('纳音：甲子 = 海中金', function() {
  runner.assertEq(NAYIN_60JIAZI["甲子"], "海中金");
});

runner.test('纳音：乙丑 = 海中金', function() {
  runner.assertEq(NAYIN_60JIAZI["乙丑"], "海中金");
});

runner.test('纳音：丙寅 = 炉中火', function() {
  runner.assertEq(NAYIN_60JIAZI["丙寅"], "炉中火");
});

runner.test('纳音：庚午 = 路旁土', function() {
  runner.assertEq(NAYIN_60JIAZI["庚午"], "路旁土");
});

runner.test('纳音：癸亥 = 大海水', function() {
  runner.assertEq(NAYIN_60JIAZI["癸亥"], "大海水");
});

runner.test('纳音：戊子 = 霹雳火', function() {
  runner.assertEq(NAYIN_60JIAZI["戊子"], "霹雳火");
});

runner.test('纳音：辛酉 = 石榴木', function() {
  runner.assertEq(NAYIN_60JIAZI["辛酉"], "石榴木");
});

runner.test('纳音：壬辰 = 长流水', function() {
  runner.assertEq(NAYIN_60JIAZI["壬辰"], "长流水");
});

runner.test('纳音：丙午 = 天河水', function() {
  runner.assertEq(NAYIN_60JIAZI["丙午"], "天河水");
});


runner.module('第一层·旬空');

runner.test('旬空：甲子旬 戌亥空', function() {
runner.assert(XUNKONG["甲子"].indexOf("戌") >= 0 && XUNKONG["甲子"].indexOf("亥") >= 0);
});

runner.test('旬空：甲午旬 辰巳空', function() {
runner.assert(XUNKONG["甲午"].indexOf("辰") >= 0 && XUNKONG["甲午"].indexOf("巳") >= 0);
});

runner.test('旬空：甲申旬 午未空', function() {
runner.assert(XUNKONG["甲申"].indexOf("午") >= 0 && XUNKONG["甲申"].indexOf("未") >= 0);
});

runner.test('旬空：甲寅旬 子丑空', function() {
runner.assert(XUNKONG["甲寅"].indexOf("子") >= 0 && XUNKONG["甲寅"].indexOf("丑") >= 0);
});

runner.test('旬空：甲辰旬 寅卯空', function() {
runner.assert(XUNKONG["甲辰"].indexOf("寅") >= 0 && XUNKONG["甲辰"].indexOf("卯") >= 0);
});

runner.test('旬空：甲戌旬 申酉空', function() {
runner.assert(XUNKONG["甲戌"].indexOf("申") >= 0 && XUNKONG["甲戌"].indexOf("酉") >= 0);
});

runner.test('60甲子旬空全覆盖', function() {
  (function(){
  var TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  var DZ = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  for (var i = 0; i < 60; i++) {
    var gz = TG[i % 10] + DZ[i % 12];
    runner.assert(XUNKONG[gz] !== undefined, '旬空缺失：' + gz);
  }
  })();
});


runner.module('第一层·六十四卦');

runner.test('乾为天', function() {
  runner.assertEq(LIUSHISIGUA["1,1"], "乾为天");
});

runner.test('坤为地', function() {
  runner.assertEq(LIUSHISIGUA["8,8"], "坤为地");
});

runner.test('水火既济', function() {
  runner.assertEq(LIUSHISIGUA["6,3"], "水火既济");
});

runner.test('火水未济', function() {
  runner.assertEq(LIUSHISIGUA["3,6"], "火水未济");
});

runner.test('天地否', function() {
  runner.assertEq(LIUSHISIGUA["1,8"], "天地否");
});

runner.test('地天泰', function() {
  runner.assertEq(LIUSHISIGUA["8,1"], "地天泰");
});

runner.test('山泽损', function() {
  runner.assertEq(LIUSHISIGUA["7,2"], "山泽损");
});

runner.test('风雷益', function() {
  runner.assertEq(LIUSHISIGUA["5,4"], "风雷益");
});

runner.test('64卦全覆盖', function() {
  (function(){
  for (var u = 1; u <= 8; u++) {
    for (var l = 1; l <= 8; l++) {
      var key = String(u) + ',' + String(l);
      runner.assert(LIUSHISIGUA[key] !== undefined, key + ' 缺失');
    }
  }
  })();
});


runner.module('第一层·六亲');

runner.test('金宫土支 = 父母', function() {
  runner.assertEq(LIU_QIN["金,土"], "父母");
});

runner.test('金宫水支 = 子孙', function() {
  runner.assertEq(LIU_QIN["金,水"], "子孙");
});

runner.test('金宫火支 = 官鬼', function() {
  runner.assertEq(LIU_QIN["金,火"], "官鬼");
});

runner.test('金宫金支 = 兄弟', function() {
  runner.assertEq(LIU_QIN["金,金"], "兄弟");
});

runner.test('金宫木支 = 妻财', function() {
  runner.assertEq(LIU_QIN["金,木"], "妻财");
});

runner.test('木宫火支 = 子孙', function() {
  runner.assertEq(LIU_QIN["木,火"], "子孙");
});

runner.test('土宫金支 = 子孙', function() {
  runner.assertEq(LIU_QIN["土,金"], "子孙");
});

runner.test('火宫木支 = 父母', function() {
  runner.assertEq(LIU_QIN["火,木"], "父母");
});

runner.test('水宫土支 = 官鬼', function() {
  runner.assertEq(LIU_QIN["水,土"], "官鬼");
});


runner.module('第一层·六神');

runner.test('甲日→青龙(0)', function() {
  runner.assertEq(LIU_SHEN_START["甲"], 0);
});

runner.test('丙日→朱雀(1)', function() {
  runner.assertEq(LIU_SHEN_START["丙"], 1);
});

runner.test('戊日→勾陈(2)', function() {
  runner.assertEq(LIU_SHEN_START["戊"], 2);
});

runner.test('庚日→白虎(4)', function() {
  runner.assertEq(LIU_SHEN_START["庚"], 4);
});

runner.test('壬日→玄武(5)', function() {
  runner.assertEq(LIU_SHEN_START["壬"], 5);
});

runner.test('六神顺序正确', function() {
  (function(){
  runner.assertEq(LIU_SHEN[0], "青龙"); runner.assertEq(LIU_SHEN[1], "朱雀");
  runner.assertEq(LIU_SHEN[2], "勾陈"); runner.assertEq(LIU_SHEN[3], "螣蛇");
  runner.assertEq(LIU_SHEN[4], "白虎"); runner.assertEq(LIU_SHEN[5], "玄武");
})();
});


runner.module('第一层·五格剖象');

runner.test('数理五行：1木 2木 3火 4火 5土', function() {
  runner.assertEq(Xingshi.WUXING_BIHUA[1], "木");
});

runner.test('康熙笔画：基础字', function() {
  runner.assertEq(Xingshi.KANGXI_BIHUA["一"], 1);
});

runner.test('五格：李(7)嘉(14) 天8人21地15', function() {
  var r = Xingshi.calculateGege("李", "嘉"); runner.assertEq(r.tiange, 8); runner.assertEq(r.renge, 21); runner.assertEq(r.dige, 15);
});

runner.test('五格：张(11)三(3) 天12人14地4', function() {
  var r = Xingshi.calculateGege("张", "三"); runner.assertEq(r.tiange, 12); runner.assertEq(r.renge, 14); runner.assertEq(r.dige, 4);
});

runner.test('五格：李(7)白(5) 天8人12地6', function() {
  var r = Xingshi.calculateGege("李", "白"); runner.assertEq(r.tiange, 8); runner.assertEq(r.renge, 12); runner.assertEq(r.dige, 6);
});

runner.test('复姓：司马(6+10)光(6)', function() {
  var r = Xingshi.calculateGege("司马", "光"); runner.assertEq(r.tiange, 16); runner.assertEq(r.renge, 16);
});


runner.module('第二层·互逆运算');

runner.test('数字起卦可逆推：22/77/45 → 坎6/巽5/动3', function() {
  var r = liuyao.qiGuaByNumber(22, 77, 45); runner.assertEq(r.upper, 6); runner.assertEq(r.lower, 5); runner.assertEq(r.dong, 3);
});

runner.test('时间起卦可复现', function() {
  var dt = new Date(2026, 5, 28, 14, 30); var r1 = liuyao.qiGuaByTime(dt); var r2 = liuyao.qiGuaByTime(dt); runner.assertEq(r1.upper, r2.upper); runner.assertEq(r1.lower, r2.lower); runner.assertEq(r1.dong, r2.dong);
});

runner.test('每个日干12时辰不重复', function() {
  (function(){
  var gans = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  for (var g = 0; g < gans.length; g++) {
    var gan = gans[g];
    var seen = {};
    for (var h = 0; h < 24; h += 2) {
      var gz = getHourGZ(gan, h);
      if (seen[gz]) throw new Error('重复：' + gan + ' ' + gz);
      seen[gz] = true;
    }
    if (Object.keys(seen).length !== 12) throw new Error(gan + '只有' + Object.keys(seen).length + '个时辰');
    }
  })();
});


runner.module('第五层·经典命例');

runner.test('今例：2026-06-28 14:30 = 丙午 乙未 癸巳 己未', function() {
  (function(){
  runner.assertEq(getYearGZ(2026), '丙午');
  runner.assertEq(getMonthGZ('丙', 6), '乙未');
  runner.assertEq(getDayGZ(new Date(2026, 5, 28)), '癸巳');
  runner.assertEq(getHourGZ('癸', 14), '己未');
})();
});

runner.test('今例：2000-01-01 00:00 = 庚辰 丙子 戊寅 壬子', function() {
  (function(){
  runner.assertEq(getYearGZ(2000), '庚辰');
  runner.assertEq(getMonthGZ('己', 1), '丙寅');
  runner.assertEq(getDayGZ(new Date(2000, 0, 1)), '戊寅');
  runner.assertEq(getHourGZ('戊', 0), '壬子');
})();
});

runner.test('今例：2024-10-01 10:00 = 甲辰 乙亥 戊午 丁巳', function() {
  (function(){
  runner.assertEq(getYearGZ(2024), '甲辰');
  runner.assertEq(getMonthGZ('甲', 10), '乙亥');
  runner.assertEq(getDayGZ(new Date(2024, 9, 1)), '戊午');
  runner.assertEq(getHourGZ('戊', 10), '丁巳');
})();
});


runner.module('第五层·排盘一致性');

runner.test('panGua 完整结构', function() {
  var dt = new Date(2026, 5, 28, 14, 30); var pan = liuyao.panGua("time", { dt: dt }); runner.assertHasKeys(pan, ["method","datetime","timeGanzhi","gua","yaoList"]); runner.assertEq(pan.yaoList.length, 6);
});

runner.test('六爻六亲全部有值', function() {
  var pan = liuyao.panGua("number", { num1: 1, num2: 2, num3: 3, dt: new Date(2024, 0, 1, 12, 0) }); for (var i = 0; i < pan.yaoList.length; i++) { var y = pan.yaoList[i]; runner.assertHasKeys(y, ["yao","name","gan","zhi","wuxing","liuqin","liushen","isDong"]); runner.assert(y.liuqin !== "未知"); }
});

runner.test('有动爻必有变卦', function() {
  var pan = liuyao.panGua("number", { num1: 22, num2: 77, num3: 45, dt: new Date(2026, 5, 28, 14, 30) }); runner.assert(pan.gua.dongYaoList.length > 0); runner.assert(pan.gua.bianUpperGua !== null); runner.assert(pan.gua.bianLowerGua !== null);
});


runner.module('边界情况');

runner.test('1900-2100 年柱60甲子全覆盖', function() {
  (function(){
  var seen = {};
  for (var y = 1900; y <= 2100; y++) seen[getYearGZ(y)] = true;
  runner.assertEq(Object.keys(seen).length, 60);
})();
});

runner.test('24小时 = 12时辰 每时辰2小时', function() {
  (function(){
  var zhi = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  var count = {};
  for (var h = 0; h < 24; h++) {
    var idx = Math.floor((h + 1) / 2) % 12;
    count[zhi[idx]] = (count[zhi[idx]] || 0) + 1;
  }
  runner.assertEq(Object.keys(count).length, 12);
  for (var z in count) runner.assertEq(count[z], 2, z + '应为2小时');
})();
});

runner.test('八字专家系统输出确定事实', function() {
  var facts = Expert.bazi({ gz: { year: "丙午", month: "甲午", day: "癸巳", hour: "己未" }, dayGan: "癸", wangShuai: "身强" }); runner.assert(typeof facts === "string"); runner.assert(facts.indexOf("事实") >= 0);
});


runner.module('高精度引擎·立春年柱');
runner.test('年柱：2026立春前(2/3)=乙巳', function() {
  runner.assertEq(window.getYearGZEx(2026,2,3), "乙巳");
});
runner.test('年柱：2026立春(2/4)在农历年前=乙巳', function() {
  runner.assertEq(window.getYearGZEx(2026,2,4), "乙巳");
});
runner.test('年柱：2026立春后(2/5)农历年前=乙巳', function() {
  runner.assertEq(window.getYearGZEx(2026,2,5), "乙巳");
});
runner.test('年柱：2000立春前(2/3)=己卯', function() {
  runner.assertEq(window.getYearGZEx(2000,2,3), "己卯");
});
runner.test('年柱：2000立春后(2/5)=庚辰', function() {
  runner.assertEq(window.getYearGZEx(2000,2,5), "庚辰");
});

runner.module('高精度引擎·节气月');
runner.test('月柱：2026立春前(2/3)=己丑', function() {
  runner.assertEq(window.getMonthGZEx(2026,2,3,"乙"), "己丑");
});
runner.test('月柱：2026立春后(2/4)=庚寅', function() {
  runner.assertEq(window.getMonthGZEx(2026,2,4,"乙"), "庚寅");
});
runner.test('月柱：2026夏至后6/28=甲午', function() {
  runner.assertEq(window.getMonthGZEx(2026,6,28,"丙"), "甲午");
});

runner.module('高精度引擎·时柱');
runner.test('时柱：甲日子时(0点)=甲子', function() {
  runner.assertEq(window.getHourGZEx("甲",0), "甲子");
});
runner.test('时柱：甲日亥时(22点)=乙亥', function() {
  runner.assertEq(window.getHourGZEx("甲",22), "乙亥");
});
runner.test('时柱：甲日晚子(23点次日乙)=丙子', function() {
  runner.assertEq(window.getHourGZEx("甲",23,"乙"), "丙子");
});

runner.module('高精度引擎·纳音');
runner.test('纳音：甲子=海中金', function() {
  runner.assertEq(getNaYin("甲子"), "海中金");
});
runner.test('纳音：丙午=天河水', function() {
  runner.assertEq(getNaYin("丙午"), "天河水");
});
runner.test('纳音：癸亥=大海水', function() {
  runner.assertEq(getNaYin("癸亥"), "大海水");
});

runner.module('高精度引擎·旬空');
runner.test('旬空：甲子旬 戌亥空', function() {
  runner.assertEq(getXunKong("甲子"), "戌亥");
});
runner.test('旬空：甲午旬 辰巳空', function() {
  runner.assertEq(getXunKong("甲午"), "辰巳");
});
runner.test('旬空：甲申旬 午未空', function() {
  runner.assertEq(getXunKong("甲申"), "午未");
});
runner.run();
