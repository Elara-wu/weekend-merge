import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createDemoRun } from "@/demo/demoRun";
import { PlanningWorkbench } from "./PlanningWorkbench";

describe("PlanningWorkbench", () => {
  it("renders candidates and observable tool evidence", async () => {
    const user = userEvent.setup();
    render(<PlanningWorkbench events={createDemoRun({ runId: "ui-demo" })} />);

    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getAllByTestId("tool-event")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "雨天艺术散步" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /咖啡与城市灯光/ }));
    expect(screen.getByRole("heading", { name: "咖啡与城市灯光" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "锁定 上海当代艺术博物馆" })).toBeInTheDocument();
  });
});
