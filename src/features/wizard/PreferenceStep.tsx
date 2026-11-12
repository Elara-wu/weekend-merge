import { useState, type FormEvent } from "react";

import { InterestSchema, type PersonPreferences } from "@/contracts/agent";

const interests = InterestSchema.options;
const avoidOptions = ["排队", "拥挤", "长距离步行", "早起", "辛辣", "酒吧", "户外日晒"];

type PreferenceStepProps = {
  person: "A" | "B";
  onSubmit: (preferences: PersonPreferences) => void;
};

function toggleValue<T extends string>(current: T[], value: T, limit?: number) {
  if (current.includes(value)) {
    return current.filter((item) => item !== value);
  }
  if (limit && current.length >= limit) {
    return current;
  }
  return [...current, value];
}

export function PreferenceStep({ person, onSubmit }: PreferenceStepProps) {
  const [selectedInterests, setSelectedInterests] = useState<PersonPreferences["interests"]>([]);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [pace, setPace] = useState<PersonPreferences["pace"]>("轻松");
  const [walkingLimitKm, setWalkingLimitKm] = useState<PersonPreferences["walkingLimitKm"]>(3);
  const [indoorPreference, setIndoorPreference] =
    useState<PersonPreferences["indoorPreference"]>("室内优先");
  const [budgetStyle, setBudgetStyle] = useState<PersonPreferences["budgetStyle"]>("平衡");
  const [wish, setWish] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedInterests.length === 0) return;
    onSubmit({
      interests: selectedInterests,
      pace,
      walkingLimitKm,
      indoorPreference,
      foodTags: ["不限"],
      budgetStyle,
      avoid,
      wish,
    });
  }

  return (
    <section className="wizard-panel" aria-labelledby="preference-title">
      <div className="step-kicker">偏好 02 / 03 · {person}</div>
      <h1 id="preference-title">{person} 的周末偏好</h1>
      <p className="step-intro">选择会先保密。最多挑五项真正想做的事。</p>

      <form className="preference-form" onSubmit={handleSubmit}>
        <fieldset className="choice-group">
          <legend>最想做什么</legend>
          <div className="choice-grid">
            {interests.map((interest) => (
              <label className="choice-chip" key={interest}>
                <input
                  type="checkbox"
                  checked={selectedInterests.includes(interest)}
                  onChange={() => setSelectedInterests(toggleValue(selectedInterests, interest, 5))}
                />
                <span>{interest}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="compact-fields">
          <label className="field">
            <span>活动节奏</span>
            <select value={pace} onChange={(event) => setPace(event.target.value as PersonPreferences["pace"])}>
              <option>轻松</option>
              <option>平衡</option>
              <option>充实</option>
            </select>
          </label>
          <label className="field">
            <span>步行上限</span>
            <select
              value={walkingLimitKm}
              onChange={(event) =>
                setWalkingLimitKm(Number(event.target.value) as PersonPreferences["walkingLimitKm"])
              }
            >
              <option value="1">1 公里</option>
              <option value="3">3 公里</option>
              <option value="5">5 公里</option>
              <option value="8">8 公里</option>
            </select>
          </label>
          <label className="field">
            <span>室内外</span>
            <select
              value={indoorPreference}
              onChange={(event) =>
                setIndoorPreference(event.target.value as PersonPreferences["indoorPreference"])
              }
            >
              <option>室内优先</option>
              <option>均可</option>
              <option>户外优先</option>
            </select>
          </label>
          <label className="field">
            <span>预算倾向</span>
            <select
              value={budgetStyle}
              onChange={(event) => setBudgetStyle(event.target.value as PersonPreferences["budgetStyle"])}
            >
              <option>省钱</option>
              <option>平衡</option>
              <option>体验优先</option>
            </select>
          </label>
        </div>

        <fieldset className="choice-group">
          <legend>绝对不要</legend>
          <div className="choice-grid">
            {avoidOptions.map((item) => (
              <label className="choice-chip conflict" key={item}>
                <input
                  type="checkbox"
                  checked={avoid.includes(item)}
                  onChange={() => setAvoid(toggleValue(avoid, item))}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>一句话愿望（可选）</span>
          <textarea
            maxLength={80}
            rows={3}
            value={wish}
            onChange={(event) => setWish(event.target.value)}
            placeholder="例如：想找一个可以慢慢聊天的地方"
          />
        </label>

        <button className="primary-action" type="submit" disabled={selectedInterests.length === 0}>
          {person === "A" ? "隐藏答案" : "保存并揭晓共识"}
        </button>
      </form>
    </section>
  );
}
