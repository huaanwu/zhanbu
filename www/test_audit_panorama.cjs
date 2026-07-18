const fs=require('fs');process.chdir('D:/get/zhanbu/www');
const _store=new Map();
globalThis.localStorage={getItem:k=>_store.has(k)?_store.get(k):null,setItem:(k,v)=>_store.set(k,String(v)),removeItem:k=>_store.delete(k)};
globalThis.window={};
function load(p){eval(fs.readFileSync(p,'utf8'))}
load('lib/ganzhi.js');load('expert/tables.js');
load('liuyao.js');load('qimen.js');
load('app/bazi.js');load('xingshi.js');load('cache.js');
load('history.js');load('visual.js');load('ab_test.js');
load('feedback-loop.js');
load('crypto.js');load('chat.js');load('app/cross.js');
load('app/fengshui.js');load('app/daofobuddhism.js');

const TR=require('./test_comprehensive.js');
const runner=new TR();

const vm=require('vm');const s={};vm.runInNewContext(fs.readFileSync('lib/lunar.bundle.js','utf8'),s);
globalThis.window.Solar=s.LunarLib.Solar;globalThis.window.Lunar=s.LunarLib.Lunar;globalThis.window.LunarYear=s.LunarLib.LunarYear;globalThis.window.LunarMonth=s.LunarLib.LunarMonth;

runner.module('全功能排盘 · 排盘入口与算法');
runner.test('奇门: 时辰过夏至后度过天数应随小时变化', function() {
  const a=window.qimen.panQimen(2026,6,28,0,0);
  const b=window.qimen.panQimen(2026,6,28,23,0);
  runner.assert(a.days_in_jq!==b.days_in_jq, '夏至后过天数应随小时变化');
});
runner.test('八字: 时柱应随小时变化,10:00巳时,16:00申时', function() {
  const baziCode=fs.readFileSync('app/bazi.js','utf8');
  const getBaziPan=eval('('+baziCode.match(/function getBaziPan[\s\S]*?\n\}/)[0]+')');
  const ba=getBaziPan(s.LunarLib.Solar.fromYmdHms(2026,6,28,10,0,0),'male');
  const bb=getBaziPan(s.LunarLib.Solar.fromYmdHms(2026,6,28,16,0,0),'male');
  runner.assertEq(ba.hour,'丁巳','10:00=巳时');
  runner.assertEq(bb.hour,'庚申','16:00=申时');
});
runner.test('八字: 农历闰月(2020闰5)能排盘不抛错', function() {
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
  const baziCode=fs.readFileSync('app/bazi.js','utf8');
  const getBaziPan=eval('('+baziCode.match(/function getBaziPan[\s\S]*?\n\}/)[0]+')');
  const pan=getBaziPan(r,'male');
  runner.assertEq(pan.year,'庚子','闰5 转化为公历应仍为庚子年');
});
runner.test('六爻: 时间起卦每天内动爻数合理', function() {
  const pan=window.liuyao.panGua('time',{dt:new Date(2026,6,19,6,30)});
  runner.assert(pan.gua.dongYaoList.length===1,'单动爻');
  runner.assertEq(pan.timeGanzhi.day,'甲午','day=甲午');
});
runner.test('紫微: 0-23小时通过 shichenIdx 映射后不抛错', function() {
  const vm2=require('vm');const s2={};vm2.runInNewContext(fs.readFileSync('lib/iztro.bundle.js','utf8'),s2);
  const astro=s2.IztroLib.astro;
  for(const h of [0,1,7,8,11,12,13,15,16,22,23]){
    const idx=Math.max(0,Math.min(12,h===23?0:Math.floor((h+1)/2)));
    const pan=astro.bySolar('2026-06-28',idx,'male',true,'zh-CN');
    runner.assert(pan.earthlyBranchOfSoulPalace,'h='+h+' 命宫有地支');
  }
});
runner.test('姓名学: 五格计算结果符合康熙笔画', function() {
  const r1=window.Xingshi.calculateGege('李','嘉');
  runner.assertEq(r1.tiange,8,'李嘉天8');
  runner.assertEq(r1.renge,21,'李嘉人21');
  runner.assertEq(r1.dige,15,'李嘉地15');
  const r2=window.Xingshi.calculateGege('司马','光');
  runner.assertEq(r2.tiange,16,'司马光天16');
  runner.assertEq(r2.renge,16,'司马光人16');
});
runner.test('风水: 八宅四方向伏位=大门朝', function() {
  runner.assertEq(window.eightZhai('东').吉.伏位,'东','东门伏位=东');
  runner.assertEq(window.eightZhai('南').吉.伏位,'南','南门伏位=南');
  runner.assertEq(window.eightZhai('西').吉.伏位,'西','西门伏位=西');
  runner.assertEq(window.eightZhai('北').吉.伏位,'北','北门伏位=北');
  runner.assertEq(window.eightZhai('东').吉.生气,'南','震宫生气=南');
});
runner.test('道佛化解: 4个核心渲染函数可调用', function() {
  runner.assert(typeof window.getQianData==='function','getQianData');
  runner.assert(typeof window.renderFuList==='function','renderFuList');
  runner.assert(typeof window.renderJueList==='function','renderJueList');
  runner.assert(typeof window.renderZhouList==='function','renderZhouList');
});
runner.test('Cache/History/Visual/FeedbackLoop/AbTest/Crypto/ChatSession 全部挂载 window', function() {
  runner.assert(typeof window.Cache==='object','Cache');
  runner.assert(typeof window.History==='object','History');
  runner.assert(typeof window.Visual==='object','Visual');
  runner.assert(typeof window.FeedbackLoop==='object','FeedbackLoop');
  runner.assert(window.ABTest && typeof window.ABTest.init==='function','AbTest');
  runner.assert(typeof window.Crypto==='object','Crypto');
  runner.assert(typeof window.ChatSession==='object','ChatSession');
});
runner.test('六爻 cache 包含 jingfang-v2 算法版本号', function() {
  const key=window.Cache.makeKey('liuyao',{gua:{name:'天泽履',dongYaoList:[1]}});
  runner.assert(key.indexOf('jingfang-v2')>=0,'liuyao cache key 隔离');
});
runner.test('visual.drawLiuyao 新 pan 结构仍能正确画卦', function() {
  const svg=window.Visual.drawLiuyao({gua:{name:'火山旅',lines:[0,0,1,1,0,1],dongYaoList:[5]}});
  runner.assert(svg.startsWith('<svg'),'svg 起始');
  runner.assert(svg.includes('火山旅'),'卦名');
});

runner.run();
