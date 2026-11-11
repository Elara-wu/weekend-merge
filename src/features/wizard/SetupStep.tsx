import { useMemo, useState, type FormEvent } from "react";

import { PlanSetupSchema, type PlanSetup } from "@/contracts/agent";

type SetupStepProps = {
  onSubmit: (setup: PlanSetup) => void;
};

export function SetupStep({ onSubmit }: SetupStepProps) {
  const [date, setDate] = useState("");
  const [budget, setBudget] = useState("300");
  const [startingArea, setStartingArea] = useState("");
  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("21:00");

  const setup = useMemo(
    () =>
      PlanSetupSchema.safeParse({
        city: "上海",
        date,
        startTime,
        endTime,
        budget: Number(budget),
        startingArea,
      }),
    [budget, date, endTime, startTime, startingArea],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (setup.success) {
      onSubmit(setup.data);
    }
  }

  return (
    <section className="wizard-panel" aria-labelledby="setup-title">
      <div className="step-kicker">计划 01 / 03</div>
      <h1 id="setup-title">先确定这个周末的边界</h1>
      <p className="step-intro">只设置双方都必须遵守的条件，偏好会分别填写。</p>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field field-wide">
          <span>城市</span>
          <input value="上海" disabled />
          <small>首版地点库仅覆盖上海。</small>
        </label>

        <label className="field">
          <span>日期</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>

        <div className="field">
          <label htmlFor="budget">总预算</label>
          <span className="input-affix">
            <span aria-hidden="true">¥</span>
            <input
              id="budget"
              type="number"
              min="100"
              max="2000"
              step="50"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
          </span>
        </div>

        <label className="field">
          <span>开始时间</span>
          <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
        </label>

        <label className="field">
          <span>结束时间</span>
          <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </label>

        <label className="field field-wide">
          <span>出发区域</span>
          <select value={startingArea} onChange={(event) => setStartingArea(event.target.value)}>
            <option value="">选择商圈或地铁站</option>
            <option value="静安寺">静安寺</option>
            <option value="人民广场">人民广场</option>
            <option value="徐家汇">徐家汇</option>
            <option value="陆家嘴">陆家嘴</option>
            <option value="中山公园">中山公园</option>
          </select>
        </label>

        <button className="primary-action field-wide" type="submit" disabled={!setup.success}>
          填写 A 的偏好
        </button>
      </form>
    </section>
  );
}
