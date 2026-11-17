import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SortProvider } from "@/context/sort-provider";
import { StatusProvider } from "@/context/status-provider";
import {
	WebSocketContext,
	type WebSocketContextType,
} from "@/context/websocket-context";
import type { FleetSample } from "@/lib/fleet-trace";
import Servers from "@/pages/Server";
import { createServer } from "@/test/fixtures";
import { createTestQueryClient, renderWithProviders } from "@/test/utils";

vi.mock("@/lib/nezha-api", () => ({
	fetchServerGroup: vi.fn(),
	fetchService: vi.fn(),
}));
// 保持真实Server→ServerOverview→useFleetTrace，仅替换SVG呈现层读取精确样本。
vi.mock("@/components/home/FleetStage", () => ({
	default: ({ samples }: { samples: FleetSample[] }) => (
		<output data-testid="trace-samples">{JSON.stringify(samples)}</output>
	),
}));
const now = Date.parse("2025-01-01T00:00:20Z");
const a = createServer({
	id: 1,
	name: "member-a",
	last_active: new Date(now).toISOString(),
	state: { net_in_speed: 100, net_out_speed: 10 },
});
const b = createServer({
	id: 2,
	name: "member-b",
	last_active: new Date(now).toISOString(),
	state: { net_in_speed: 200, net_out_speed: 20 },
});
const old = { now, servers: [a, b] };
const current = { now: now + 1000, servers: [a] };
const group = (ids: number[]) => ({
	success: true,
	data: [
		{
			group: { id: 1, name: "Configured", created_at: "", updated_at: "" },
			servers: ids,
		},
	],
});
function tree(value: WebSocketContextType) {
	return (
		<SortProvider>
			<StatusProvider>
				<WebSocketContext.Provider value={value}>
					<Servers />
				</WebSocketContext.Provider>
			</StatusProvider>
		</SortProvider>
	);
}
const context = (
	latest: typeof old,
	history: (typeof old)[],
): WebSocketContextType => ({
	lastData: latest,
	messageHistory: history,
	connected: true,
	reconnect: vi.fn(),
	needReconnect: false,
	setNeedReconnect: vi.fn(),
});
const samples = () =>
	JSON.parse(
		screen.getByTestId("trace-samples").textContent || "[]",
	) as FleetSample[];

describe("configured group membership reaches the real sampling hook", () => {
	it("keeps old 300/new 100 when configured B is absent only from the latest message", async () => {
		const client = createTestQueryClient();
		client.setQueryData(["server-group"], group([1, 2]));
		client.setQueryData(["service"], {
			success: true,
			data: { services: {}, cycle_transfer_stats: {} },
		});
		sessionStorage.setItem("selectedGroup", "Configured");
		const { rerender } = renderWithProviders(tree(context(old, [old])), {
			queryClient: client,
		});
		await waitFor(() =>
			expect(samples()).toEqual([{ t: now, down: 300, up: 30, count: 2 }]),
		);
		rerender(tree(context(current, [current, old])));
		await waitFor(() =>
			expect(samples()).toEqual([
				{ t: now, down: 300, up: 30, count: 2 },
				{ t: now + 1000, down: 100, up: 10, count: 1 },
			]),
		);
		// KPI/列表仍是本条消息真实出现的A，不能把B补成在线或补0节点。
		expect(
			screen.getByRole("button", { name: /serverOverview.totalServers/ }),
		).toHaveTextContent("1");
		expect(screen.queryByText("member-b")).not.toBeInTheDocument();
		client.setQueryData(["server-group"], group([1]));
		await waitFor(() =>
			expect(samples()).toEqual([
				{ t: now, down: 100, up: 10, count: 1 },
				{ t: now + 1000, down: 100, up: 10, count: 1 },
			]),
		);
	});
	it("keeps All as the full per-message server set, including a missing current node's old contribution", () => {
		const client = createTestQueryClient();
		client.setQueryData(["server-group"], group([1]));
		client.setQueryData(["service"], {
			success: true,
			data: { services: {}, cycle_transfer_stats: {} },
		});
		renderWithProviders(tree(context(current, [current, old])), {
			queryClient: client,
		});
		expect(samples()).toEqual([
			{ t: now, down: 300, up: 30, count: 2 },
			{ t: now + 1000, down: 100, up: 10, count: 1 },
		]);
	});
});
