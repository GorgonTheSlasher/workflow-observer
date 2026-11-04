import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";

describe("Sidebar", () => {
  it("marks the active view", () => {
    render(<Sidebar activeView="dora" isOpen onToggle={() => {}} onViewChange={() => {}} />);

    expect(screen.getByRole("button", { name: "DORA Metrics" })).toHaveClass("sidebar__nav-item--active");
    expect(screen.getByRole("button", { name: "Summary" })).not.toHaveClass("sidebar__nav-item--active");
  });

  it("reports which view was picked", async () => {
    const onViewChange = vi.fn();
    render(<Sidebar activeView="summary" isOpen onToggle={() => {}} onViewChange={onViewChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Issues" }));

    expect(onViewChange).toHaveBeenCalledWith("issues");
  });

  it("hides labels when collapsed but keeps buttons accessible", () => {
    render(<Sidebar activeView="summary" isOpen={false} onToggle={() => {}} onViewChange={() => {}} />);

    expect(screen.queryByText("Workflow Runs")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Workflow Runs" })).toBeInTheDocument();
  });
});
