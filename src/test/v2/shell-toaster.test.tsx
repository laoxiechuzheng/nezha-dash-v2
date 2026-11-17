import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResponsiveToaster } from "@/components/ResponsiveToaster";

vi.mock("sonner", () => ({
	Toaster: ({ position, duration }: { position: string; duration: number }) => (
		<div
			data-testid="toaster"
			data-position={position}
			data-duration={duration}
		/>
	),
}));

function mockViewport(width: number) {
	let currentWidth = width;
	let change: (() => void) | undefined;
	const addEventListener = vi.fn((_event: string, listener: () => void) => {
		change = listener;
	});
	const removeEventListener = vi.fn();
	vi.mocked(window.matchMedia).mockImplementation(
		(query) =>
			({
				get matches() {
					return query === "(max-width: 767px)" && currentWidth <= 767;
				},
				addEventListener,
				removeEventListener,
			}) as unknown as MediaQueryList,
	);
	return {
		addEventListener,
		removeEventListener,
		resize(next: number) {
			currentWidth = next;
			act(() => change?.());
		},
		listener: () => change,
	};
}

describe("Lumen responsive toaster", () => {
	it.each([
		[767, "top-center"],
		[768, "bottom-right"],
	])("uses the exact viewport boundary at %s px", (width, expected) => {
		mockViewport(Number(width));
		render(<ResponsiveToaster />);
		expect(screen.getAllByTestId("toaster")).toHaveLength(1);
		expect(screen.getByTestId("toaster")).toHaveAttribute(
			"data-position",
			expected as string,
		);
		expect(screen.getByTestId("toaster")).toHaveAttribute(
			"data-duration",
			"1000",
		);
	});

	it("changes position without replacing the instance and removes its listener", () => {
		const viewport = mockViewport(1440);
		const { unmount } = render(<ResponsiveToaster />);
		const initial = screen.getByTestId("toaster");
		viewport.resize(390);
		expect(screen.getByTestId("toaster")).toBe(initial);
		expect(initial).toHaveAttribute("data-position", "top-center");
		viewport.resize(1024);
		expect(initial).toHaveAttribute("data-position", "bottom-right");
		unmount();
		expect(viewport.removeEventListener).toHaveBeenCalledWith(
			"change",
			viewport.listener(),
		);
	});
});
