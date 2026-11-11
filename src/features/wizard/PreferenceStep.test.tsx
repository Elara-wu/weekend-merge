import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { PreferenceStep } from "./PreferenceStep";

describe("PreferenceStep", () => {
  it("collects A preferences without rendering another person's answers", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PreferenceStep person="A" onSubmit={onSubmit} />);

    expect(screen.getByRole("heading", { name: "A 的周末偏好" })).toBeInTheDocument();
    expect(screen.queryByText("B 的周末偏好")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "展览" }));
    await user.click(screen.getByRole("checkbox", { name: "咖啡" }));
    await user.click(screen.getByRole("checkbox", { name: "长距离步行" }));
    await user.type(screen.getByLabelText("一句话愿望（可选）"), "想看一个安静的展览");
    await user.click(screen.getByRole("button", { name: "隐藏答案" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        interests: ["展览", "咖啡"],
        avoid: ["长距离步行"],
        wish: "想看一个安静的展览",
      }),
    );
  });
});
