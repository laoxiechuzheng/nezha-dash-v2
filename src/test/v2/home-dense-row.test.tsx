import { fireEvent, screen, within } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DenseRowProvider } from "@/components/home/DenseRow";
import ServerCardInline from "@/components/ServerCardInline";
import { createServer } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";

const now = Date.parse("2025-01-01T00:00:20Z");
function Location() {
	return <output data-testid="location">{useLocation().pathname}</output>;
}

describe("high-density row equivalent lightweight rendering", () => {
	beforeEach(() => {
		Object.assign(window, { ForceUseSvgFlag: true });
	});
	it("updates every dynamic value, keeps two-way traffic and preserves true links", () => {
		const server = createServer({ id: 7, name: "dense-node" });
		const { rerender } = renderWithProviders(
			<DenseRowProvider enabled>
				<ServerCardInline now={now} serverInfo={server} />
				<Location />
			</DenseRowProvider>,
		);
		const row = screen.getByRole("link", { name: /dense-node/ });
		expect(row).toHaveAttribute("href", "/server/7");
		expect(within(row).getAllByRole("progressbar")).toHaveLength(3);
		expect(within(row).getByText("12.00%")).toBeInTheDocument();
		expect(within(row).getByText("16.8 Mbps")).toBeInTheDocument();
		expect(within(row).getByText("8.39 Mbps")).toBeInTheDocument();
		expect(within(row).getByText("2.00 GiB")).toBeInTheDocument();
		expect(within(row).getByText("1.00 GiB")).toBeInTheDocument();
		const updated = createServer({
			...server,
			state: {
				...server.state,
				cpu: 90.01,
				mem_used: 180,
				disk_used: 380,
				net_in_speed: 125000,
				net_out_speed: 250000,
				net_in_transfer: 4096,
				net_out_transfer: 8192,
				uptime: 3 * 86400,
				load_1: 2.45,
			},
		});
		rerender(
			<DenseRowProvider enabled>
				<ServerCardInline now={now + 1000} serverInfo={updated} />
				<Location />
			</DenseRowProvider>,
		);
		expect(within(row).getByText("90.01%")).toHaveClass("text-danger");
		expect(within(row).getByText("90.00%")).toHaveClass("text-warning");
		expect(within(row).getByText("95.00%")).toBeInTheDocument();
		expect(within(row).getByText("2.00 Mbps")).toBeInTheDocument();
		expect(within(row).getByText("1.00 Mbps")).toBeInTheDocument();
		expect(within(row).getByText("4.00 KiB")).toBeInTheDocument();
		expect(within(row).getByText("8.00 KiB")).toBeInTheDocument();
		expect(within(row).getByText("3 serverCard.days")).toBeInTheDocument();
		expect(within(row).getByText("2.45")).toBeInTheDocument();
		expect(fireEvent.click(row, { ctrlKey: true })).toBe(true);
		expect(screen.getByTestId("location")).toHaveTextContent("/");
		fireEvent.click(row);
		expect(screen.getByTestId("location")).toHaveTextContent("/server/7");
		expect(sessionStorage.getItem("fromMainPage")).toBe("true");
	});
	it("continues advancing billing dates while identity fields remain unchanged", () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date("2025-01-15T00:00:00Z"));
			const note = JSON.stringify({
				billingDataMod: {
					amount: "0",
					startDate: "2025-01-01",
					endDate: "2025-01-31",
					autoRenewal: "0",
					cycle: "monthly",
				},
			});
			const server = createServer({ public_note: note });
			const { rerender } = renderWithProviders(
				<DenseRowProvider enabled>
					<ServerCardInline now={now} serverInfo={server} />
				</DenseRowProvider>,
			);
			expect(screen.getByText(/billingInfo.remaining: 16/)).toBeInTheDocument();
			vi.setSystemTime(new Date("2025-01-16T00:00:00Z"));
			rerender(
				<DenseRowProvider enabled>
					<ServerCardInline now={now + 1000} serverInfo={{ ...server }} />
				</DenseRowProvider>,
			);
			expect(screen.getByText(/billingInfo.remaining: 15/)).toBeInTheDocument();
		} finally {
			vi.useRealTimers();
		}
	});
	it("preserves unknown readings, offline metadata and the public-note empty-push cache", () => {
		const note = JSON.stringify({
			billingDataMod: { amount: "0", endDate: "0000-00-00" },
			planDataMod: { extra: "retained-plan" },
		});
		const first = createServer({
			id: 8,
			public_note: note,
			state: { cpu: Number.NaN },
			host: { mem_total: 0 },
		});
		const { rerender } = renderWithProviders(
			<DenseRowProvider enabled>
				<ServerCardInline now={now} serverInfo={first} />
			</DenseRowProvider>,
		);
		expect(screen.getAllByText("—")).toHaveLength(2);
		expect(screen.queryByText("0.00%")).not.toBeInTheDocument();
		expect(screen.getByText("billingInfo.free")).toBeInTheDocument();
		expect(screen.getByText("retained-plan")).toBeInTheDocument();
		rerender(
			<DenseRowProvider enabled>
				<ServerCardInline
					now={now + 60000}
					serverInfo={createServer({
						id: 8,
						public_note: "",
						last_active: "2025-01-01T00:00:00Z",
					})}
				/>
			</DenseRowProvider>,
		);
		expect(screen.getByText("billingInfo.free")).toBeInTheDocument();
		expect(screen.getByText("retained-plan")).toBeInTheDocument();
		expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
		expect(screen.getByText("serverList.offline")).toBeInTheDocument();
		expect(screen.getByText(/serverDetail.lastActive/)).toBeInTheDocument();
	});
});
