# -*- coding: utf-8 -*-
# 用 sxtwl(寿星天文历, 独立实现) 重算, 与 app 输出对比
import json, datetime, sys
import sxtwl

sys.stdout.reconfigure(encoding='utf-8')
Gan = "甲乙丙丁戊己庚辛壬癸"
Zhi = "子丑寅卯辰巳午未申酉戌亥"

def gz(tg, dz): return Gan[tg.tg] + Zhi[dz.dz]

def day_gz_at(y, m, d):
    day = sxtwl.fromSolar(y, m, d)
    return gz(day.getDayGZ().tg, day.getDayGZ().dz) if hasattr(day.getDayGZ(), 'tg') else None

def get_day_gz(y, m, d):
    day = sxtwl.fromSolar(y, m, d)
    g = day.getDayGZ()
    return Gan[g.tg] + Zhi[g.dz]

def hour_gz(day_gz_str, hour):
    # 时柱: 日干起时 — 甲己还加甲, 乙庚丙作初...
    dg = Gan.index(day_gz_str[0])
    hbranch = (hour + 1) // 2 % 12
    hgan = (dg % 5 * 2 + hbranch) % 10
    return Gan[hgan] + Zhi[hbranch]

# 中气表: 名字 -> (月将支)
ZHONGQI = {'雨水':'亥','春分':'戌','谷雨':'酉','小满':'申','夏至':'未','大暑':'午',
           '处暑':'巳','秋分':'辰','霜降':'卯','小雪':'寅','冬至':'丑','大寒':'子'}
# sxtwl 节气索引: 0=冬至,1=小寒,2=大寒,3=立春,4=雨水,5=惊蛰,6=春分,7=清明,8=谷雨,9=立夏,
# 10=小满,11=芒种,12=夏至,13=小暑,14=大暑,15=立秋,16=处暑,17=白露,18=秋分,19=寒露,
# 20=霜降,21=立冬,22=小雪,23=大雪
JQ = ['冬至','小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种',
      '夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪']

def jieqi_times(year):
    """返回 {节气名: datetime} 覆盖 year 全年 + 上年冬至"""
    res = {}
    for yy in (year - 1, year):
        start = datetime.date(yy, 12, 1) if yy == year - 1 else datetime.date(yy, 1, 1)
        end = datetime.date(yy, 12, 31)
        d = start
        while d <= end:
            day = sxtwl.fromSolar(d.year, d.month, d.day)
            if day.hasJieQi():
                idx = day.getJieQi()
                jd = day.getJieQiJD()
                dd = sxtwl.JD2DD(jd)
                base = datetime.datetime(dd.Y, dd.M, dd.D, int(dd.h), int(dd.m))
                t = base + datetime.timedelta(seconds=float(dd.s))
                res[JQ[idx] + '@' + str(t.year)] = t
            d += datetime.timedelta(days=1)
    return res

_jq_cache = {}
def yuejiang(dt):
    if dt.year not in _jq_cache:
        _jq_cache[dt.year] = jieqi_times(dt.year)
    times = _jq_cache[dt.year]
    best, bestz = None, None
    for name, z in ZHONGQI.items():
        for key, t in times.items():
            if key.startswith(name + '@') and t <= dt and (best is None or t > best):
                best, bestz = t, z
    return bestz, best

def sizhu_sxtwl(y, m, d, h):
    """四柱: 年/月柱用 sxtwl(日粒度, 避开节气当天); 日柱 23 点后算次日; 时柱由日干推"""
    day = sxtwl.fromSolar(y, m, d)
    yg = day.getYearGZ(); mg = day.getMonthGZ()
    year_gz = Gan[yg.tg] + Zhi[yg.dz]
    month_gz = Gan[mg.tg] + Zhi[mg.dz]
    if h >= 23:
        nxt = (datetime.date(y, m, d) + datetime.timedelta(days=1))
        day_gz = get_day_gz(nxt.year, nxt.month, nxt.day)
    else:
        day_gz = get_day_gz(y, m, d)
    hour_gz_str = hour_gz(day_gz, h)
    return year_gz, month_gz, day_gz, hour_gz_str

app = json.load(open(r'D:\get\zhanbu\www\crosscheck_app.json', encoding='utf-8'))

print(f"{'案例':<14}{'dt':<18}{'app四柱':<28}{'sxtwl四柱':<28}{'月将':<10}{'对比'}")
issues = []
for r in app:
    if 'error' in r:
        print(r['label'], 'APP ERROR:', r['error']); issues.append((r['label'], 'app报错: '+r['error'])); continue
    datepart, timepart = r['dt'].split(' ')
    y, m, d = map(int, datepart.split('-')); h = int(timepart.split(':')[0])
    dt = datetime.datetime(y, m, d, h, 30)
    ay = r['siZhu']; app4 = f"{ay['year']} {ay['month']} {ay['day']} {ay['hour']}"
    sy, sm, sd, sh = sizhu_sxtwl(y, m, d, h)
    sx4 = f"{sy} {sm} {sd} {sh}"
    zj, zt = yuejiang(dt)
    appzj = r['yueJiang']['zhi']
    marks = []
    if app4 != sx4:
        # 年/月柱日粒度误差说明
        marks.append('四柱')
    if appzj != zj:
        marks.append(f'月将app={appzj},sxtwl={zj}')
    if r['hourZhi'] != sh[1]:
        marks.append('时支')
    status = 'OK' if not marks else 'DIFF:' + ','.join(marks)
    print(f"{r['label']:<14}{r['dt']:<18}{app4:<28}{sx4:<28}{appzj}/{zj or '?':<6}{status}")
    if marks: issues.append((r['label'], '; '.join(marks) + f' | app={app4} sxtwl={sx4} yj app={appzj} ref={zj}'))

print()
if issues:
    print("=== 差异明细 ===")
    for l, m in issues: print('-', l, ':', m)
else:
    print("全部一致")
