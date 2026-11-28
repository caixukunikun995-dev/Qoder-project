// CS Rush 全局配置与数值平衡（v0.3 起经济/武器/赛制按 CS2 竞技规则复刻）
export const TILE = 16;
export const VIEW_W = 480;
export const VIEW_H = 270;
export const VIEW_ZOOM = 0.9;   // 视野加宽：确保先看到敌人再交火（可视半宽 > 机器人射程）
export const WALL_H = 10;      // 墙体伪 3D 高度
export const CRATE_H = 7;      // 木箱伪 3D 高度
export const CHAR_SCALE = 1.2; // 角色 sprite 放大（更清晰）

export const TEAM = { CT: 'CT', T: 'T' };
export const TEAM_SIZE = 5;

// 赛制：half=每半场回合数，win=夺冠胜场，tie=触发加时弹窗的比分和
export const FORMATS = {
  mr6: { id: 'mr6', name: '7 分制 (MR6)', half: 6, win: 7, tie: 6 },
  mr12: { id: 'mr12', name: '13 分制 (MR12)', half: 12, win: 13, tie: 12 },
};
export const OT = { half: 3, win: 4, start: 16000 };

export const PLAYER = { radius: 6, hp: 100, speed: 98, walkSpeed: 46 };

export const TIMING = {
  buy: 15, round: 115, bomb: 40, plant: 3.2, defuse: 10, defuseKit: 5, roundEnd: 4,
  matchMin: 3, matchMax: 23, loading: 2.2,
};

// CS2 竞技经济
export const ECON = {
  start: 800, max: 16000, otStart: 16000,
  winElim: 3250, winTime: 3250, winBomb: 3500, winDefuse: 3500,
  lossBase: 1400, lossStep: 500, lossMax: 3400,
  plant: 300, defuse: 300,
};

export const COLORS = {
  bg: '#14161c',
  floor: '#c9a86a', floorAlt: '#c1a062',
  wall: '#6e5b3e', wallTop: '#8a7452',
  crate: '#9c7b46', crateTop: '#b8935a',
  siteA: '#b8563f', siteB: '#3f7fb8',
  ct: '#4f8fce', ctDark: '#2f5f8e',
  t: '#cf8f4f', tDark: '#8e5f2f',
  player: '#8fd3ff',
  bullet: '#fff2a8',
  blood: '#c0392b',
  bomb: '#e05a5a',
  text: '#f2ead8', dim: '#9a8f78',
  panel: 'rgba(18,20,26,0.86)', panelLine: '#3a3f4b',
  good: '#7fce7f', bad: '#e07a6a', money: '#9fd08a',
  buyBg: 'rgba(20,24,30,0.92)', buyCell: 'rgba(255,255,255,0.05)', buyHi: 'rgba(90,160,255,0.25)', buyBlue: '#5aa0ff',
};

// 武器库：side='T'/'CT'/'both'；cat 对应购买菜单列；kill=击杀奖励；pellets=霰弹丸数
export const WEAPONS = {
  glock:  { id: 'glock',  name: '格洛克18型', side: 'T',  cat: 'pistol', price: 200,  dmg: 28, delay: 0.15, mag: 20, reserve: 120, reload: 1.5, spread: 0.050, speed: 520, range: 280, auto: false, kill: 300 },
  usp:    { id: 'usp',    name: 'USP消音版',  side: 'CT', cat: 'pistol', price: 200,  dmg: 33, delay: 0.17, mag: 12, reserve: 24,  reload: 1.5, spread: 0.040, speed: 540, range: 300, auto: false, kill: 300 },
  dual:   { id: 'dual',   name: '双持贝瑞塔', side: 'both', cat: 'pistol', price: 300, dmg: 32, delay: 0.12, mag: 30, reserve: 120, reload: 1.8, spread: 0.070, speed: 520, range: 260, auto: false, kill: 300 },
  p250:   { id: 'p250',   name: 'P250',       side: 'both', cat: 'pistol', price: 300, dmg: 38, delay: 0.17, mag: 13, reserve: 26,  reload: 1.5, spread: 0.045, speed: 540, range: 280, auto: false, kill: 300 },
  tec9:   { id: 'tec9',   name: 'Tec-9',      side: 'T',  cat: 'pistol', price: 500,  dmg: 33, delay: 0.12, mag: 18, reserve: 72,  reload: 1.6, spread: 0.060, speed: 540, range: 280, auto: false, kill: 300 },
  fn57:   { id: 'fn57',   name: 'FN57',       side: 'CT', cat: 'pistol', price: 500,  dmg: 32, delay: 0.15, mag: 20, reserve: 100, reload: 1.5, spread: 0.050, speed: 560, range: 300, auto: false, kill: 300 },
  deagle: { id: 'deagle', name: '沙漠之鹰',   side: 'both', cat: 'pistol', price: 700, dmg: 63, delay: 0.35, mag: 7,  reserve: 35,  reload: 1.8, spread: 0.030, speed: 640, range: 340, auto: false, kill: 300 },

  mac10:  { id: 'mac10',  name: 'MAC-10',     side: 'T',  cat: 'mid', price: 1050, dmg: 29, delay: 0.075, mag: 30, reserve: 100, reload: 1.8, spread: 0.075, speed: 540, range: 260, auto: true, kill: 600 },
  mp9:    { id: 'mp9',    name: 'MP9',        side: 'CT', cat: 'mid', price: 1250, dmg: 26, delay: 0.070, mag: 30, reserve: 120, reload: 1.7, spread: 0.070, speed: 540, range: 260, auto: true, kill: 600 },
  mp5:    { id: 'mp5',    name: 'MP5-SD',     side: 'both', cat: 'mid', price: 1400, dmg: 27, delay: 0.080, mag: 30, reserve: 120, reload: 1.8, spread: 0.060, speed: 540, range: 270, auto: true, kill: 600 },
  mp7:    { id: 'mp7',    name: 'MP7',        side: 'both', cat: 'mid', price: 1400, dmg: 29, delay: 0.080, mag: 30, reserve: 120, reload: 1.8, spread: 0.065, speed: 550, range: 270, auto: true, kill: 600 },
  bizon:  { id: 'bizon',  name: 'PP-野牛',    side: 'both', cat: 'mid', price: 1300, dmg: 27, delay: 0.080, mag: 64, reserve: 120, reload: 2.0, spread: 0.080, speed: 540, range: 250, auto: true, kill: 600 },
  xm1014: { id: 'xm1014', name: 'XM1014',     side: 'both', cat: 'mid', price: 2000, dmg: 12, delay: 0.80, mag: 7,  reserve: 32,  reload: 2.4, spread: 0.120, speed: 480, range: 160, auto: false, kill: 900, pellets: 6 },

  galil:  { id: 'galil',  name: '加利尔AR',   side: 'T',  cat: 'rifle', price: 1800, dmg: 30, delay: 0.09, mag: 35, reserve: 90, reload: 2.2, spread: 0.040, speed: 640, range: 380, auto: true, kill: 300 },
  famas:  { id: 'famas',  name: '法玛斯',     side: 'CT', cat: 'rifle', price: 1950, dmg: 30, delay: 0.09, mag: 25, reserve: 90, reload: 2.2, spread: 0.040, speed: 640, range: 380, auto: true, kill: 300 },
  ak47:   { id: 'ak47',   name: 'AK-47',      side: 'T',  cat: 'rifle', price: 2700, dmg: 36, delay: 0.10, mag: 30, reserve: 90, reload: 2.4, spread: 0.035, speed: 680, range: 400, auto: true, kill: 300 },
  m4a4:   { id: 'm4a4',   name: 'M4A4',       side: 'CT', cat: 'rifle', price: 2900, dmg: 33, delay: 0.09, mag: 30, reserve: 90, reload: 2.2, spread: 0.033, speed: 660, range: 400, auto: true, kill: 300 },
  m4a1s:  { id: 'm4a1s',  name: 'M4A1消音版', side: 'CT', cat: 'rifle', price: 2900, dmg: 38, delay: 0.10, mag: 20, reserve: 80, reload: 2.2, spread: 0.030, speed: 660, range: 400, auto: true, kill: 300 },
  sg553:  { id: 'sg553',  name: 'SG553',      side: 'T',  cat: 'rifle', price: 3000, dmg: 33, delay: 0.10, mag: 30, reserve: 90, reload: 2.4, spread: 0.030, speed: 680, range: 420, auto: true, kill: 300 },
  aug:    { id: 'aug',    name: 'AUG',        side: 'CT', cat: 'rifle', price: 3300, dmg: 33, delay: 0.10, mag: 30, reserve: 90, reload: 2.4, spread: 0.030, speed: 680, range: 420, auto: true, kill: 300 },
  ssg08:  { id: 'ssg08',  name: 'SSG08',      side: 'both', cat: 'rifle', price: 1700, dmg: 88, delay: 1.20, mag: 10, reserve: 90, reload: 2.6, spread: 0.006, speed: 900, range: 520, auto: false, kill: 300 },
  awp:    { id: 'awp',    name: 'AWP',        side: 'both', cat: 'rifle', price: 4750, dmg: 115, delay: 1.40, mag: 5, reserve: 30, reload: 2.8, spread: 0.004, speed: 950, range: 560, auto: false, kill: 100 },

  zeus:   { id: 'zeus',   name: '宙斯x27电击枪', side: 'both', cat: 'gear', price: 200, dmg: 200, delay: 1.0, mag: 1, reserve: 0, reload: 0, spread: 0, speed: 0, range: 26, auto: false, kill: 0 },
};

export const GEAR = {
  kevlar: { id: 'kevlar', name: '防弹背心',     price: 650 },
  helmet: { id: 'helmet', name: '防弹背心&头盔', price: 1000 },
  kit:    { id: 'kit',    name: '拆弹器',       price: 400, side: 'CT' },
};

// 投掷物：fire 在 T/CT 名称与价格不同
export const NADES = {
  flash: { id: 'flash', name: '闪光震撼弹', price: 200 },
  smoke: { id: 'smoke', name: '烟雾弹',     price: 300 },
  he:    { id: 'he',    name: '高爆手雷',   price: 300 },
  fire:  { id: 'fire',  nameT: '燃烧瓶', nameCT: '燃烧弹', priceT: 400, priceCT: 600 },
  decoy: { id: 'decoy', name: '诱饵弹',     price: 50 },
};

// 投掷：按住 G 蓄力，松手抛出。抛物线 + 落地反弹，落点由同一套物理预览
export const NADE_THROW = {
  chargeTime: 0.5, minPower: 0.35,
  speedMin: 95, speedMax: 230,
  vzMin: 95, vzMax: 150, gravity: 520, z0: 12,
  fuse: 1.5, bounce: 0.45, groundFriction: 4.5, restVz: 18,
};

export const BOT = {
  radius: 6, hp: 70, speed: 62,
  reaction: 0.8, aimError: 0.30, sight: 160, fireRange: 140,
  dmgMul: 0.45, fireMul: 1.8,
};

export const defaultPistol = (side) => (side === TEAM.T ? 'glock' : 'usp');
export const weaponsFor = (side, cat) => Object.values(WEAPONS).filter(w => w.cat === cat && (w.side === 'both' || w.side === side));

// 散射模型：spread = 基础 + 移动项 + 连射热量项（叠加）。
// 系数按「跑打+满热量时可靠命中距离」标定：pistol≈7格 / mid≈4格 / rifle·sniper≈2格（1格=TILE）。
export const spreadCat = (def) => (def.id === 'awp' || def.id === 'ssg08') ? 'sniper' : (def.id === 'xm1014' ? 'shotgun' : def.cat);
export const SPREAD = {
  move:      { pistol: 0.044, mid: 0.035, rifle: 0.090, sniper: 0.186, shotgun: 0, gear: 0.020 },
  heatMax:   { pistol: 0.024, mid: 0.042, rifle: 0.090, sniper: 0.097, shotgun: 0, gear: 0.020 },
  heatPerShot:{ pistol: 0.004, mid: 0.012, rifle: 0.030, sniper: 0.050, shotgun: 0, gear: 0.010 },
  heatDecay: { pistol: 0.060, mid: 0.100, rifle: 0.120, sniper: 0.100, shotgun: 0, gear: 0.060 },
};
export const isSniper = (def) => def.id === 'awp' || def.id === 'ssg08';

// 狙击长按瞄准：zoom 聚焦鼠标、镜半径随按住时间收缩、镜外渐模糊
export const SCOPE = { zoom: 1.7, focus: 0.55, time: 0.9, r0: 90, r1: 26, blur: 6 };
