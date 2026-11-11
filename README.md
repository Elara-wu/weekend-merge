# Weekend Merge / 周末共识局

一个面向两人周末决策的可观察规划工具。双方填写兴趣、预算和避让项，服务端可生成三套上海行程；否决站点后可在保留锁定站点的前提下局部重排。

## 当前可用

- 前端提供双人偏好向导、隐私交接、三个演示候选方案和规划工作台，刷新后恢复当前步骤。浏览器工作台目前使用 `createDemoRun()` 展示 fixture，尚未连接 HTTP Agent。
- `POST /.netlify/functions/plan` 接受完整请求。`mode: "demo"` 返回固定展示事件；`mode: "live"` 运行受控 Agent。未配置 Gemini 时，实时请求会发出 `run.degraded` 并使用确定性规则方案。
- `POST /.netlify/functions/replan` 在本地替换一个被否决的目录地点，最多重排两轮，保留锁定站点，返回一个候选方案和差异。
- 两个端点成功时均返回经过共享 Schema 校验的 NDJSON 事件；请求错误返回结构化 JSON。

## 快速开始

要求 Node.js 22 或更高版本（Gemini 官方 SDK 的运行要求）。

```bash
npm install
npm run dev
```

Vite 前端默认位于 `http://localhost:5173`，目前无需密钥。要在本地调用 Netlify Functions，另需安装 Netlify CLI 并在项目目录运行 `netlify dev`；其默认代理地址为 `http://localhost:8888`。完整请求和可执行的 `curl` 示例见 [演示步骤](docs/DEMO.md)。

```bash
npm test -- --run
npm run build
```

## 服务端配置

`.env.example` 只列出变量名：`GEMINI_API_KEY` 和 `GEMINI_MODEL`。需要 Gemini 时将它们配置为 Netlify Function 的服务端环境变量；本地开发可放在未提交的 `.env` 中。两者都存在才会创建模型。不要使用 `VITE_` 前缀或将密钥放进浏览器代码。未配置或模型失败时，`mode: "live"` 会显式降级为规则规划；规则规划不请求天气，也不伪造预报。

部署需提供 Node.js 22+、Netlify Functions，以及可选的服务端 Gemini 配置。`netlify.toml` 已设置构建命令和 Node 版本。调用天气工具时依赖 Open-Meteo 的可用性；服务配额和使用政策需按实际部署核对。

## 接口与数据边界

| 路径 | 职责 |
| --- | --- |
| `src/contracts/agent.ts` | 前后端共享的请求、行程和事件 Schema |
| `netlify/functions/plan.ts` | 演示/实时规划入口与 NDJSON 响应 |
| `netlify/functions/replan.ts` | 确定性局部重排入口 |
| `netlify/functions/agent/` | Gemini 适配器、状态机、规则降级与五个工具 |
| `data/places.shanghai.json` | 带来源、开放时间及 `lastVerifiedAt` 的静态上海地点目录 |
| `src/demo/demoRun.ts` | 前端展示 fixture，不保证地点 ID 均在服务端目录中 |

五个白名单工具是 `get_weather`、`search_places`、`estimate_route`、`calculate_budget`、`validate_plan`。天气范围由服务端依据请求日期/时间固定为上海人民广场坐标；地点资料和路线、费用是静态数据或估算，不是实时营业、交通或票价信息。出发前应核对地点营业时间、票价和路线。详见 [架构](docs/ARCHITECTURE.md)。

成功响应的事件类型为 `run.started`、`step.started`、`tool.completed` / `tool.failed`、`plan.proposed`、`run.degraded`，并以一个 `run.completed` 或 `run.failed` 结束。初始规划完成事件的 `candidateIds` 有三个元素，没有 `diff`；重排完成事件的 `candidateIds` 有一个元素和必需的 `diff`。展示 fixture 中的候选地点并非全都收录于服务端目录，因此不能直接拿 `createDemoRun()` 的方案提交给重排接口。

## 文档

- [架构与降级路径](docs/ARCHITECTURE.md)
- [本地 API 演示](docs/DEMO.md)
- [产品需求与系统设计](docs/PRD.md)
- [Agent 事件契约](src/contracts/agent.ts)

## 项目状态

- [x] 协作骨架与共享契约
- [x] 双人偏好向导
- [x] 演示模式规划工作台
- [x] 测试、构建和 CI
- [x] 真实 Agent 工具链与规则降级
- [x] 局部重新规划 API
- [ ] 浏览器工作台接入实时 Agent 与重排 API
- [ ] Leaflet 地图与移动端抽屉
- [ ] 最终分享页与在线 Demo
