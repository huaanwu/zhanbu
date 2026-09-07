# 验收脚本: Claude 修完后跑
# 1) 大六壬冬至窗口月将 (app vs sxtwl)
# 2) 奇门四柱 (app vs lunar-javascript EightChar 直接对照)
import subprocess, json, sys, datetime
sys.stdout.reconfigure(encoding='utf-8')

NODE_CHECK = r'''
globalThis.window={};
var fs=require('fs');
process.chdir('D:/get/zhanbu/www');
eval(fs.readFileSync('lib/ganzhi.js','utf-8')+';'+fs.readFileSync('daliuren.js','utf-8')+';'+fs.readFileSync('qimen.js','utf-8'));
globalThis.getYearGZEx(2026,12,22);
var dlr=globalThis.window.daliuren, qm=globalThis.window.qimen;
var out={};
// 冬至窗口 6 个时点
var yjCases=[[2026,12,22,6],[2026,12,22,12],[2026,12,25,15],[2026,12,31,23],[2027,1,5,10],[2025,12,21,20],[2025,12,21,23]];
out.yuejiang=yjCases.map(function(c){
  var dt=new Date(c[0],c[1]-1,c[2],c[3],0,0);
  var pan=dlr.paiKe('time',{dt:dt});
  return {dt:c.join('-'), zhi:pan.yueJiang.zhi, name:pan.yueJiang.name, lunarText:pan.lunarText||null};
});
// 奇门四柱
var qmCases=[[2026,9,7,10],[2026,1,15,12],[2024,3,20,6],[2024,2,3,12]];
out.qimen=qmCases.map(function(c){
  var pan=qm.panQimen(c[0],c[1],c[2],c[3],30);
  var lunar=globalThis.Solar.fromYmdHms(c[0],c[1],c[2],c[3],30,0).getLunar();
  var ec=lunar.getEightChar();
  return {dt:c.join('-'), app:pan.bazi, ref:[ec.getYear(),ec.getMonth(),ec.getDay(),ec.getTime()]};
});
// 晚子时四柱自洽检查
var late=dlr.paiKe('time',{dt:new Date(2025,6,25,23,30,0)});
out.lateZi={siZhu:late.siZhu, dayGan:late.dayGan};
console.log('==JSON=='+JSON.stringify(out));
'''
r = subprocess.run(['node', '-e', NODE_CHECK], capture_output=True, text=True, encoding='utf-8', errors='replace')
if r.returncode != 0:
    print('NODE FAIL:', r.stderr[:2000]); sys.exit(1)
line = [l for l in r.stdout.splitlines() if l.startswith('==JSON==')][0]
out = json.loads(line[8:])

# sxtwl 月将参照
import sxtwl
JQ = ['冬至','小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种',
      '夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪']
ZHONGQI = {'雨水':'亥','春分':'戌','谷雨':'酉','小满':'申','夏至':'未','大暑':'午',
           '处暑':'巳','秋分':'辰','霜降':'卯','小雪':'寅','冬至':'丑','大寒':'子'}
def jieqi_all(year):
    res=[]
    for yy in (year-1, year):
        d = datetime.date(yy, 12 if yy==year-1 else 1, 1)
        end = datetime.date(yy,12,31)
        while d<=end:
            day=sxtwl.fromSolar(d.year,d.month,d.day)
            if day.hasJieQi():
                dd=sxtwl.JD2DD(day.getJieQiJD())
                t=datetime.datetime(dd.Y,dd.M,dd.D,int(dd.h),int(dd.m))+datetime.timedelta(seconds=float(dd.s))
                res.append((JQ[day.getJieQi()],t))
            d+=datetime.timedelta(days=1)
    return res
def ref_yuejiang(y,m,dd,h):
    dt=datetime.datetime(y,m,dd,h)
    best=None;bz=None
    for name,t in jieqi_all(y):
        if name in ZHONGQI and t<=dt and (best is None or t>best): best,bz=t,ZHONGQI[name]
    return bz

fails=[]
print('=== 大六壬月将(冬至窗口) ===')
for rec in out['yuejiang']:
    y,m,d,h=[int(x) for x in rec['dt'].split('-')]
    ref=ref_yuejiang(y,m,d,h)
    ok = rec['zhi']==ref
    if not ok: fails.append(f"月将 {rec['dt']}: app={rec['zhi']} ref={ref}")
    print(f"{rec['dt']:<22} app={rec['zhi']}{rec['name']} ref={ref} {'OK' if ok else 'FAIL'}  农历={rec['lunarText']}")

print()
print('=== 奇门四柱 ===')
for rec in out['qimen']:
    ok = rec['app']==rec['ref']
    if not ok: fails.append(f"奇门四柱 {rec['dt']}: app={rec['app']} ref={rec['ref']}")
    print(f"{rec['dt']:<18} app={' '.join(rec['app'])}  ref={' '.join(rec['ref'])}  {'OK' if ok else 'FAIL'}")

print()
print('=== 晚子时自洽 ===')
lz=out['lateZi']; sz=lz['siZhu']
GAN='甲乙丙丁戊己庚辛壬癸'
dg=sz['day'][0]; hg=sz['hour'][0]; hz=sz['hour'][1]
zi = 0
expect_hg = GAN[(GAN.index(dg)*2+zi)%10]
ok = (hz=='子' and hg==expect_hg)
if not ok: fails.append(f"晚子时: {sz['day']}日{sz['hour']}时, 五鼠遁应为{expect_hg}子")
print(f"日柱{sz['day']} 时柱{sz['hour']}  五鼠遁期望 {expect_hg}子  {'OK' if ok else 'FAIL'}")

print()
print('=== 总结 ===')
print('全部通过' if not fails else 'FAIL:\n'+'\n'.join(fails))
