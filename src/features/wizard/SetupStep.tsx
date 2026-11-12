import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
  Wallet,
  Minus,
  Plus,
  ChevronDown,
  TrainFront,
  ShieldCheck,
  Sparkles,
  BookOpen,
  Coffee,
  Leaf,
} from "lucide-react";
import { PlanSetupSchema, type PlanSetup } from "@/contracts/agent";
import { shanghaiToday, Tag } from "@/components/Ui";

export function SetupStep({
  onSubmit,
  onDemo,
  initial,
}: {
  onSubmit: (setup: PlanSetup) => void;
  onDemo?: () => void;
  initial?: PlanSetup;
}) {
  const [date, setDate] = useState(initial?.date ?? "");
  const [budget, setBudget] = useState(String(initial?.budget ?? 300));
  const [startingArea, setStartingArea] = useState(initial?.startingArea ?? "");
  const [startTime, setStartTime] = useState(initial?.startTime ?? "13:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "21:00");
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
    [date, startTime, endTime, budget, startingArea],
  );
  const minutes = (value: string) =>
    Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const duration = minutes(endTime) - minutes(startTime);
  const today = shanghaiToday();
  const last = new Date(`${today}T12:00:00`);
  last.setDate(last.getDate() + 13);
  const lastDate = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  const dateValid =
    !!date &&
    date >= today &&
    date <= lastDate &&
    [0, 6].includes(new Date(`${date}T12:00:00`).getDay());
  const valid =
    setup.success && dateValid && duration >= 180 && duration <= 720;
  function submit(e: FormEvent) {
    e.preventDefault();
    if (valid && setup.success) onSubmit(setup.data);
  }
  return (
    <main className="setup-page">
      <section className="setup-left">
        <div className="eyebrow">
          <span />A LITTLE PLAN, A LOVELY WEEKEND
        </div>
        <h1>
          两个人的期待，
          <br />
          一个<span className="serif-accent">刚刚好</span>的周末。
        </h1>
        <p className="intro">
          不用再问“你想去哪？”
          <br />
          把时间和预算告诉我们，一起找到都喜欢的答案。
        </p>
        <form className="setup-form" onSubmit={submit}>
          <div className="form-heading">
            <h2>先为周末画个小小的范围</h2>
            <span>
              约 30 秒 <Clock3 size={13} />
            </span>
          </div>
          <div className="field-row">
            <div className="field">
              <label>
                <MapPin size={15} />
                去哪座城市
              </label>
              <div className="fixed-input">
                <span>
                  上海 <span className="en-label">SHANGHAI</span>
                </span>
                <Tag>首版限定</Tag>
              </div>
            </div>
            <div className="field">
              <label htmlFor="plan-date">
                <CalendarDays size={15} />
                日期
              </label>
              <input
                className="date-input"
                id="plan-date"
                type="date"
                min={today}
                max={lastDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-describedby="setup-validation"
              />
            </div>
          </div>
          <div className="field">
            <label>
              <Clock3 size={15} />
              留给彼此的时间 <small>3–12 小时</small>
            </label>
            <div className="time-range">
              <input
                aria-label="开始时间"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <span className="time-divider">—</span>
              <input
                aria-label="结束时间"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
              <span className="duration">
                {Number.isFinite(duration) ? Math.round(duration / 6) / 10 : 0}{" "}
                小时的自在
              </span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="budget">
              <Wallet size={15} />
              总预算 <small>两人合计，包含餐饮与交通</small>
            </label>
            <div className="budget-row">
              <div className="budget-input">
                <span>¥</span>
                <input
                  id="budget"
                  aria-label="总预算"
                  type="number"
                  min={100}
                  max={2000}
                  step="any"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
                <div>
                  <button
                    type="button"
                    aria-label="减少预算"
                    disabled={Number(budget) <= 100}
                    onClick={() =>
                      setBudget(String(Math.max(100, Number(budget) - 50)))
                    }
                  >
                    <Minus size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="增加预算"
                    disabled={Number(budget) >= 2000}
                    onClick={() =>
                      setBudget(String(Math.min(2000, Number(budget) + 50)))
                    }
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="budget-choices">
                {[200, 300, 500].map((n) => (
                  <button
                    type="button"
                    key={n}
                    className={Number(budget) === n ? "selected" : ""}
                    onClick={() => setBudget(String(n))}
                  >
                    ¥{n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="field">
            <label htmlFor="origin">
              <TrainFront size={15} />
              出发区域
            </label>
            <div className="select-wrap">
              <select
                id="origin"
                value={startingArea}
                onChange={(e) => setStartingArea(e.target.value)}
              >
                <option value="">选择商圈或地铁站</option>
                {["静安寺", "人民广场", "徐家汇", "陆家嘴", "中山公园"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
              <ChevronDown size={15} />
            </div>
          </div>
          <p
            className={valid ? "setup-hint" : "inline-error"}
            id="setup-validation"
          >
            {!date || !startingArea
              ? "请选择周末日期与碰面商圈，再开始填写。"
              : !dateValid
                ? "请选择今天起 14 天内的周六或周日。"
                : duration < 180 || duration > 720
                  ? "请安排 3–12 小时的活动时间。"
                  : !setup.success
                    ? "两人预算需要在 ¥100–2,000 之间。"
                    : "条件准备好了，接下来分别写下期待。"}
          </p>
          <button
            className="button primary start-button"
            type="submit"
            disabled={!valid}
            aria-label="填写 A 的偏好"
          >
            开始，写下各自的期待 <ArrowRight size={18} />
          </button>
          <div className="form-footer">
            <span>
              <ShieldCheck size={14} />
              偏好只保存在当前设备
            </span>
            {onDemo && (
              <button type="button" onClick={onDemo}>
                先逛逛示例方案 <ArrowUpRight size={14} />
              </button>
            )}
          </div>
        </form>
      </section>
      <aside className="weekend-editorial">
        <div className="editorial-top">
          <span>THE WEEKEND EDIT</span>
          <span>VOL. 01 / SHANGHAI</span>
        </div>
        <div className="photo-frame">
          <img src="/images/weekend.jpg" alt="上海梧桐街区，周末散步的风景" />
          <div className="photo-overlay" />
          <div className="photo-caption">
            <span>
              LESS PLANNING.
              <br />
              MORE WANDERING.
            </span>
            <p>
              把周末还给
              <br />
              <em>一起走走的我们。</em>
            </p>
          </div>
          <div className="photo-location">
            <MapPin size={13} />
            城市转角，总有新的小事
          </div>
          <div className="round-stamp">
            GOOD
            <br />
            <span>weekend</span>
            <br />
            TOGETHER ↗
          </div>
        </div>
        <div className="note-card">
          <span className="note-spark">
            <Sparkles size={22} />
          </span>
          <div>
            <h3>你喜欢看展，TA 想要散步？</h3>
            <p>不用二选一，我们来找那个刚刚好的交集。</p>
          </div>
          <span className="note-line" />
        </div>
        <div className="mini-route">
          <span>
            <BookOpen size={16} />
            一场小展
          </span>
          <i />
          <span>
            <Coffee size={16} />
            街角咖啡
          </span>
          <i />
          <span>
            <Leaf size={16} />
            梧桐漫步
          </span>
        </div>
        <div className="editorial-bottom">
          <span>两个独立的心愿，一份共同的计划。</span>
          <span className="little-star">✳</span>
        </div>
      </aside>
    </main>
  );
}
