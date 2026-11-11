import {
  Ban,
  Check,
  CloudRain,
  Footprints,
  Lock,
  MapPin,
  Route,
  Sparkles,
  ThumbsUp,
  TrainFront,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { AgentEvent, Itinerary } from "@/contracts/agent";

type PlanningWorkbenchProps = {
  events: AgentEvent[];
};

const toolLabels: Record<string, string> = {
  get_weather: "读取活动时段天气",
  search_places: "筛选共同兴趣地点",
  estimate_route: "估算地点间移动",
  calculate_budget: "核算两人总预算",
};

function getCandidates(events: AgentEvent[]) {
  return events.flatMap((event) => (event.type === "plan.proposed" ? [event.plan] : []));
}

function RouteStage({ plan }: { plan: Itinerary }) {
  return (
    <div className="route-stage" aria-label={`${plan.title}路线预览`}>
      <div className="map-label">
        <Route size={16} aria-hidden="true" />
        共识路径 · 估算路线
      </div>
      <div className="route-line line-one" />
      <div className="route-line line-two" />
      {plan.stops.map((stop, index) => (
        <div className={`route-pin pin-${index + 1}`} key={stop.id}>
          <span>{index + 1}</span>
          <strong>{stop.name}</strong>
          <small>{stop.startTime}</small>
        </div>
      ))}
      <div className="weather-note">
        <CloudRain size={17} aria-hidden="true" />
        <span>15:00 后小雨</span>
      </div>
    </div>
  );
}

export function PlanningWorkbench({ events }: PlanningWorkbenchProps) {
  const candidates = useMemo(() => getCandidates(events), [events]);
  const toolEvents = events.filter((event) => event.type === "tool.completed");
  const [activeId, setActiveId] = useState(candidates[0]?.id);
  const [lockedStops, setLockedStops] = useState<string[]>([]);
  const activePlan = candidates.find((plan) => plan.id === activeId) ?? candidates[0];

  if (!activePlan) {
    return <div className="empty-state">Agent 正在组合候选方案...</div>;
  }

  function toggleLocked(stopId: string) {
    setLockedStops((current) =>
      current.includes(stopId) ? current.filter((id) => id !== stopId) : [...current, stopId],
    );
  }

  return (
    <main className="workbench-shell">
      <header className="workbench-heading">
        <div>
          <div className="step-kicker">协商工作台</div>
          <h1>三个折中方向，保留你们都在意的部分</h1>
        </div>
        <div className="run-status"><span />演示运行已完成</div>
      </header>

      <div className="workbench-grid">
        <aside className="candidate-rail" aria-label="候选方案">
          <div className="rail-title">候选方案</div>
          <div role="tablist" aria-label="切换候选方案">
            {candidates.map((plan, index) => (
              <button
                aria-selected={plan.id === activePlan.id}
                className="candidate-tab"
                key={plan.id}
                onClick={() => setActiveId(plan.id)}
                role="tab"
                type="button"
              >
                <span className="candidate-index">{String.fromCharCode(65 + index)}</span>
                <span>
                  <strong>{plan.title}</strong>
                  <small>{plan.matchScore}% 共同偏好</small>
                </span>
              </button>
            ))}
          </div>
          <div className="constraint-note">
            <Sparkles size={16} aria-hidden="true" />
            已守住预算、步行和排队三项硬约束
          </div>
        </aside>

        <section className="plan-stage">
          <div className="plan-summary">
            <div>
              <div className="eyebrow">方案 {candidates.indexOf(activePlan) + 1}</div>
              <h2>{activePlan.title}</h2>
              <p>{activePlan.summary}</p>
            </div>
            <div className="score-mark"><strong>{activePlan.matchScore}</strong><span>匹配</span></div>
          </div>

          <RouteStage plan={activePlan} />

          <div className="metric-row" aria-label="方案指标">
            <span><WalletCards size={16} />¥{activePlan.totalCost} / 300</span>
            <span><Footprints size={16} />{activePlan.totalDistanceKm} km</span>
            <span><CloudRain size={16} />室内 {activePlan.indoorRatio}%</span>
            <span><TrainFront size={16} />换乘 {activePlan.transfers} 次</span>
          </div>

          <div className="itinerary-list">
            {activePlan.stops.map((stop, index) => {
              const isLocked = lockedStops.includes(stop.id);
              return (
                <article className="itinerary-row" key={stop.id}>
                  <div className="stop-number">{index + 1}</div>
                  <div className="stop-time">{stop.startTime}<span>{stop.endTime}</span></div>
                  <div className="stop-copy">
                    <h3>{stop.name}</h3>
                    <p><MapPin size={13} />{stop.area} · ¥{stop.cost}</p>
                  </div>
                  <div className="stop-actions">
                    <button className="icon-button" title="喜欢" type="button"><ThumbsUp size={16} /></button>
                    <button className="icon-button danger" title="否决" type="button"><Ban size={16} /></button>
                    <button
                      aria-pressed={isLocked}
                      className={`icon-button ${isLocked ? "locked" : ""}`}
                      onClick={() => toggleLocked(stop.id)}
                      title={`锁定 ${stop.name}`}
                      type="button"
                    >
                      {isLocked ? <Check size={16} /> : <Lock size={16} />}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="agent-trace" aria-label="Agent 执行轨迹">
          <div className="rail-title">Agent 轨迹</div>
          <p className="trace-intro">只显示工具、证据和约束，不展示隐藏思维链。</p>
          <ol>
            {toolEvents.map((event) => {
              if (event.type !== "tool.completed") return null;
              return (
                <li data-testid="tool-event" key={event.tool}>
                  <span className="trace-check"><Check size={12} /></span>
                  <div>
                    <strong>{toolLabels[event.tool] ?? event.tool}</strong>
                    <p>{event.source}</p>
                    <small>{event.durationMs} ms</small>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="evidence-box">
            <strong>为何推荐当前方案</strong>
            {activePlan.reasons.map((reason) => <span key={reason}>· {reason}</span>)}
          </div>
        </aside>
      </div>
    </main>
  );
}
