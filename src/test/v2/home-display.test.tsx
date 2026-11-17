import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttentionStrip from "@/components/home/AttentionStrip";
import FleetStage from "@/components/home/FleetStage";
import { HomeDisplayContext } from "@/components/home/HomeDisplay";
import Sparkline from "@/components/home/Sparkline";
import TopTalkers from "@/components/home/TopTalkers";
import ServerCard from "@/components/ServerCard";
import UsageCell from "@/components/UsageCell";
import { useFleetTrace } from "@/hooks/use-fleet-trace";
import { createServer } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";

const now = Date.parse("2025-01-01T00:00:20Z");
describe("Lumen honest home visuals", () => {
	beforeEach(() => {
		Object.assign(window, { ForceUseSvgFlag: true });
	});
	it("keeps exactly one progressbar and one full percentage in ring mode, with strict thresholds", () => {
		const { container, rerender } = render(
			<UsageCell label="CPU" value={90} variant="ring" metric="cpu" />,
		);
		expect(screen.getAllByRole("progressbar")).toHaveLength(1);
		expect(screen.getAllByText(/%$/)).toHaveLength(1);
		expect(screen.getByText("90.00%")).toHaveClass("text-warning");
		expect(container.querySelector(".hm-ring-value")).toHaveAttribute(
			"stroke-dashoffset",
			"10",
		);
		rerender(
			<UsageCell label="CPU" value={90.01} variant="ring" metric="cpu" />,
		);
		expect(screen.getByText("90.01%")).toHaveClass("text-danger");
		rerender(
			<UsageCell label="CPU" value={Number.NaN} variant="ring" metric="cpu" />,
		);
		expect(screen.getByText("—")).toBeInTheDocument();
		expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
		expect(screen.getByRole("progressbar")).not.toHaveAttribute(
			"aria-valuenow",
		);
		expect(container.querySelector(".hm-ring-value")).not.toBeInTheDocument();
	});
	it("does not turn missing CPU or memory capacities into zero percentages", () => {
		renderWithProviders(
			<ServerCard
				now={now}
				serverInfo={createServer({
					state: { cpu: Number.NaN },
					host: { mem_total: 0 },
				})}
			/>,
		);
		expect(screen.getAllByText("—")).toHaveLength(2);
		expect(screen.queryByText("0.00%")).not.toBeInTheDocument();
	});
	it("uses meters without sparklines for explicit high-density tiles", () => {
		const { container } = renderWithProviders(
			<HomeDisplayContext.Provider
				value={{ highDensity: true, traces: new Map() }}
			>
				<ServerCard now={now} serverInfo={createServer()} />
			</HomeDisplayContext.Provider>,
		);
		expect(
			container.querySelectorAll(".hm-usage-ring,.hm-sparkline"),
		).toHaveLength(0);
		expect(screen.getAllByRole("progressbar")).toHaveLength(3);
	});
	it("renders offline billing and tags without live metrics", () => {
		renderWithProviders(
			<ServerCard
				now={now}
				serverInfo={createServer({
					name: "offline-test",
					last_active: "2024-01-01T00:00:00Z",
					public_note: JSON.stringify({
						billingDataMod: { amount: "0", endDate: "0000-00-00" },
						planDataMod: { extra: "retained" },
					}),
				})}
			/>,
		);
		expect(screen.getByText("billingInfo.free")).toBeInTheDocument();
		expect(screen.getByText(/billingInfo.indefinite/)).toBeInTheDocument();
		expect(screen.getByText("retained")).toBeInTheDocument();
		expect(
			screen.queryByTestId("server-card-resource-metrics"),
		).not.toBeInTheDocument();
	});
	it("keeps one real point and no interpolated area, and holds real data while disconnected", () => {
		const props = {
			samples: [{ t: now, down: 125000, up: 250000, count: 1 }],
			connected: false,
			up: 1024,
			down: 2048,
			upSpeed: 250000,
			downSpeed: 125000,
		};
		const { container, rerender } = render(<FleetStage {...props} />);
		expect(screen.getByText("v2Home.trace.sampling")).toBeInTheDocument();
		expect(screen.getByText("v2Home.trace.stale")).toBeInTheDocument();
		expect(container.querySelector(".hm-trace-line")).toHaveAttribute("d", "");
		expect(container.querySelectorAll(".hm-end-halo")).toHaveLength(2);
		expect(container.querySelector(".hm-trace-end")).not.toBeInTheDocument();
		rerender(<FleetStage {...props} connected samples={[]} />);
		expect(container.querySelector(".hm-end-halo")).not.toBeInTheDocument();
	});
	it("hides a mini trace until five valid samples and exposes its true time window", () => {
		const samples = [0, 1000, 2000, 10000, 12000].map((offset) => ({
			t: now + offset,
			value: offset + 1,
		}));
		const { container, rerender } = render(
			<Sparkline samples={samples.slice(0, 4)} />,
		);
		expect(container).toBeEmptyDOMElement();
		rerender(<Sparkline samples={samples} />);
		expect(screen.getByRole("img")).toHaveAccessibleName(
			"v2Home.trace.tileTitle",
		);
		expect(container.querySelectorAll("svg > *")).toHaveLength(3);
	});
	it("shows only real non-renewing explicit expiry hints including free and usage plans", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(now));
		const note = (amount: string, endDate: string, autoRenewal = "0") =>
			JSON.stringify({
				billingDataMod: {
					amount,
					endDate,
					autoRenewal,
					startDate: "2024-12-01",
					cycle: "monthly",
				},
			});
		const servers = [
			createServer({
				id: 1,
				name: "free",
				public_note: note("0", "2025-01-05"),
			}),
			createServer({
				id: 2,
				name: "usage",
				public_note: note("-1", "2024-12-30"),
			}),
			createServer({
				id: 3,
				name: "renew",
				public_note: note("10", "2025-01-05", "1"),
			}),
			createServer({
				id: 4,
				name: "forever",
				public_note: note("0", "0000-00-00"),
			}),
			createServer({ id: 5, name: "nodate", public_note: note("0", "") }),
		];
		renderWithProviders(<AttentionStrip now={now} servers={servers} />);
		const links = screen.getAllByRole("link");
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"/server/1",
			"/server/2",
		]);
		expect(links[0]).toHaveTextContent("v2Home.attention.expiring");
		expect(links[1]).toHaveTextContent("v2Home.attention.expired");
		vi.useRealTimers();
	});
	it("hides healthy attention and top talkers with fewer than two online nodes or zero traffic", () => {
		const { container } = renderWithProviders(
			<>
				<AttentionStrip now={now} servers={[createServer()]} />
				<TopTalkers now={now} servers={[createServer()]} />
			</>,
		);
		expect(container).toBeEmptyDOMElement();
	});
	it("hides top talkers when only one online node has positive throughput", () => {
		const { container } = renderWithProviders(
			<TopTalkers
				now={now}
				servers={[
					createServer(),
					createServer({ id: 2, state: { net_in_speed: 0, net_out_speed: 0 } }),
				]}
			/>,
		);
		expect(container).toBeEmptyDOMElement();
	});
	it("selects top three by real combined throughput, retaining real anchors", () => {
		renderWithProviders(
			<TopTalkers
				now={now}
				servers={[1, 2, 3, 4].map((id) =>
					createServer({
						id,
						name: `talker-${id}`,
						state: { net_in_speed: id * 100, net_out_speed: id },
					}),
				)}
			/>,
		);
		expect(
			screen.getAllByRole("link").map((link) => link.getAttribute("href")),
		).toEqual(["/server/4", "/server/3", "/server/2"]);
	});
	it("changes members without leaking a previous group's samples and replays provider resets", () => {
		function Trace({
			ids,
			messages,
		}: {
			ids: number[];
			messages: NezhaWebsocketResponse[];
		}) {
			const samples = useFleetTrace(messages, "group", ids);
			return <output>{JSON.stringify(samples)}</output>;
		}
		const messages = [
			{
				now,
				servers: [
					createServer({ id: 1 }),
					createServer({ id: 2, state: { net_in_speed: 9 } }),
				],
			},
		];
		const { rerender } = render(<Trace ids={[1]} messages={messages} />);
		expect(screen.getByRole("status")).toHaveTextContent('"down":1048576');
		rerender(<Trace ids={[2]} messages={messages} />);
		expect(screen.getByRole("status")).toHaveTextContent('"down":9');
		rerender(<Trace ids={[2]} messages={[]} />);
		expect(screen.getByRole("status")).toHaveTextContent("[]");
	});
});
