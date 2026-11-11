import { EyeOff, RotateCcw, Users } from "lucide-react";

import { createDemoRun } from "@/demo/demoRun";
import { PreferenceStep } from "@/features/wizard/PreferenceStep";
import { SetupStep } from "@/features/wizard/SetupStep";
import { PlanningWorkbench } from "@/features/workbench/PlanningWorkbench";
import { usePlanningStore } from "@/state/usePlanningStore";

function AppHeader() {
  const reset = usePlanningStore((state) => state.reset);
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true"><span>A</span><span>B</span></div>
        <div><strong>Weekend Merge</strong><span>周末共识局</span></div>
      </div>
      <div className="header-actions">
        <span className="demo-badge">Demo data</span>
        <button className="icon-button" onClick={reset} title="重新开始" type="button">
          <RotateCcw size={17} />
        </button>
      </div>
    </header>
  );
}

function HandoffScreen() {
  const handoffToB = usePlanningStore((state) => state.handoffToB);
  return (
    <section className="handoff-screen">
      <div className="privacy-seal"><EyeOff size={28} /></div>
      <div className="step-kicker">隐私交接</div>
      <h1>A 的答案已经收好</h1>
      <p>屏幕不会显示任何偏好摘要。把设备交给 B，再继续填写。</p>
      <button className="primary-action" onClick={handoffToB} type="button">我是 B，开始填写</button>
    </section>
  );
}

function ConsensusScreen() {
  const openWorkbench = usePlanningStore((state) => state.openWorkbench);
  return (
    <section className="consensus-screen">
      <div className="step-kicker">共识 03 / 03</div>
      <h1>你们没有完全相同，但有足够多的交集</h1>
      <div className="consensus-bands">
        <section className="consensus-band shared">
          <span>共同想要</span><strong>展览 · 咖啡 · 慢节奏</strong>
        </section>
        <section className="consensus-band conflict">
          <span>需要折中</span><strong>城市散步 vs 少走路 · 夜景 vs 不想晚归</strong>
        </section>
        <section className="consensus-band fixed">
          <span>不能违反</span><strong>¥300 · 步行 ≤ 3km · 避开长时间排队</strong>
        </section>
      </div>
      <div className="consensus-action">
        <Users size={19} />
        <p>Agent 会调用天气、地点、路线和预算工具，生成三个可以比较的方向。</p>
        <button className="primary-action" onClick={openWorkbench} type="button">开始规划</button>
      </div>
    </section>
  );
}

export function App() {
  const stage = usePlanningStore((state) => state.stage);
  const saveSetup = usePlanningStore((state) => state.saveSetup);
  const savePreferences = usePlanningStore((state) => state.savePreferences);

  return (
    <div className="app-shell">
      <AppHeader />
      {stage === "setup" && <SetupStep onSubmit={saveSetup} />}
      {stage === "person-a" && (
        <PreferenceStep person="A" onSubmit={(preferences) => savePreferences("a", preferences)} />
      )}
      {stage === "handoff" && <HandoffScreen />}
      {stage === "person-b" && (
        <PreferenceStep person="B" onSubmit={(preferences) => savePreferences("b", preferences)} />
      )}
      {stage === "consensus" && <ConsensusScreen />}
      {stage === "workbench" && (
        <PlanningWorkbench events={createDemoRun({ runId: "portfolio-demo" })} />
      )}
    </div>
  );
}
