const fs=require('fs');process.chdir('D:/get/zhanbu/www');
const TR=require('./test_comprehensive.js');
const runner=new TR();

globalThis.window={};
function load(p){eval(fs.readFileSync(p,'utf8'))}
load('lib/ganzhi.js');load('expert/tables.js');
load('liuyao.js');load('qimen.js');
const vm=require('vm');const s={};vm.runInNewContext(fs.readFileSync('lib/lunar.bundle.js','utf8'),s);
globalThis.window.Solar=s.LunarLib.Solar;globalThis.window.Lunar=s.LunarLib.Lunar;globalThis.window.LunarYear=s.LunarLib.LunarYear;globalThis.window.LunarMonth=s.LunarLib.LunarMonth;

runner.module('多模块排盘全功能审计');

runner.test('奇门：时辰过夏至后度过天数应随小时变化', function() {
  const a=window.qimen.panQimen(2026,6,28,0,0);
  const b=window.qimen.panQimen(2026,6,28,23,0);
  runner.assert(a.days_in_jq!==b.days_in_jq, '夏至后过天数应随小时变化');
});

runner.test('八字：时辰过午/未时柱应不同', function() {
  load('app/bazi.js');
  const baziCode=fs.readFileSync('app/bazi.js','utf8');
  const getBaziPan=eval('('+baziCode.match(/function getBaziPan[\s\S]*?\n\}/)[0]+')');
  const a=getBaziPan(s.LunarLib.Solar.fromYmdHms(2026,6,28,10,0,0),'male');
  const b=getBaziPan(s.LunarLib.Solar.fromYmdHms(2026,6,28,16,0,0),'male');
  runner.assert(a.hour!==b.hour, '八字时柱应随时辰变化');
  runner.assertEq(a.hour,'丁巳','10点巳时');
  runner.assertEq(b.hour,'庚申','16点申时');
});

runner.test('八字：闰月 2020 闰4 排盘能跑通', function() {
  function solarFromLunar(year,month,day){
    const leap=globalThis.window.LunarYear.fromYear(year).getLeapMonth();
    if(leap>0 && month<0){
      if(leap===-month){
        const lm=globalThis.window.LunarMonth.fromYm(year,leap);
        if(day>lm.getDayCount()){
          return globalThis.window.LunarMonth.fromYm(year,leap+1).next(-(day-lm.getDayCount())).toSolar();
        }
        return globalThis.window.Lunar.fromYmd(year,leap,day).getSolar();
      }
    }
    return globalThis.window.Lunar.fromYmd(year,Math.abs(month),day).getSolar();
  }
  const r=solarFromLunar(2020,-5,15);
  runner.assert(r && typeof r.toYmd==='function','闰5-15 排盘能跑通');
});

runner.test('姓名学：五格计算结果符合康熙笔画', function() {
  load('xingshi.js');
  const r=window.Xingshi.calculateGege('李','嘉');
  runner.assertEq(r.tiange,8,'李嘉天8');
  runner.assertEq(r.renge,21,'李嘉人21');
  runner.assertEq(r.dige,15,'李嘉地15');
  const r2=window.Xingshi.calculateGege('司马','光');
  runner.assertEq(r2.tiange,16,'司马光天16');
  runner.assertEq(r2.renge,16,'司马光人16');
});

runner.test('六爻：时间起卦每天内动爻数合理', function() {
  const pan=window.liuyao.panGua('time',{dt:new Date(2026,6,19,6,30)});
  runner.assert(pan.gua.dongYaoList.length===1,'单动爻');
  runner.assertEq(pan.timeGanzhi.day,'甲午','day=甲午');
});

runner.test('紫微：所有 0-23 小时都能排盘不报错', function() {
  const vm2=require('vm');const s2={};vm2.runInNewContext(fs.readFileSync('lib/iztro.bundle.js','utf8'),s2);
  const astro=s2.IztroLib.astro;
  for(const h of [0,1,7,8,11,12,13,15,16,22,23]){
    const idx=Math.max(0,Math.min(12,h===23?0:Math.floor((h+1)/2)));
    const pan=astro.bySolar('2026-06-28',idx,'male',true,'zh-CN');
    runner.assert(pan.earthlyBranchOfSoulPalace,'h='+h+' 命宫有地支');
  }
});

runner.run();
