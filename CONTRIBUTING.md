# 协作指南（三人团队）

## 模块 ownership（减少冲突的关键）

按目录划分负责人，**尽量只改自己负责的文件**；跨模块改动先在 Issue / 群里沟通。

| 成员 | 负责目录 | 职责 |
| --- | --- | --- |
| A | `src/engine/`、`src/main.js` | 引擎、输入、渲染、相机、碰撞、主循环、性能 |
| B | `src/game/`、`src/entities/`、`src/config.js` | 玩法、武器、AI、回合、经济、数值平衡 |
| C | `src/ui/`、`src/world/`、`index.html`、`styles.css` | HUD、菜单、小地图、地图、美术、音效打磨 |

`src/config.js` 是共享数值文件：改 balance 前先沟通，避免互相覆盖。

## 分支策略

- `main`：稳定可玩分支，**开启保护**（Settings → Branches → Add rule），要求 PR + 至少 1 人 review。
- 功能分支：`feat/<模块>-<简述>`，如 `feat/ai-flank`、`feat/ui-buy-menu`、`fix/engine-collision`。
- 流程：从 `main` 拉分支 → 开发 → 提 PR → 队友 review → 合并 → 删分支。
- 每天开工先 `git pull --rebase origin main`，保持同步。

## 提交规范

`<type>: <简述>`，type 取 `feat / fix / refactor / art / balance / docs / chore`。
例：`balance: 降低狙击枪射速`、`art: 重绘木箱瓦片`。

## 本地运行与自测

```bash
python -m http.server 8000   # http://localhost:8000
```

提交前自测黄金路径：标题 → 购买 → 移动射击 → 下包 / 拆包 → 回合结算 → 夺冠。
打开浏览器控制台确认无报错。

## 避免冲突的约定

- 不提交二进制 / 生成物（见 `.gitignore`）。
- 美术尽量用**代码绘制或原创小尺寸素材**，避免大二进制文件难以 merge。
- 一个 PR 只做一件事，保持小而频繁。
- 用 GitHub **Issues + Projects 看板** 分配任务与跟踪进度。

## 发布

合并到 `main` 后由 GitHub Pages 自动部署（见 README）。发布前在 Pages 链接上完整试玩一遍。
