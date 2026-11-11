import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { usePlanningStore } from "@/state/usePlanningStore";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    usePlanningStore.getState().reset();
  });

  it("moves from plan setup to A's private preference step", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("日期"), "2026-11-14");
    await user.selectOptions(screen.getByLabelText("出发区域"), "静安寺");
    await user.click(screen.getByRole("button", { name: "填写 A 的偏好" }));

    expect(screen.getByRole("heading", { name: "A 的周末偏好" })).toBeInTheDocument();
  });
});
