/**
 * v2.0.4 演示: TypeScript 工具函数
 *
 * 这是首个用 TypeScript 写的工具文件,展示渐进迁移路径:
 *   1. 文件后缀 .ts (TypeScript)
 *   2. Vite/esbuild 自动转译 (无需 tsc 构建步骤)
 *   3. 类型注解让 IDE 智能提示
 *   4. 现有 JS 代码通过 window.utils 访问
 *
 * 编译产物: 通过 Vite 自动处理,直接 <script src="utils/date-helpers.ts"> 即可
 * 注意: 浏览器加载需要 import 语法或 Vite 处理;这里用经典 script 模式
 *       编译后挂 window.DateHelpers
 */

// v2.0.4 演示: TypeScript 工具函数
// 注意: .ts 文件用 TS 原生类型 (interface/type),不用 JSDoc @typedef

interface Ganzhi {
  tiangan: string;
  dizhi: string;
}

/**
 * 计算指定年月的干支 (简化版,与 liuyao.js 一致)
 */
export function monthGanzhi(year: number, month: number): Ganzhi {
  const TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const DZ = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
  const wuHuDun: Record<string, string> = {
    '甲':'丙','己':'丙','乙':'戊','庚':'戊','丙':'庚','辛':'庚',
    '丁':'壬','壬':'壬','戊':'甲','癸':'甲'
  };
  const yearGan = TG[(year - 4) % 10];
  const startGan = wuHuDun[yearGan] || '丙';
  const startIdx = TG.indexOf(startGan);
  return {
    tiangan: TG[(startIdx + month - 1) % 10],
    dizhi: DZ[month - 1]
  };
}

/**
 * 格式化日期为 "YYYY年M月D日 HH:mm"
 */
export function formatDateTime(dt: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日 ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

/**
 * 判断两个日期是否同一天
 */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}
