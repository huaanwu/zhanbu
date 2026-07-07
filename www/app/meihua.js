// 梅花易数页面逻辑 v1.0
// 支持时间起卦、数字起卦、物象起卦三种方式

var _meihuaPan = null;

function selMeihuaMethod(el) {
  document.querySelectorAll('[data-method]').forEach(function(b) { b.classList.remove('active'); });
  el.classList.add('active');
  var method = el.getAttribute('data-method');
  document.getElementById('mhTimeRow').style.display = method === 'time' ? '' : 'none';
  document.getElementById('mhNumberRow').style.display = method === 'number' ? '' : 'none';
  document.getElementById('mhObjectRow').style.display = method === 'object' ? '' : 'none';
}

function doMeihua() {
  var methodEl = document.querySelector('#pageMeihua [data-method].active');
  var method = methodEl ? methodEl.getAttribute('data-method') : 'time';
  var guaNums = null;
  if (method === 'time') {
    var y = parseInt(document.getElementById('mhYear').value) || 0;
    var m = parseInt(document.getElementById('mhMonth').value) || 0;
    var d = parseInt(document.getElementById('mhDay').value) || 0;
    var h = parseInt(document.getElementById('mhHour').value) || 0;
    if (!y || !m || !d) { Core.Toast.warn('请输入完整年月日'); return; }
    var diZhi = [0,1,2,3,4,5,6,7,8,9,10,11,12];
    var nianZhi = diZhi[(y - 4) % 12 + 1] || 1;
    var upper = (nianZhi + m + d) % 8; if (upper === 0) upper = 8;
    var lower = (nianZhi + m + d + h) % 8; if (lower === 0) lower = 8;
    var dongYao = (nianZhi + m + d + h) % 6; if (dongYao === 0) dongYao = 6;
    guaNums = { upper: upper, lower: lower, dong: dongYao };
  } else if (method === 'number') {
    var n1 = parseInt(document.getElementById('mhNum1').value) || 0;
    var n2 = parseInt(document.getElementById('mhNum2').value) || 0;
    if (!n1 || !n2) { Core.Toast.warn('请输入两个数字'); return; }
    var upper = n1 % 8; if (upper === 0) upper = 8;
    var lower = n2 % 8; if (lower === 0) lower = 8;
    var dongYao = (n1 + n2) % 6; if (dongYao === 0) dongYao = 6;
    guaNums = { upper: upper, lower: lower, dong: dongYao };
  } else if (method === 'object') {
    var objGua = parseInt(document.getElementById('mhObjGua').value) || 0;
    var fangWei = parseInt(document.getElementById('mhFangWei').value) || 0;
    var shiChen = parseInt(document.getElementById('mhShiChen').value) || 0;
    if (!objGua || !fangWei) { Core.Toast.warn('请选择物象和方位'); return; }
    var dongYao = shiChen || (objGua + fangWei) % 6; if (dongYao === 0) dongYao = 6;
    guaNums = { upper: objGua, lower: fangWei, dong: dongYao };
  }
  if (!guaNums) { Core.Toast.warn('起卦失败'); return; }
  
  _meihuaPan = calcMeihuaPan(guaNums);
  renderMeihuaPan(_meihuaPan);
  document.getElementById('mhResult').classList.add('visible');
  document.getElementById('mhAI').style.display = 'none';
}

// 八卦名称/五行/数
var BAGUA = [
  null,
  { name: '乾', wuXing: '金', symbol: '☰', gua: '111' },
  { name: '兑', wuXing: '金', symbol: '☱', gua: '110' },
  { name: '离', wuXing: '火', symbol: '☲', gua: '101' },
  { name: '震', wuXing: '木', symbol: '☳', gua: '100' },
  { name: '巽', wuXing: '木', symbol: '☴', gua: '110' },
  { name: '坎', wuXing: '水', symbol: '☵', gua: '010' },
  { name: '艮', wuXing: '土', symbol: '☶', gua: '001' },
  { name: '坤', wuXing: '土', symbol: '☷', gua: '000' }
];

// 64卦速查表 (上卦*8+下卦)
var GUA_64 = {
  11:'乾为天',12:'天泽履',13:'天火同人',14:'天雷无妄',15:'天风姤',16:'天水讼',17:'天山遁',18:'天地否',
  21:'泽天夬',22:'兑为泽',23:'泽火革',24:'泽雷随',25:'泽风大过',26:'泽水困',27:'泽山咸',28:'地泽临',
  31:'火天大有',32:'火泽睽',33:'离为火',34:'火雷噬嗑',35:'火风鼎',36:'火水未济',37:'火山旅',38:'火地晋',
  41:'雷天大壮',42:'雷泽归妹',43:'雷火丰',44:'震为雷',45:'雷风恒',46:'雷水解',47:'雷山小过',48:'雷地豫',
  51:'风天小畜',52:'风泽中孚',53:'风火家人',54:'风雷益',55:'巽为风',56:'风水涣',57:'风山渐',58:'风地观',
  61:'水天需',62:'水泽节',63:'水火既济',64:'水雷屯',65:'水风井',66:'坎为水',67:'水山蹇',68:'水地比',
  71:'山天大畜',72:'山泽损',73:'山火贲',74:'山雷颐',75:'山风蛊',76:'山水蒙',77:'艮为山',78:'山地剥',
  81:'地天泰',82:'地泽临',83:'地火明夷',84:'地雷复',85:'地风升',86:'地水师',87:'地山谦',88:'坤为地'
};

// 10天干+12地支对应的卦数
var GUA_TIANGAN = {甲:3,乙:5,丙:6,丁:3,戊:1,己:8,庚:1,辛:2,辛:2,壬:6,癸:8};

function calcMeihuaPan(nums) {
  var u = BAGUA[nums.upper], l = BAGUA[nums.lower];
  var guaIndex = nums.upper * 10 + nums.lower;
  var guaName = GUA_64[guaIndex] || ('上' + u.name + '下' + l.name);
  var ti = BAGUA[nums.upper + nums.lower - nums.upper]; // simplified
  // Determine ti (体卦) = no-dong-yao part
  var tiGua, yongGua;
  if (nums.dong <= 3) {
    tiGua = u; yongGua = l; // lower yao dong -> lower is yong
  } else {
    tiGua = l; yongGua = u; // upper yao dong -> upper is yong
  }
  // sheng ke
  var shengKe = calcShengKe(tiGua.wuXing, yongGua.wuXing);
  return { nums: nums, upper: u, lower: l, ti: tiGua, yong: yongGua, guaName: guaName, shengKe: shengKe };
}

var WU_XING = { '金':0, '水':1, '木':2, '火':3, '土':4 };
var WU_XING_NAMES = ['金','水','木','火','土'];

function calcShengKe(tiXing, yongXing) {
  if (tiXing === yongXing) return { text: '体用比和', ji: '大吉' };
  var ti = WU_XING[tiXing], yo = WU_XING[yongXing];
  var sheng = (ti + 1) % 5 === yo; // ti sheng yong
  var ke = (ti + 2) % 5 === yo || (ti + 3) % 5 === yo; // ti ke yong
  if (sheng) return { text: tiXing + '生' + yongXing + '（体生用）', ji: '小吉·付出', detail: tiXing + '生' + yongXing + '，你需主动付出努力，虽辛苦但终有收获' };
  if ((ti + 1) % 5 === yo && false) {}
  // yong sheng ti
  var ys = (yo + 1) % 5 === ti;
  if (ys) return { text: yongXing + '生' + tiXing + '（用生体）', ji: '大吉·得助', detail: yongXing + '生' + tiXing + '，外力相助，顺风顺水' };
  // ti ke yong
  var tk = false;
  for (var i = 1; i <= 2; i++) { if ((ti + i + 2) % 5 === yo) { tk = true; break; } }
  if (tk) return { text: tiXing + '克' + yongXing + '（体克用）', ji: '中吉·费力', detail: tiXing + '克' + yongXing + '，虽能掌控但有阻力' };
  return { text: yongXing + '克' + tiXing + '（用克体）', ji: '凶·受阻', detail: yongXing + '克' + tiXing + '，被压制或受制于人，事难成' };
}

function renderMeihuaPan(pan) {
  var html = '<div class="result-title">' + pan.guaName + '</div>';
  html += '<div class="gua-info">';
  html += '<span><strong>' + pan.upper.symbol + ' ' + pan.upper.name + '</strong> 上卦（' + pan.upper.wuXing + '）</span>';
  html += '<span><strong>' + pan.lower.symbol + ' ' + pan.lower.name + '</strong> 下卦（' + pan.lower.wuXing + '）</span>';
  html += '<span>动爻：第' + pan.nums.dong + '爻</span>';
  html += '</div>';
  html += '<div class="gua-info"><span>体卦：' + pan.ti.name + '（' + pan.ti.wuXing + '）</span>';
  html += '<span>用卦：' + pan.yong.name + '（' + pan.yong.wuXing + '）</span></div>';
  html += '<div class="gua-info"><span>体用关系：<strong>' + pan.shengKe.text + '</strong></span>';
  html += '<span>吉凶：<strong>' + pan.shengKe.ji + '</strong></span></div>';
  html += '<div class="gua-info"><span>' + pan.shengKe.detail + '</span></div>';
  document.getElementById('mhResultContent').innerHTML = html;
  document.getElementById('mhAIBtn').style.display = '';
}

function doAIMeihua() {
  if (!_meihuaPan) { Core.Toast.warn('请先起卦'); return; }
  var question = document.getElementById('mhQuestion').value || '请用梅花易数解读';
  var loading = document.getElementById('mhAILoading');
  var content = document.getElementById('mhAIContent');
  var actions = document.getElementById('mhAIActions');
  loading.style.display = '';
  content.textContent = '';
  document.getElementById('mhAI').style.display = '';
  actions.classList.remove('visible');
  
  var panStr = '起卦结果：' + _meihuaPan.guaName + '，体卦' + _meihuaPan.ti.name + _meihuaPan.ti.wuXing + '，用卦' + _meihuaPan.yong.name + _meihuaPan.yong.wuXing + '，体用关系：' + _meihuaPan.shengKe.text + '，吉凶：' + _meihuaPan.shengKe.ji;
  var system = Core.AI.buildSystemPrompt({ domain: 'meihua', pan: _meihuaPan, question: question });
  Core.AI.interpret({
    domain: 'meihua',
    prompt: question + (panStr ? '\n' + panStr : ''),
    system: system,
    pan: _meihuaPan,
    question: question,
    contentEl: content
  }).then(function(result) {
    loading.style.display = 'none';
    if (result && result.text) {
      content.textContent = escapeHtml(result.text);
      // 打字机效果
      var i = 0, txt = result.text;
      content.textContent = '';
      (function type() {
        if (i < txt.length) {
          content.textContent += txt.charAt(i);
          i++;
          setTimeout(type, 15);
        } else {
          actions.classList.add('visible');
        }
      })();
    }
  }).catch(function(e) {
    loading.style.display = 'none';
    content.textContent = '解读失败：' + e.message;
  });
}
