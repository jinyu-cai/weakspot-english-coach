# UI 重设计说明 —— The WeakSpot Journal（红笔编辑部）

> 方向：**编辑出版风（Editorial）**。WeakSpot 的产品本质是"诊断、批改、证据"，因此整套界面被设计成一份会持续更新的学习刊物：纸面、油墨、红笔批注、刊头、编号条目。与常见的"圆角 SaaS 仪表盘"彻底拉开差异，同时保持专业与克制。仅调整视觉系统，不改动任何功能、路由或数据流。

## 1. 设计概念

| 元素 | 隐喻 | 实现 |
| --- | --- | --- |
| 纸面 | 学习刊物的纸 | 暖纸白底 `oklch(0.965 0.009 88)` |
| 油墨 | 正文与结构 | 近黑暖墨 `oklch(0.24 0.018 60)`；边框用 15% 透明墨色（hairline 分栏线），不用灰色 |
| 红笔 | 老师批改的朱红笔 | 主色 vermilion `oklch(0.5 0.19 30)`：CTA、激活态、品牌标、强调字 |
| 刊头 | 报纸头版 | 首页 Hero = 刊头栏 + 衬线大标题 + 三栏分线入口；登录页 = 杂志封面 |
| 编号 | 目录条目 | 等宽字体编号 `01 / 02 / 03`、mono 大写小标签（`.label-mono`） |
| 衬线标题 | 印刷排版 | Fraunces（英文斜体点缀）；中文自动回落 Songti / 宋体系 |

## 2. 设计令牌

- **字体**：`--font-heading` = Fraunces → Songti SC → Noto Serif CJK → STSong（中英都是"衬线刊名"）；正文 Inter；数据与标签 Geist Mono。
- **圆角**：基准 `0.375rem`（近乎直角的锐利印刷感）。
- **阴影**：`0 1px 0 + 0 16px 36px -16px` 油墨色低透明 —— 近乎平面的纸感。
- **深色模式**："夜油墨"——暖黑底 + 纸色文字 + 更亮的朱红。
- **四套配色**（id 不变，localStorage 兼容；纸墨表面恒定，只换强调色色相）：

| id | 中 / 英 | 主色 |
| --- | --- | --- |
| `cream`（默认） | 编辑红 / Editor's Red | 朱红 `oklch(0.5 0.19 30)` |
| `green` | 墨绿 / Forest | `oklch(0.48 0.1 155)` |
| `sky` | 蓝图 / Blueprint | `oklch(0.46 0.12 255)` |
| `blossom` | 绛紫 / Plum | `oklch(0.47 0.14 340)` |

- 图表色板：朱红 / 墨绿 / 琥珀 / 油墨 / 蓝图蓝（chart-1 随配色）。
- 语义色区分：强调红（primary）≠ 错误红（danger 更深的绯红 `oklch(0.46 0.16 22)`）。

## 3. 标志性细节（Review 时重点看）

1. **首页头版**：刊头行（mono 小标签 `FIRST SESSION / WEAKSPOT JOURNAL`）→ Fraunces 大标题（英文斜体红字 / 中文红色强调）→  hairline 三栏编号入口（`01 写一段 / 02 开始对话 / 03 导入历史`），悬停时箭头浮现。
2. **回访视图**：标题区用底部分栏线收口，衬线大标题。
3. **侧边栏**：刊名 Fraunces 字标 + mono 大写副标；导航组标签全部 mono 化；激活项为左侧红色指示条；底部 slogan 变为"版权栏/办刊宗旨"式 colophon。
4. **顶栏**：当前页名用衬线刊名式标题 + mono 描述行。
5. **登录页**：左侧封面栏（mono 栏目名 + 衬线大标题 + 底部细线安全说明）。
6. **组件层**：按钮/卡片圆角收紧；卡片边框从灰色改为油墨 hairline。

## 4. 改动文件

| 文件 | 改动 |
| --- | --- |
| `app/globals.css` | 全套纸/墨/红令牌（亮/暗/四配色）、hairline 边框、`.label-mono` 工具类、`.font-heading` 字距 |
| `app/layout.tsx` | 引入 Fraunces（含 italic）；themeColor 更新为纸色/墨色 |
| `components/brand-mark.tsx` | 红底准星方块（锐利圆角） |
| `components/nav-sidebar.tsx` | 刊头字标、mono 组标签、红色指示条、colophon |
| `components/app-shell.tsx` | 衬线页名 + mono 描述 |
| `app/page.tsx` | 头版 Hero、编号三栏、mono eyebrow、hairline 分隔 |
| `components/login-page.tsx` | 杂志封面式布局与文案层级 |
| `components/ui/button.tsx` / `card.tsx` | 圆角与边框收紧 |
| `lib/palette.ts` / `lib/i18n.ts` | 配色预览与名称（编辑红/墨绿/蓝图/绛紫） |

其余页面继承令牌层自动换肤；`coach-scene.tsx` 情景插画为学习内容，保留原色。

## 5. 验证

- `npx tsc --noEmit` ✅
- `npx eslint app components lib` ✅ 0 错误
- `npx next build` ✅ 18 个路由全部编译通过

## 6. 后续可选深化

- Dashboard 报告化：技能图加"图表编号"（FIG. 01）与栏线。
- DiagnosticReport 批改化：错误处加红色下划线波浪（red-pen underline）样式。
- 打印样式：`@media print` 输出"学习报告"PDF 风。
