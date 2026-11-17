import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DenseRowProvider } from "@/components/home/DenseRow";
import FleetRing from "@/components/home/FleetRing";
import ServerCardInline from "@/components/ServerCardInline";
import ServerOverview from "@/components/ServerOverview";
import { StatusProvider } from "@/context/status-provider";
import { createServer } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";

const now = Date.parse("2025-01-01T00:00:20Z");

describe("V1 FleetRing semantic sizing inputs", () => {
	it.each([
		[1, 1, "1"],
		[9, 9, "1"],
		[20, 22, "2"],
		[99, 100, "3"],
		[999, 1000, "4"],
		[1819, 2000, "4"],
		[9999, 10000, "5"],
		[99999, 100000, "6"],
		[1234567, 1234567, "7"],
		[9999999999, 9999999999, "8"],
		[0, 0, "1"],
	])("keeps %i / %i as real complete text with total digit tier %s", (online, total, digits) => {
		const { container } = render(
			<FleetRing online={online} total={total} label="在线" />,
		);
		const ring = container.firstElementChild;
		expect(ring).toHaveAttribute("aria-hidden", "true");
		expect(ring).toHaveAttribute("data-digits", digits);
		const center = container.querySelector(".hm-fleet-ring-center");
		expect(center?.children).toHaveLength(3);
		expect(center?.children[0]).toHaveTextContent(String(online));
		expect(center?.children[1]).toHaveTextContent(`/ ${total}`);
		expect(center?.children[2]).toHaveTextContent("在线");
		expect(center?.children[0]).toHaveClass("num");
		expect(center?.children[1]).toHaveClass("num");
		expect(container.querySelector("svg")).toHaveAttribute(
			"viewBox",
			"0 0 120 120",
		);
		expect(container.querySelector(".hm-ring-track")).toHaveAttribute(
			"r",
			"50",
		);
		expect(container.querySelector(".hm-ring-track")).toHaveAttribute(
			"stroke-width",
			"10",
		);
		if (total === 0) expect(container.querySelector("svg g")).toBeNull();
	});

	it("does not switch tiers as online counts cross digit boundaries within the same total", () => {
		const { container, rerender } = render(
			<FleetRing online={20} total={22} label="Online" />,
		);
		for (const online of [19, 10, 9, 0]) {
			rerender(<FleetRing online={online} total={22} label="Online" />);
			expect(container.firstElementChild).toHaveAttribute("data-digits", "2");
			expect(
				container.querySelector(".hm-fleet-ring-center")?.firstElementChild,
			).toHaveTextContent(String(online));
		}
	});

	it("preserves full filter counts and pressed semantics when the decorative total has a hidden tier", () => {
		render(
			<StatusProvider>
				<ServerOverview
					online={1234567}
					total={1234567}
					offline={0}
					up={0}
					down={0}
					upSpeed={0}
					downSpeed={0}
				/>
			</StatusProvider>,
		);
		const all = screen.getByRole("button", {
			name: /serverOverview.totalServers/,
		});
		const online = screen.getByRole("button", {
			name: /serverOverview.onlineServers/,
		});
		expect(within(all).getByText("1234567")).toBeInTheDocument();
		expect(within(online).getByText("1234567")).toBeInTheDocument();
		expect(all).toHaveAttribute("aria-pressed", "true");
		fireEvent.click(online);
		expect(online).toHaveAttribute("aria-pressed", "true");
		expect(all).toHaveAttribute("aria-pressed", "false");
	});
});

describe("V2 high-density row content remains complete", () => {
	beforeEach(() => {
		Object.assign(window, { ForceUseSvgFlag: true });
	});

	it("retains metric labels, exact percentages, all transfer values, uptime and full-name title in DOM order", () => {
		const name = "DEV 中文长节点 long-English-name NOT PRODUCTION";
		const server = createServer({
			name,
			state: {
				disk_used: 400,
				net_out_speed: 154312500,
				net_in_speed: 2362500000,
				net_out_transfer: 1023.99 * 1024 ** 3,
				net_in_transfer: 1.78 * 1024 ** 4,
				uptime: 3 * 86400,
			},
		});
		const { container, rerender } = renderWithProviders(
			<DenseRowProvider enabled>
				<ServerCardInline now={now} serverInfo={server} />
			</DenseRowProvider>,
		);
		const row = screen.getByRole("link", { name: new RegExp(name) });
		expect(row).toHaveAttribute("href", "/server/1");
		expect(screen.getByTitle(name)).toHaveTextContent(name);
		expect(
			[...container.querySelectorAll(".hm-dense-label")].map(
				(el) => el.textContent,
			),
		).toEqual(["CPU", "serverCard.mem", "serverCard.stg"]);
		expect(
			[...container.querySelectorAll(".hm-dense-reading")].map(
				(el) => el.textContent,
			),
		).toEqual(["12.00%", "25.00%", "100.00%"]);
		expect(within(row).getAllByRole("progressbar")).toHaveLength(3);
		expect(
			[...container.querySelectorAll(".hm-dense-transfer > span")].map(
				(el) => el.textContent,
			),
		).toEqual([
			"serverCard.upload1.23 Gbps",
			"serverCard.download18.9 Gbps",
			"serverCard.totalUpload1023.99 GiB",
			"serverCard.totalDownload1.78 TiB",
		]);
		expect(container.querySelector(".hm-dense-uptime")).toHaveTextContent(
			"serverCard.uptime 3 serverCard.days",
		);
		const areas = [...row.children].map(
			(el) =>
				(el as HTMLElement).style.gridArea ||
				(el.className.includes("grid-area:uptime")
					? "uptime"
					: el.className.includes("grid-area:load")
						? "load"
						: "name"),
		);
		expect(areas).toEqual([
			"name",
			"cpu",
			"mem",
			"disk",
			"speed",
			"traffic",
			"load",
			"uptime",
		]);
		rerender(
			<DenseRowProvider enabled>
				<ServerCardInline
					now={now}
					serverInfo={createServer({
						...server,
						state: {
							...server.state,
							cpu: 0,
							mem_used: Number.NaN,
							disk_used: Number.NaN,
						},
					})}
				/>
			</DenseRowProvider>,
		);
		expect(screen.getByText("0.00%")).toBeInTheDocument();
		expect(screen.getAllByText("—")).toHaveLength(2);
		expect(
			container.querySelectorAll('.hm-dense-meter[data-unknown="true"]'),
		).toHaveLength(2);
	});

	it.each([
		[70, "good"],
		[70.01, "warn"],
		[90, "warn"],
		[90.01, "bad"],
	])("keeps the strict threshold at %s as %s", (cpu, level) => {
		const { container } = renderWithProviders(
			<DenseRowProvider enabled>
				<ServerCardInline
					now={now}
					serverInfo={createServer({ state: { cpu } })}
				/>
			</DenseRowProvider>,
		);
		expect(container.querySelector(".hm-dense-reading")).toHaveAttribute(
			"data-level",
			level,
		);
		expect(container.querySelector(".hm-dense-meter")).toHaveAttribute(
			"data-level",
			level,
		);
	});

	it("keeps offline name/info without introducing live metrics or uptime", () => {
		const { container } = renderWithProviders(
			<DenseRowProvider enabled>
				<ServerCardInline
					now={now + 60000}
					serverInfo={createServer({ name: "offline-long-name" })}
				/>
			</DenseRowProvider>,
		);
		expect(screen.getByTitle("offline-long-name")).toBeInTheDocument();
		expect(screen.getByText("serverList.offline")).toBeInTheDocument();
		expect(screen.getByText(/serverDetail.lastActive/)).toBeInTheDocument();
		expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
		expect(container.querySelector(".hm-dense-uptime")).toBeNull();
	});
});
