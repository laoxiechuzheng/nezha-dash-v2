import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { BrandMark } from "@/components/BrandMark";
import NumericText from "@/components/NumericText";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

describe("Lumen shell primitives", () => {
	it("keeps custom logos and uses a local gradient mark otherwise", () => {
		const { container, rerender } = render(<BrandMark />);
		expect(container.querySelector("path")).toHaveAttribute(
			"d",
			"M10 22V10l12 12V10",
		);
		expect(container.querySelector("span")).toHaveStyle({
			width: "32px",
			height: "32px",
		});
		rerender(<BrandMark customLogo="/custom-logo.png" />);
		expect(screen.getByRole("img")).toHaveAttribute("src", "/custom-logo.png");
		expect(container.querySelector("svg")).not.toBeInTheDocument();
	});

	it("keeps Radix progress roles, semantic levels, refs, and indicator classes", () => {
		const ref = createRef<HTMLDivElement>();
		const { rerender } = render(
			<Progress
				ref={ref}
				value={42}
				data-level="good"
				indicatorClassName="bg-primary"
				aria-label="CPU"
			/>,
		);
		const bar = screen.getByRole("progressbar", { name: "CPU" });
		expect(ref.current).toBe(bar);
		expect(bar).toHaveAttribute("data-level", "good");
		expect(bar.firstElementChild).toHaveClass(
			"sh-progress-indicator",
			"bg-primary",
		);
		expect(bar.firstElementChild).toHaveStyle({
			transform: "translateX(-58%)",
		});
		rerender(
			<Progress
				value={92}
				data-level="bad"
				indicatorClassName="bg-danger"
				aria-label="CPU"
			/>,
		);
		expect(screen.getAllByRole("progressbar")).toHaveLength(1);
		expect(screen.getByRole("progressbar")).toHaveAttribute(
			"data-level",
			"bad",
		);
		expect(screen.getByRole("progressbar").firstElementChild).toHaveClass(
			"bg-danger",
		);
	});

	it("preserves Button asChild and disabled behavior", async () => {
		const onClick = vi.fn();
		const user = userEvent.setup();
		render(
			<>
				<Button asChild>
					<a href="/server/7">Node</a>
				</Button>
				<Button disabled onClick={onClick}>
					Save
				</Button>
			</>,
		);
		expect(screen.getByRole("link", { name: "Node" })).toHaveAttribute(
			"href",
			"/server/7",
		);
		await user.click(screen.getByRole("button", { name: "Save" }));
		expect(onClick).not.toHaveBeenCalled();
	});

	it("uses tabular numeric text and transform-only skeleton shimmer", () => {
		render(
			<>
				<NumericText value="1024" className="existing" />
				<Skeleton data-testid="loading" className="h-4 w-32" />
			</>,
		);
		expect(screen.getByText("1024")).toHaveClass("num", "existing");
		expect(screen.getByTestId("loading")).toHaveClass("shimmer", "h-4", "w-32");
		expect(screen.getByTestId("loading")).not.toHaveClass("animate-pulse");
	});
});
