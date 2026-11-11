# Weekend Merge / 周末共识局

一个面向两人周末决策的可观察 AI Agent。双方分别填写兴趣、预算和雷区，系统通过天气、地点、路线与预算工具生成三套折中方案；否决某一站后，只重新规划受影响区段。

> 当前仓库已整合可交互前端设计：完整用户路径使用确定性演示事件运行，真实 Gemini Agent 将在相同契约下接入。

## 当前可用

- 创建上海周末计划。
- A / B 分别填写偏好，中间经过隐私交接遮罩。
- 展示共同偏好、冲突和硬约束。
- 在规划工作台比较三个候选方案。
- 查看天气、地点、路线和预算工具的执行证据。
- 切换方案，点赞、锁定、按理由局部替换，并保存协商状态。
- 最终行程、PNG 长图和不含个人偏好的只读分享。
- 浏览器刷新后恢复当前步骤。
- Netlify Function 以 NDJSON 返回同一套演示事件。

## 快速开始

要求 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

默认地址为 `http://localhost:5173`。

```bash
npm test -- --run
npm run build
```

应用默认使用演示模式，不需要任何 API Key。后续接入真实 Agent 时，将 `.env.example` 复制为 `.env.local` 并配置服务端环境变量；不要在 `VITE_` 变量或浏览器代码中放入密钥。

## 前端开发入口

| 路径 | 职责 |
| --- | --- |
| `src/features/wizard/` | 创建计划与 A/B 私密偏好向导 |
| `src/features/workbench/` | 候选方案、路线舞台、Agent 轨迹与站点操作 |
| `src/styles/` | 全局视觉 token、桌面与移动端布局 |
| `src/state/usePlanningStore.ts` | 可持久化的用户流程状态 |
| `src/contracts/agent.ts` | 前后端共享 Schema，不应在 UI 内复制类型 |
| `src/demo/demoRun.ts` | 前端可直接使用的稳定 Agent fixture |
| `netlify/functions/plan.ts` | NDJSON 接口桩，未来替换为真实编排器 |

前端开发不需要等待 Agent 后端。组件应消费 `AgentEvent[]` 或共享类型，后端保持相同事件协议即可替换演示数据。

## 协作边界

### 前端体验负责人

- 维护已实现的向导、地图工作台和手机详情/轨迹切换。
- 将当前路线抽象舞台替换为 Leaflet + OpenStreetMap。
- 对接真实局部重排结果，沿用点赞、否决、锁定和差异对比交互。
- 维护最终行程与分享长图，按需接入分享压缩。

### Agent / 全栈负责人

- 实现天气、地点、路线、预算和方案验证工具。
- 将 `plan` 接口桩替换为真实受控状态机。
- 接入 Gemini Function Calling、超时、限流和规则降级。
- 实现局部重新规划接口与后端场景测试。

### 共享规则

- 修改 `src/contracts/agent.ts` 必须双方评审。
- UI 不展示隐藏思维链，只显示工具、证据、约束和错误状态。
- Pull Request 必须通过测试和生产构建。
- `main` 保持可部署，功能开发使用短分支。

## Agent 事件协议

接口返回 `application/x-ndjson`，每行一个经过 Zod 校验的事件：

```text
run.started
step.started
tool.completed | tool.failed
plan.proposed
run.degraded
run.completed | run.failed
```

`createDemoRun()` 和 `/.netlify/functions/plan` 产生相同协议，前端可以在本地 fixture 与 HTTP 流之间切换，而无需修改展示组件。

## 文档

- [产品需求与系统设计](docs/PRD.md)
- [前端设计、模块入口与接入边界](docs/FRONTEND.md)
- [Agent 事件契约](src/contracts/agent.ts)
- [确定性演示运行](src/demo/demoRun.ts)

## 免费服务边界

MVP 计划使用 Open-Meteo、OpenStreetMap、仓库内上海地点数据和 Gemini 免费层。它们适合低流量作品集演示，但都有配额、署名或使用政策限制，不能描述为无限免费。完整边界见 [PRD](docs/PRD.md#13-免费服务边界)。

## 项目状态

- [x] 协作骨架与共享契约
- [x] 双人偏好向导
- [x] 演示模式规划工作台
- [x] 测试、构建和 CI
- [x] 响应式工作台与手机详情/轨迹切换
- [ ] Leaflet 真实地图
- [ ] 真实 Agent 工具链
- [x] 锁定保护、局部替换演示与差异显示
- [ ] 后端真实局部重新规划
- [x] 最终分享页与 PNG 长图
- [ ] 在线部署
