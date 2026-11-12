import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RemainPercentBar from "@/components/RemainPercentBar";

describe("RemainPercentBar", () => {
	it("uses status colors for low, medium, and healthy remaining percentages", () => {
		const { rerender } = render(<RemainPercentBar value={29} />);
		const progress = screen.getByRole("progressbar");
		const indicator = progress.firstElementChild;

		expect(progress).toHaveClass("w-[70px]");
		expect(progress).toHaveAttribute("data-level", "bad");
		expect(indicator).toHaveClass("bg-danger");
		expect(indicator).toHaveStyle({ transform: "translateX(-71%)" });

		rerender(<RemainPercentBar value={30} />);
		expect(progress).toHaveAttribute("data-level", "warn");
		expect(progress.firstElementChild).toHaveClass("bg-warning");

		rerender(<RemainPercentBar value={70} />);
		expect(progress).toHaveAttribute("data-level", "good");
		expect(progress.firstElementChild).toHaveClass("bg-success");
	});
});
