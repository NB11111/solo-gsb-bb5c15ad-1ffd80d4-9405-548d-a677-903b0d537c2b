# 换气接力 · 合唱排练换气规划

一个帮助合唱团安排「换气接力」的 Web 工具：为每位歌手在统一秒轴上规划换气区间，系统按半开区间 `[start, end)` 实时计算各声部同时在唱的人数，把低于该声部最低发声人数要求的时段合并并标红；还可以对任意换气段做 ±N 秒整数穷举寻优，一键找到让全曲未达标时间最短的新位置。

技术栈：React 18 + TypeScript + Vite，纯前端，数据保存在浏览器 localStorage。

## 一键启动（Docker Compose）

```bash
docker compose up --build
```

然后访问 **http://localhost:8080**

也可以只用 Docker：

```bash
docker build -t breath-relay .
docker run --rm -p 8080:80 breath-relay
```

## 本地开发

```bash
npm install
npm run dev        # http://localhost:5173
```

构建产物预览：

```bash
npm run build
npm run preview
```

## 功能说明

- **声部与歌手管理**：左侧栏添加/删除声部与歌手，设置每个声部的「最低发声人数」与全曲时长。
- **换气区间编辑**：在中间时间轴上
  - 双击歌手轨道空白处：新增换气段（默认 2 秒）；
  - 拖动换气段：整体移动（自动避开同歌手其它区间、不越界）；
  - 拖动换气段两端：调整时长（最短 0.5 秒）；
  - 点击选中，Delete / Backspace 删除。
- **实时覆盖计算**：按半开区间扫描线算法统计每个声部每时刻的在唱人数；人数不足的时段自动合并，在声部覆盖行上以红色条纹标出（悬停可见最少人数与缺口）。
- **换气段寻优**：选中换气段后，在 ±N 秒（整数）范围内穷举所有「保持时长不变、不与该歌手其它区间重叠、不越界」的位置，依次最小化：
  1. 全曲未达标总秒数；
  2. 位移量 |Δt|；
  3. 平局取更早时刻。
- **修复前后预览**：寻优结果以虚线框预览新位置、原位置半透明显示，覆盖行与未达标统计实时切换为「修复后」视图；候选列表可切换预览不同位移，确认后一键应用。
- **示例数据与本地保存**：首次打开自动载入示例工程；所有修改自动保存到浏览器 localStorage，刷新不丢失；支持导出 / 导入 JSON 工程文件。

## 目录结构

```
src/
  lib/
    coverage.ts     # 半开区间扫描线：人数不足时段的合并与统计
    optimize.ts     # ±N 秒整数穷举寻优（保持时长、避免重叠、三级目标排序）
    constraints.ts  # 拖动/缩放的边界与重叠约束
    sample.ts       # 示例工程
    storage.ts      # localStorage 读写与数据校验
  components/
    Timeline.tsx        # 秒轴、声部覆盖行、歌手行
    BreathBlock.tsx     # 可拖动/缩放的换气块
    Sidebar.tsx         # 声部与歌手管理
    OptimizerPanel.tsx  # 寻优与前后差异预览
  App.tsx
```
