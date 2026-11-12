import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import ServerCardInline from "@/components/ServerCardInline";
import ServerListHeader from "@/components/ServerListHeader";
import ServerOverview from "@/components/ServerOverview";
import ServerPlatform from "@/components/ServerPlatform";
import TabSwitch from "@/components/TabSwitch";
import UsageCell from "@/components/UsageCell";
import { StatusProvider } from "@/context/status-provider";
import { createServer } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";

function LocationProbe() {
	const location = useLocation();
	return <p data-testid="location">{location.pathname}</p>;
}

afterEach(() => {
	window.CustomBackgroundImage = "";
	// @ts-expect-error CustomIllustration is a global variable
	window.CustomIllustration = undefined;
	// @ts-expect-error DisableAnimatedMan is a global variable
	window.DisableAnimatedMan = undefined;
});

describe("UsageCell", () => {
	it("colours the reading by the shared usage thresholds", () => {
		const { rerender } = render(<UsageCell label="CPU" value={70} />);
		const reading = () => screen.getByText(/%$/);

		expect(screen.getByText("CPU")).toBeInTheDocument();
		expect(reading()).toHaveTextContent("70.00%");
		expect(reading()).toHaveAttribute("data-level", "good");
		expect(reading()).not.toHaveClass("text-warning");
		expect(reading()).not.toHaveClass("text-danger");
		expect(screen.getByRole("progressbar")).toHaveAttribute(
			"data-level",
			"good",
		);

		rerender(<UsageCell label="CPU" value={85.5} />);
		expect(reading()).toHaveTextContent("85.50%");
		expect(reading()).toHaveAttribute("data-level", "warn");
		expect(reading()).toHaveClass("text-warning");
		expect(screen.getByRole("progressbar")).toHaveAttribute(
			"data-level",
			"warn",
		);

		rerender(<UsageCell label="CPU" value={95} />);
		expect(reading()).toHaveAttribute("data-level", "bad");
		expect(reading()).toHaveClass("text-danger");
		expect(screen.getByRole("progressbar")).toHaveAttribute(
			"data-level",
			"bad",
		);
	});
});

describe("ServerPlatform", () => {
	it("renders nothing without a platform", () => {
		const { container } = render(<ServerPlatform platform="" />);
		expect(container).toBeEmptyDOMElement();
	});

	it("shows the Windows glyph and a short name", () => {
		const { container } = render(
			<ServerPlatform platform="Microsoft Windows 11 Pro" />,
		);
		expect(screen.getByText("Windows")).toBeInTheDocument();
		expect(container.querySelector("svg")).toBeInTheDocument();
	});

	it("shows the font logo and OS name for other systems", () => {
		const { container } = render(<ServerPlatform platform="debian" />);
		expect(container.querySelector("i.fl-debian")).toBeInTheDocument();
		expect(screen.getByText("Debian")).toBeInTheDocument();
	});
});

describe("ServerListHeader", () => {
	it("labels every list column and stays out of the accessibility tree", () => {
		const { container } = render(<ServerListHeader />);
		const header = container.firstElementChild as HTMLElement;

		expect(header).toHaveAttribute("aria-hidden", "true");
		for (const key of [
			"serverList.name",
			"serverList.cpu",
			"serverList.mem",
			"serverList.disk",
			"serverList.speed",
			"serverList.traffic",
			"serverList.load",
			"serverList.uptime",
		]) {
			expect(within(header).getByText(key)).toBeInTheDocument();
		}
	});
});

describe("ServerCardInline list row", () => {
	it("navigates to the server detail page and remembers the scroll position", async () => {
		const user = userEvent.setup();
		const server = createServer({ id: 21, name: "row-alpha" });
		Object.defineProperty(window, "scrollY", {
			configurable: true,
			value: 120,
		});

		renderWithProviders(
			<>
				<ServerCardInline
					now={Date.parse("2025-01-01T00:00:20.000Z")}
					serverInfo={server}
				/>
				<LocationProbe />
			</>,
		);

		const row = screen.getByRole("link", { name: /row-alpha/ });
		expect(row).toHaveAttribute("href", "/server/21");
		expect(row).toHaveAttribute("data-online", "true");

		await user.click(row);

		expect(screen.getByTestId("location")).toHaveTextContent("/server/21");
		expect(sessionStorage.getItem("fromMainPage")).toBe("true");
		expect(sessionStorage.getItem("scrollPosition")).toBe("120");
	});

	it("leaves modified clicks to the browser", () => {
		const server = createServer({ id: 22, name: "row-beta" });

		renderWithProviders(
			<>
				<ServerCardInline
					now={Date.parse("2025-01-01T00:00:20.000Z")}
					serverInfo={server}
				/>
				<LocationProbe />
			</>,
		);

		const row = screen.getByRole("link", { name: /row-beta/ });
		const notCancelled = fireEvent.click(row, { ctrlKey: true });

		expect(notCancelled).toBe(true);
		expect(screen.getByTestId("location")).toHaveTextContent("/");
	});

	it("marks offline rows and shows the last active time", () => {
		const server = createServer({
			id: 23,
			name: "row-offline",
			last_active: "2024-12-31T23:00:00.000Z",
		});

		renderWithProviders(
			<ServerCardInline
				now={Date.parse("2025-01-01T00:00:20.000Z")}
				serverInfo={server}
			/>,
		);

		const row = screen.getByRole("link", { name: /row-offline/ });
		expect(row).toHaveAttribute("data-online", "false");
		expect(screen.getByText("serverList.offline")).toBeInTheDocument();
		expect(screen.getByText(/serverDetail\.lastActive/)).toBeInTheDocument();
		expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
	});
});

describe("ServerOverview KPI strip", () => {
	it("marks the active status KPI and highlights offline servers", () => {
		render(
			<StatusProvider>
				<ServerOverview
					total={3}
					online={2}
					offline={1}
					up={1024}
					down={2048}
					upSpeed={125_000}
					downSpeed={250_000}
				/>
			</StatusProvider>,
		);

		const all = screen.getByRole("button", {
			name: /serverOverview\.totalServers/,
		});
		const online = screen.getByRole("button", {
			name: /serverOverview\.onlineServers/,
		});
		const offline = screen.getByRole("button", {
			name: /serverOverview\.offlineServers/,
		});

		expect(all).toHaveAttribute("aria-pressed", "true");
		expect(online).toHaveAttribute("aria-pressed", "false");
		expect(offline).toHaveAttribute("data-filter", "offline");
		expect(within(offline).getByText("1")).toHaveClass("text-danger");
		expect(within(online).getByText("2")).not.toHaveClass("text-danger");

		fireEvent.click(online);
		expect(online).toHaveAttribute("aria-pressed", "true");
		expect(all).toHaveAttribute("aria-pressed", "false");

		expect(screen.getByText("1.00 KiB")).toBeInTheDocument();
		expect(screen.getByText("2.00 KiB")).toBeInTheDocument();
		expect(screen.queryByAltText("animated-man")).not.toBeInTheDocument();
	});

	it("keeps a zero offline count neutral and shows a configured illustration", () => {
		// @ts-expect-error CustomIllustration is a global variable
		window.CustomIllustration = "/illustration.png";
		window.CustomBackgroundImage = "/background.jpg";

		const { container } = render(
			<StatusProvider>
				<ServerOverview
					total={1}
					online={1}
					offline={0}
					up={0}
					down={0}
					upSpeed={0}
					downSpeed={0}
				/>
			</StatusProvider>,
		);

		const offline = screen.getByRole("button", {
			name: /serverOverview\.offlineServers/,
		});
		expect(within(offline).getByText("0")).not.toHaveClass("text-danger");
		expect(screen.getByAltText("animated-man")).toHaveAttribute(
			"src",
			"/illustration.png",
		);
		expect(container.querySelector(".server-overview")).toHaveClass(
			"opacity-95",
		);
	});

	it("hides the illustration when the animated figure is disabled", () => {
		// @ts-expect-error CustomIllustration is a global variable
		window.CustomIllustration = "/illustration.png";
		// @ts-expect-error DisableAnimatedMan is a global variable
		window.DisableAnimatedMan = true;

		render(
			<StatusProvider>
				<ServerOverview
					total={0}
					online={0}
					offline={0}
					up={0}
					down={0}
					upSpeed={0}
					downSpeed={0}
				/>
			</StatusProvider>,
		);

		expect(screen.queryByAltText("animated-man")).not.toBeInTheDocument();
	});
});

describe("TabSwitch", () => {
	it("exposes tabs with a single selected tab", async () => {
		const user = userEvent.setup();
		let current = "Detail";
		const { rerender } = render(
			<TabSwitch
				tabs={["Detail", "Network"]}
				currentTab={current}
				setCurrentTab={(tab) => {
					current = tab;
				}}
			/>,
		);

		await user.click(screen.getByRole("tab", { name: "tabSwitch.Network" }));
		expect(current).toBe("Network");

		rerender(
			<TabSwitch
				tabs={["Detail", "Network"]}
				currentTab={current}
				setCurrentTab={() => {}}
			/>,
		);
		expect(
			screen.getByRole("tab", { name: "tabSwitch.Network" }),
		).toHaveAttribute("aria-selected", "true");
		expect(
			screen.getByRole("tab", { name: "tabSwitch.Detail" }),
		).toHaveAttribute("aria-selected", "false");
		expect(screen.getAllByRole("tab", { selected: true })).toHaveLength(1);
	});
});
