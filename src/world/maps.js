import { TILECODE as C } from './map.js';

// 高保真拓扑复刻（64×48）：保留原图全部命名区域/通道/门/掩体的相对位置。
// 瓦片美术原创，不含 Valve 地图数据。labels 为点位标注。
export const MAPS = {
  outpost: {
    id: 'outpost', name: '沙丘前哨', subtitle: '原创地图', cols: 48, rows: 32,
    sites: { A: [4, 12, 11, 18], B: [36, 12, 43, 18] },
    spawns: { T: [20, 1, 27, 3], CT: [20, 28, 27, 30] },
    labels: [],
    paint(f) {
      f(0, 0, 47, 0, C.WALL); f(0, 31, 47, 31, C.WALL); f(0, 0, 0, 31, C.WALL); f(47, 0, 47, 31, C.WALL);
      f(14, 5, 19, 26, C.WALL); f(14, 15, 19, 17, C.FLOOR);
      f(28, 5, 33, 26, C.WALL); f(28, 15, 33, 17, C.FLOOR);
      f(4, 12, 11, 18, C.SITE_A); f(36, 12, 43, 18, C.SITE_B);
      f(20, 1, 27, 3, C.SPAWN_T); f(20, 28, 27, 30, C.SPAWN_CT);
      for (const [c, r] of [[22, 9], [25, 12], [22, 20], [25, 23], [6, 8], [10, 22], [3, 15], [41, 8], [37, 22], [44, 15], [6, 13], [41, 17], [13, 10], [34, 21]]) f(c, r, c, r, C.CRATE);
    },
  },

  dust2: {
    id: 'dust2', name: '炽热沙城二', subtitle: 'Dust II · 三点扩建', cols: 96, rows: 72,
    sites: { A: [76, 30, 88, 38], B: [8, 30, 20, 38], C: [42, 52, 54, 60] },
    spawns: { T: [44, 2, 52, 6], CT: [42, 64, 54, 69] },
    labels: [
      [48, 24, '中路'], [48, 16, '中门'], [14, 20, 'B通道'], [82, 20, 'Long A'], [32, 33, 'B门'], [64, 33, 'A门'],
      [48, 50, 'C点'], [48, 66, 'CT'], [48, 4, 'T'], [12, 56, '西巷'], [84, 56, '东巷'], [32, 45, 'connector'], [64, 45, 'connector'],
    ],
    paint(f) {
      f(0, 0, 95, 0, C.WALL); f(0, 71, 95, 71, C.WALL); f(0, 0, 0, 71, C.WALL); f(95, 0, 95, 71, C.WALL);
      f(44, 2, 52, 6, C.SPAWN_T); f(42, 64, 54, 69, C.SPAWN_CT);
      f(24, 10, 40, 48, C.WALL); f(24, 12, 40, 14, C.FLOOR); f(24, 32, 40, 34, C.FLOOR); f(24, 44, 40, 46, C.FLOOR);
      f(56, 10, 72, 48, C.WALL); f(56, 12, 72, 14, C.FLOOR); f(56, 32, 72, 34, C.FLOOR); f(56, 44, 72, 46, C.FLOOR);
      f(44, 16, 52, 16, C.WALL); f(47, 16, 49, 16, C.FLOOR);       // 中门 choke + 两侧小路
      f(24, 50, 40, 62, C.WALL); f(24, 56, 40, 58, C.FLOOR);       // 西南巷
      f(56, 50, 72, 62, C.WALL); f(56, 56, 72, 58, C.FLOOR);       // 东南巷
      f(8, 30, 20, 38, C.SITE_B); f(76, 30, 88, 38, C.SITE_A); f(42, 52, 54, 60, C.SITE_C);
      for (const [c, r] of [[12, 33], [16, 35], [10, 36], [80, 33], [84, 35], [86, 36], [46, 55], [50, 57], [44, 58], [47, 24], [49, 30], [46, 40], [50, 44], [16, 22], [8, 26], [84, 22], [88, 26], [30, 33], [62, 33], [30, 45], [62, 45], [30, 57], [62, 57]]) f(c, r, c, r, C.CRATE);
      for (const [c, r] of [[12, 16], [80, 16]]) f(c, r, c, r, C.ROCK);
      for (const [c, r] of [[30, 8], [64, 8], [46, 20]]) f(c, r, c, r, C.BARREL);
      for (const [c, r] of [[36, 66], [58, 66]]) f(c, r, c, r, C.SANDBAG);
      for (const [c, r] of [[12, 44], [84, 44]]) f(c, r, c, r, C.CACTUS);
    },
  },

  mirage: {
    id: 'mirage', name: '荒漠迷城', subtitle: 'Mirage · 精修双楼', cols: 96, rows: 72,
    sites: { B: [8, 10, 22, 18], A: [74, 10, 88, 18] },
    spawns: { CT: [42, 2, 54, 7], T: [42, 64, 54, 69] },
    upper: [
      { rect: [6, 2, 22, 8], overlook: [8, 10, 22, 18], name: 'apps' },
      { rect: [74, 2, 90, 8], overlook: [74, 10, 88, 18], name: 'palace' },
    ],
    stairs: [
      { rect: [18, 8, 20, 9], up: [19, 5], down: [19, 12] },
      { rect: [76, 8, 78, 9], up: [77, 5], down: [77, 12] },
    ],
    labels: [
      [48, 24, '中路'], [48, 30, '中门'], [34, 14, '窗'], [62, 14, 'connector'], [71, 14, 'jungle'],
      [14, 30, 'B通道'], [84, 30, 'A通道'], [15, 50, 'market'], [81, 50, 'A ramp'],
      [14, 5, 'apps·2F'], [82, 5, 'palace·2F'], [48, 4, 'CT'], [48, 66, 'T'],
    ],
    paint(f) {
      f(0, 0, 95, 0, C.WALL); f(0, 71, 95, 71, C.WALL); f(0, 0, 0, 71, C.WALL); f(95, 0, 95, 71, C.WALL);
      f(42, 2, 54, 7, C.SPAWN_CT); f(42, 64, 54, 69, C.SPAWN_T);
      f(6, 2, 22, 7, C.WALL); f(74, 2, 90, 7, C.WALL);                 // 二楼建筑体（地面不可穿）
      f(24, 10, 40, 44, C.WALL); f(56, 10, 72, 44, C.WALL);           // 中路两侧主墙
      f(26, 46, 40, 62, C.WALL); f(56, 46, 70, 62, C.WALL);           // market / A ramp 侧墙
      f(41, 18, 43, 44, C.WALL); f(53, 18, 55, 44, C.WALL);           // 中路收窄
      f(18, 19, 23, 43, C.WALL); f(73, 19, 78, 43, C.WALL);           // B/A 通道外侧墙
      f(72, 58, 90, 62, C.WALL);                                     // A ramp 底墙
      f(28, 12, 40, 16, C.FLOOR); f(41, 12, 43, 16, C.FLOOR);         // 窗 + 窗→中路
      f(36, 8, 41, 11, C.FLOOR);                                     // 窗→CT
      f(24, 13, 27, 15, C.FLOOR);                                    // 窗→B
      f(56, 12, 68, 16, C.FLOOR); f(53, 12, 55, 16, C.FLOOR);         // connector + →中路
      f(55, 8, 60, 11, C.FLOOR);                                     // connector→CT
      f(69, 12, 73, 16, C.FLOOR);                                    // jungle→A
      f(44, 30, 52, 30, C.WALL); f(47, 30, 49, 30, C.FLOOR);          // 中门 choke
      f(26, 48, 40, 50, C.FLOOR);                                    // market→中路
      f(56, 48, 70, 50, C.FLOOR);                                    // A ramp→中路
      f(8, 10, 22, 18, C.SITE_B); f(74, 10, 88, 18, C.SITE_A);
      for (const [c, r] of [[12, 13], [80, 13], [50, 14], [46, 50], [10, 48], [80, 48], [32, 14], [62, 14]]) f(c, r, c, r, C.CRATE);
      for (const [c, r] of [[16, 15], [84, 15], [50, 54], [20, 46], [76, 46]]) f(c, r, c, r, C.ROCK);
      for (const [c, r] of [[45, 12], [50, 32], [16, 52], [86, 52], [14, 36], [82, 36], [30, 66], [66, 66]]) f(c, r, c, r, C.BARREL);
      for (const [c, r] of [[10, 16], [86, 16], [45, 28], [48, 58], [8, 56], [70, 14]]) f(c, r, c, r, C.SANDBAG);
      for (const [c, r] of [[12, 26], [84, 26], [30, 5], [66, 5]]) f(c, r, c, r, C.CACTUS);
    },
  },
};

export const MAP_ORDER = ['mirage', 'dust2'];
