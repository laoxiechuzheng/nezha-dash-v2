import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Header from "@/components/Header";
import { SearchButton } from "@/components/SearchButton";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CommandProvider } from "@/context/command-provider";
import { useCommand } from "@/hooks/use-command";
import { createSettingResponse } from "@/test/fixtures";
import { createTestQueryClient } from "@/test/utils";

const mocks = vi.hoisted(() => ({
	fetchSetting: vi.fn(),
	fetchLoginUser: vi.fn(),
	updateBackground: vi.fn(),
}));

vi.mock("@/lib/nezha-api", () => ({
	fetchSetting: mocks.fetchSetting,
	fetchLoginUser: mocks.fetchLoginUser,
}));
vi.mock("@/hooks/use-background", () => ({
	useBackground: () => ({
		backgroundImage: "/r4-fixture.png",
		updateBackground: mocks.updateBackground,
	}),
}));
vi.mock("@/hooks/use-websocket-context", () => ({
	useWebSocketContext: () => ({
		connected: true,
		lastData: { now: 1, online: 12, servers: [] },
		setNeedReconnect: vi.fn(),
	}),
}));

function CommandProbe() {
	const { isOpen } = useCommand();
	return <p>{isOpen ? "r4-command-open" : "r4-command-closed"}</p>;
}

const longTitle =
	"F1 R4 本地测试站点名称非常长但后台入口自定义链接仍必须完整保留";
const links = ["Docs", "Status", "Support", "Very long custom link name"].map(
	(name, index) => ({ name, link: `#r4-link-${index}` }),
);

describe("R4 header layout contract", () => {
	beforeEach(() => {
		const setting = createSettingResponse();
		setting.data.config.site_name = longTitle;
		mocks.fetchSetting.mockResolvedValue(setting);
		mocks.fetchLoginUser.mockRejectedValue(new Error("fixture anonymous"));
		mocks.updateBackground.mockClear();
		Object.assign(window, {
			CustomBackgroundImage: "/r4-fixture.png",
			CustomMobileBackgroundImage: "",
			CustomLinks: JSON.stringify(links),
			CustomLogo: "",
			CustomDesc: "",
		});
	});

	it("keeps tablet search icon-only until the desktop breakpoint without losing its label or click", async () => {
		const user = userEvent.setup();
		render(
			<CommandProvider>
				<SearchButton />
				<CommandProbe />
			</CommandProvider>,
		);
		const trigger = screen.getByRole("button", {
			name: "v2Shell.search.label",
		});
		expect(trigger).toHaveClass("sh-search-trigger");
		expect(screen.getByText("header.searchPlaceholder")).toHaveClass(
			"hidden",
			"lg:inline",
		);
		expect(trigger.querySelector("kbd")).toHaveClass(
			"hidden",
			"lg:inline-flex",
		);
		expect(screen.getByText("header.searchPlaceholder")).not.toHaveClass(
			"md:inline",
		);
		await user.click(trigger);
		expect(screen.getByText("r4-command-open")).toBeInTheDocument();
	});

	it("preserves long title, every custom link, dashboard entry and background handler in the existing mobile Sheet", async () => {
		const user = userEvent.setup();
		const { container } = render(
			<QueryClientProvider client={createTestQueryClient()}>
				<MemoryRouter>
					<ThemeProvider storageKey="r4-theme">
						<CommandProvider>
							<Header />
						</CommandProvider>
					</ThemeProvider>
				</MemoryRouter>
			</QueryClientProvider>,
		);
		expect(await screen.findByText(longTitle)).toBeInTheDocument();
		expect(container.querySelector(".sh-brand")).toHaveAttribute(
			"title",
			longTitle,
		);
		for (const link of links)
			expect(screen.getByRole("link", { name: link.name })).toHaveAttribute(
				"href",
				link.link,
			);
		expect(await screen.findByRole("link", { name: "login" })).toHaveAttribute(
			"href",
			"/dashboard",
		);
		await user.click(screen.getByTitle("header.toggleBackground"));
		expect(mocks.updateBackground).toHaveBeenCalledWith(undefined);
		expect(sessionStorage.getItem("savedBackgroundImage")).toBe(
			"/r4-fixture.png",
		);
		await user.click(screen.getByRole("button", { name: "header.menu" }));
		const sheet = await screen.findByRole("dialog", { name: "header.menu" });
		expect(within(sheet).getByRole("link", { name: "login" })).toHaveAttribute(
			"href",
			"/dashboard",
		);
		for (const link of links)
			expect(
				within(sheet).getByRole("link", { name: link.name }),
			).toHaveAttribute("href", link.link);
		expect(
			within(sheet).getByRole("button", { name: "v2Shell.language.label" }),
		).toBeInTheDocument();
		expect(
			within(sheet).getByRole("button", { name: "v2Shell.theme.label" }),
		).toBeInTheDocument();
	});
});
