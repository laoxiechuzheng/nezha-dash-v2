import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TraceTooltip from "@/components/home/TraceTooltip";
import PlanInfo from "@/components/PlanInfo";
import UsageCell from "@/components/UsageCell";
import en from "@/locales/en/translation.json";
import zhTW from "@/locales/zh-TW/translation.json";

const plan = {
	planDataMod: {
		bandwidth: "1000Mbps dedicated",
		trafficVol: "30TB monthly limit",
		trafficType: "",
		IPv4: "1",
		IPv6: "1",
		networkRoute: "CN2 GIA,International",
		extra:
			"Dedicated Premium,Backup Network,VeryLongExtraWithoutSpacesForWrapping",
	},
};

describe("F2 review correctness fixes", () => {
	it("renders every supported plan tag directly, without count folding or nested controls", () => {
		const { container } = render(
			<a href="/server/1">
				<PlanInfo parsedData={plan} />
			</a>,
		);
		for (const tag of [
			"1000Mbps dedicated",
			"30TB monthly limit",
			"IPv4",
			"IPv6",
			"CN2 GIA｜International",
			"Dedicated Premium",
			"Backup Network",
			"VeryLongExtraWithoutSpacesForWrapping",
		])
			expect(screen.getByText(tag)).toBeInTheDocument();
		expect(container.querySelectorAll(".hm-plan-tag")).toHaveLength(8);
		expect(container.querySelector("button")).not.toBeInTheDocument();
		expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
	});
	it.each([
		["zh-TW", zhTW.serverCard.mem],
		["en", en.serverCard.mem],
	])("uses the memory glyph in %s independent of its translated label", (_language, label) => {
		const { container, rerender } = render(
			<UsageCell label={label} metric="memory" value={25} variant="ring" />,
		);
		expect(screen.getByText(label)).toBeInTheDocument();
		expect(container.querySelector(".lucide-memory-stick")).toBeInTheDocument();
		expect(
			container.querySelector(".lucide-hard-drive"),
		).not.toBeInTheDocument();
		rerender(
			<UsageCell label={label} metric="disk" value={25} variant="ring" />,
		);
		expect(container.querySelector(".lucide-hard-drive")).toBeInTheDocument();
	});
	it("positions a measured tooltip at both edges and disconnects its observer", () => {
		const drawing = document.createElement("div");
		drawing.getBoundingClientRect = () => ({
			width: 200,
			left: 80,
			top: 0,
			right: 280,
			bottom: 100,
			height: 100,
			x: 80,
			y: 0,
			toJSON: () => ({}),
		});
		const measure = vi
			.spyOn(HTMLElement.prototype, "getBoundingClientRect")
			.mockImplementation(function (this: HTMLElement) {
				return {
					width: this.classList.contains("hm-trace-tooltip") ? 140 : 200,
					height: 80,
					x: 0,
					y: 0,
					left: 0,
					top: 0,
					right: 140,
					bottom: 80,
					toJSON: () => ({}),
				};
			});
		const disconnect = vi.fn();
		const OriginalObserver = globalThis.ResizeObserver;
		globalThis.ResizeObserver = class {
			observe = vi.fn();
			unobserve = vi.fn();
			disconnect = disconnect;
		};
		try {
			const sample = { t: 1, down: 1e15, up: 2e15, count: 2 };
			const ref = { current: drawing };
			const { rerender, unmount } = render(
				<TraceTooltip drawingRef={ref} sample={sample} fraction={-2} />,
			);
			expect(screen.getByRole("tooltip")).toHaveStyle({
				left: "0px",
				maxWidth: "200px",
			});
			rerender(<TraceTooltip drawingRef={ref} sample={sample} fraction={2} />);
			expect(screen.getByRole("tooltip")).toHaveStyle({ left: "60px" });
			unmount();
			expect(disconnect).toHaveBeenCalledTimes(2);
		} finally {
			measure.mockRestore();
			globalThis.ResizeObserver = OriginalObserver;
		}
	});
});
