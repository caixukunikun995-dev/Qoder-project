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
    id: 'dust2', name: '炽热沙城二', subtitle: 'Dust II · 高保真复刻', cols: 64, rows: 48,
    sites: { A: [46, 38, 58, 44], B: [6, 38, 16, 44] },
    spawns: { T: [30, 2, 38, 5], CT: [24, 42, 34, 46] },
    labels: [
      [30, 24, '中路'], [30, 9, '中门'], [56, 20, 'Long A'], [52, 9, 'Long门'], [56, 32, 'pit'],
      [7, 20, 'B通道'], [20, 35, 'B门'], [42, 35, 'A门'], [29, 44, 'CT'], [34, 3, 'T'],
    ],
    paint(f) {
      f(0, 0, 63, 0, C.WALL); f(0, 47, 63, 47, C.WALL); f(0, 0, 0, 47, C.WALL); f(63, 0, 63, 47, C.WALL);
      f(30, 2, 38, 5, C.SPAWN_T); f(24, 42, 34, 46, C.SPAWN_CT);
      f(6, 38, 16, 44, C.SITE_B); f(46, 38, 58, 44, C.SITE_A);   // 包点靠近 CT 侧
      f(27, 8, 34, 8, C.WALL); f(30, 8, 31, 8, C.FLOOR);          // 中路双门
      f(14, 6, 26, 40, C.WALL); f(14, 34, 26, 36, C.FLOOR);       // 左墙 + B门
      f(36, 6, 46, 40, C.WALL); f(36, 34, 46, 36, C.FLOOR);       // 右墙 + A门
      f(48, 8, 60, 8, C.WALL); f(52, 8, 54, 8, C.FLOOR);          // Long门
      for (const [c, r] of [[30, 20], [31, 20], [52, 40], [55, 42], [10, 40], [13, 42], [56, 20], [52, 26], [7, 20], [10, 26], [30, 36]]) f(c, r, c, r, C.CRATE);
    },
  },

  mirage: {
    id: 'mirage', name: '荒漠迷城', subtitle: 'Mirage · 高保真复刻', cols: 64, rows: 48,
    sites: { A: [46, 6, 58, 14], B: [6, 6, 16, 14] },
    spawns: { CT: [26, 2, 37, 6], T: [26, 41, 37, 45] },
    labels: [
      [31, 24, '中路'], [40, 11, 'connector'], [23, 11, '窗'], [56, 20, 'palace'],
      [9, 20, 'apps'], [50, 10, 'tetris'], [46, 8, 'jungle'], [14, 12, 'market'],
    ],
    paint(f) {
      f(0, 0, 63, 0, C.WALL); f(0, 47, 63, 47, C.WALL); f(0, 0, 0, 47, C.WALL); f(63, 0, 63, 47, C.WALL);
      f(26, 2, 37, 6, C.SPAWN_CT); f(26, 41, 37, 45, C.SPAWN_T);
      f(20, 8, 27, 39, C.WALL); f(20, 10, 27, 12, C.FLOOR);           // 窗/short
      f(36, 8, 43, 39, C.WALL); f(36, 10, 43, 12, C.FLOOR);           // connector
      f(6, 6, 16, 14, C.SITE_B); f(46, 6, 58, 14, C.SITE_A);
      for (const [c, r] of [[31, 20], [32, 24], [50, 10], [54, 8], [46, 8], [44, 12], [10, 10], [13, 8], [9, 20], [6, 26], [56, 24], [52, 30], [14, 12]]) f(c, r, c, r, C.CRATE);
    },
  },
};

export const MAP_ORDER = ['dust2', 'mirage'];
