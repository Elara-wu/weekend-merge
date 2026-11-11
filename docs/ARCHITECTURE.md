# Agent 架构

## 请求与事件

```mermaid
flowchart LR
  Client[HTTP 客户端] --> Plan[POST /plan]
  Client --> Replan[POST /replan]
  Plan -->|mode demo| Fixture[createDemoRun 展示 fixture]
  Plan -->|mode live| Runtime[受控规划状态机]
  Runtime --> Model[Gemini 可选]
  Runtime --> Tools[五个白名单工具]
  Runtime --> Rules[确定性规则规划]
  Replan --> Local[本地候选搜索与验证]
  Fixture --> Events[校验后的 NDJSON]
  Runtime --> Events
  Local --> Events
```

浏览器当前直接读取 `createDemoRun()`，未调用图中的 HTTP 端点。两个端点先用 `src/contracts/agent.ts` 中的 Zod Schema 校验 HTTP 请求：无效 JSON 或请求字段会在进入状态机前收到 HTTP 400 JSON 错误，不产生事件。已进入状态机后的运行失败才以 `run.failed` 事件结束。成功响应为 `application/x-ndjson`，每行一个事件，最后恰好一个 `run.completed` 或 `run.failed`。

## 初始规划

```mermaid
stateDiagram-v2
  [*] --> VALIDATE
  VALIDATE --> ANALYZE: 请求与目录有效
  VALIDATE --> Failed: 运行时目录无效
  ANALYZE --> GATHER: 本地共识分析
  GATHER --> PROPOSE: 模型结果或规则降级
  PROPOSE --> VERIFY: 三个不同候选
  VERIFY --> Completed: 全部验证通过
  VERIFY --> Failed: 无三套有效方案
```

初始实时规划最多发起 **2 次模型请求**，最多执行 **6 次模型请求的工具调用**，且只接受 `get_weather`、`search_places`、`estimate_route`、`calculate_budget`、`validate_plan`。工具名与参数在服务端校验；第二次模型响应不能再触发工具执行。代码负责请求校验、地点目录、偏好共识、工具调用、候选数据规范化、路线与预算重算、硬约束验证，以及向客户端发出事件。模型只提议工具调用和候选行程，不能决定最终是否通过验证。每个候选的确定性验证独立于六次模型请求工具调用，事件中按工具汇总为三条 `verification: true` 记录。

缺少 `GEMINI_API_KEY` 或 `GEMINI_MODEL`、模型出错、无效调用、工具失败或候选验证失败时，运行会发出 `run.degraded` 并尝试规则规划。规则方案也必须通过同一验证；若无法形成三套有效行程，终止于 `run.failed`。未调用天气工具就没有天气证据。天气工具的查询范围由服务端从请求日期和时间生成，坐标固定在上海人民广场附近；Open-Meteo 失败返回 `WEATHER_UNAVAILABLE`，不会生成虚构天气。

初始成功结果的 `candidateIds` 恰好三个，且没有 `diff`。`mode: "demo"` 是固定展示事件，不执行实时规划。其部分 `placeId` 不在服务端地点目录中，不能作为重排输入。

## 局部重排

`POST /.netlify/functions/replan` 不调用 Gemini 或网络。请求包含完整原方案、两人的偏好、设定、`rejectedStopId`、`lockedStopIds`、原因和 `replanCount`。请求 Schema 只接受 `replanCount` 为 0 或 1，供可信客户端按会话约定执行最多两轮。Function 本身无状态，无法识别重复提交的 0 或 1；若要在服务端持久执行轮次限制，需要会话状态或速率存储，这超出当前无数据库 MVP 的范围。服务端从静态目录选择未出现在原方案中的替代地点，只调整被否决站点及必要时相邻、未锁定站点的时间；其余站点保持原样。锁定站点不能被否决，否则返回 `409 LOCKED_STOP_CONFLICT`。找不到满足时间、路线、预算和其他硬约束的替代方案时返回 `422 NO_VALID_REPLAN`。

成功重排依次发出 `REPLAN`、本地路线/预算/验证工具摘要、`VERIFY`、一个 `plan.proposed`，然后以只含一个元素的 `candidateIds` 和必需的 `diff` 结束。`diff` 列出替换站点 ID 与保留站点 ID。

## 数据可信度

`data/places.shanghai.json` 是静态地点目录，包含来源网址、营业时间、价格区间和 `lastVerifiedAt`。验证器对距计划日期超过 90 天的来源数据生成 `STALE_PLACE_DATA` 警告，但这些字段并非实时核实。路线使用坐标直线距离及固定步行/交通速度估算，预算使用目录价格上限、每段交通补贴和缓冲率计算；都不代表实时路况、班次、票价或营业状态。展示 fixture 中的天气与数值也仅用于演示。
