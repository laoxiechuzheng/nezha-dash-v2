import { Bars3Icon } from "@heroicons/react/20/solid";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ImageMinus } from "lucide-react";
import { DateTime } from "luxon";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ModeToggle } from "@/components/ThemeSwitcher";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackground } from "@/hooks/use-background";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { fetchLoginUser, fetchSetting } from "@/lib/nezha-api";
import { cn } from "@/lib/utils";

import AnimateCountClient from "./AnimatedCount";
import { BrandMark } from "./BrandMark";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Loader, LoadingSpinner } from "./loading/Loader";
import NumericText from "./NumericText";
import { SearchButton } from "./SearchButton";
import { Button } from "./ui/button";

interface TimeState {
	hh: number;
	mm: number;
	ss: number;
}

const useCurrentTime = () => {
	const [time, setTime] = useState<TimeState>({
		hh: DateTime.now().setLocale("en-US").hour,
		mm: DateTime.now().setLocale("en-US").minute,
		ss: DateTime.now().setLocale("en-US").second,
	});

	useEffect(() => {
		const intervalId = setInterval(() => {
			const now = DateTime.now().setLocale("en-US");
			setTime({
				hh: now.hour,
				mm: now.minute,
				ss: now.second,
			});
		}, 1000);

		return () => clearInterval(intervalId);
	}, []);

	return time;
};

/** 图标视觉 32px，额外热区达到 40px。 */
const headerControlClass = "ghost-icon";

function Header() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { backgroundImage, updateBackground } = useBackground();

	const { data: settingData, isLoading } = useQuery({
		queryKey: ["setting"],
		queryFn: () => fetchSetting(),
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		retry: false,
	});

	const { lastData, connected } = useWebSocketContext();

	const onlineCount = connected ? (lastData ? lastData.online || 0 : 0) : "...";

	const siteName = settingData?.data?.config?.site_name;

	// @ts-expect-error CustomLogo is a global variable
	const customLogo = window.CustomLogo || undefined;

	// @ts-expect-error CustomDesc is a global variable
	const customDesc = window.CustomDesc || t("nezha");

	const customMobileBackgroundImage =
		window.CustomMobileBackgroundImage !== ""
			? window.CustomMobileBackgroundImage
			: undefined;

	useEffect(() => {
		const link =
			document.querySelector("link[rel*='icon']") ||
			document.createElement("link");
		// @ts-expect-error set link.type
		link.type = "image/x-icon";
		// @ts-expect-error set link.rel
		link.rel = "shortcut icon";
		// @ts-expect-error set link.href
		link.href = customLogo || "/apple-touch-icon.png";
		document.getElementsByTagName("head")[0].appendChild(link);
	}, [customLogo]);

	useEffect(() => {
		document.title = siteName || "哪吒监控 Nezha Monitoring";
	}, [siteName]);

	const handleBackgroundToggle = () => {
		if (window.CustomBackgroundImage) {
			// Store the current background image before removing it
			sessionStorage.setItem(
				"savedBackgroundImage",
				window.CustomBackgroundImage,
			);
			updateBackground(undefined);
		} else {
			// Restore the saved background image
			const savedImage = sessionStorage.getItem("savedBackgroundImage");
			if (savedImage) {
				updateBackground(savedImage);
			}
		}
	};

	const customBackgroundImage = backgroundImage;

	return (
		<header className="sh-header glass w-full">
			{!connected && lastData && (
				<span className="sh-disconnected" aria-hidden="true" />
			)}
			<div className="sh-header-inner page-container">
				<button
					type="button"
					onClick={() => {
						sessionStorage.removeItem("selectedGroup");
						navigate("/");
					}}
					className="sh-brand"
					title={siteName}
				>
					<BrandMark customLogo={customLogo} />
					<span className="sh-brand-name">
						{isLoading ? (
							<Skeleton className="h-4 w-20" />
						) : (
							siteName || "NEZHA"
						)}
					</span>
					<span className="hidden min-w-0 truncate text-xs text-muted-foreground lg:block">
						{customDesc}
					</span>
				</button>
				<SearchButton />
				<section className="sh-header-actions">
					<nav className="hidden items-center gap-3 md:flex">
						<Links />
						<DashboardLink className="rounded-[10px] px-2 py-2 hover:bg-foreground/6" />
					</nav>
					<div className="hidden items-center gap-2 md:flex">
						<LanguageSwitcher />
						<ModeToggle />
					</div>
					{(customBackgroundImage ||
						sessionStorage.getItem("savedBackgroundImage")) && (
						<Button
							variant="ghost"
							size="sm"
							title={t("header.toggleBackground")}
							onClick={handleBackgroundToggle}
							className={cn(headerControlClass, {
								"hidden sm:inline-flex": customMobileBackgroundImage,
							})}
						>
							<ImageMinus className="size-[18px]" />
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						title={t("header.viewers")}
						aria-label={t("header.viewers")}
						className="sh-visitors num"
					>
						<span
							className="status-dot"
							data-status={connected ? "online" : "offline"}
							aria-hidden="true"
						/>
						{connected ? (
							<NumericText value={onlineCount} />
						) : (
							<Loader visible={true} />
						)}
						<span className="hidden text-muted-foreground xl:inline">
							{t("v2Shell.header.visitors")}
						</span>
						<span className="sr-only">
							{connected ? t("online") : t("offline")}
						</span>
					</Button>
					{!connected && lastData && (
						<span className="chip hidden xl:inline-flex" data-tone="danger">
							{t("v2Shell.header.disconnected")}
						</span>
					)}
					<MobileNavMenu />
				</section>
			</div>
		</header>
	);
}

type links = {
	link: string;
	name: string;
};

function parseCustomLinks(customLinks: string | undefined): links[] | null {
	if (!customLinks) return null;

	try {
		const parsedLinks = JSON.parse(customLinks);

		if (!Array.isArray(parsedLinks)) {
			return null;
		}

		return parsedLinks.filter(
			(link): link is links =>
				typeof link?.link === "string" && typeof link?.name === "string",
		);
	} catch {
		return null;
	}
}

function getCustomLinks() {
	// @ts-expect-error CustomLinks is a global variable
	return parseCustomLinks(window.CustomLinks as string);
}

function Links() {
	const links = getCustomLinks();

	if (!links) return null;

	return (
		<div className="flex w-fit items-center gap-4">
			{links.map((link, index) => {
				return (
					<a
						key={index}
						href={link.link}
						target="_blank"
						rel="noopener noreferrer"
						className="whitespace-nowrap text-[13px] text-muted-foreground transition-colors hover:text-foreground"
					>
						{link.name}
					</a>
				);
			})}
		</div>
	);
}

export function RefreshToast() {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const { needReconnect } = useWebSocketContext();

	if (!needReconnect) {
		return null;
	}

	if (needReconnect) {
		sessionStorage.removeItem("needRefresh");
		setTimeout(() => {
			navigate(0);
		}, 1000);
	}

	return (
		<div className="refresh-toast-animate fixed left-1/2 top-4 z-[999] flex -translate-x-1/2 items-center gap-2 rounded-[14px] border border-border border-l-[3px] border-l-primary bg-popover px-3 py-2 text-popover-foreground shadow-popover">
			<LoadingSpinner />
			<p className="text-[13px] font-medium">{t("refreshing")}...</p>
		</div>
	);
}

/** 手机导航使用 Radix Dialog，保持焦点陷阱、Esc 与全部自定义链接。 */
function MobileNavMenu() {
	const { t } = useTranslation();
	const links = getCustomLinks() ?? [];

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					aria-label={t("header.menu")}
					title={t("header.menu")}
					className={cn(headerControlClass, "md:hidden")}
				>
					<Bars3Icon className="size-5" aria-hidden="true" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sh-menu-content sh-sheet">
				<div className="sh-menu-head">
					<DialogTitle>{t("header.menu")}</DialogTitle>
					<DialogDescription className="sr-only">
						{t("v2Shell.header.navigation")}
					</DialogDescription>
				</div>
				<nav
					className="sh-menu-links"
					aria-label={t("v2Shell.header.navigation")}
				>
					<DialogClose asChild>
						<DashboardLink className="w-full" />
					</DialogClose>
					{links.length > 0 && (
						<p className="eyebrow mt-6 mb-2 px-3">
							{t("v2Shell.header.customLinks")}
						</p>
					)}
					{links.map((link, index) => (
						<DialogClose key={index} asChild>
							<a href={link.link} target="_blank" rel="noopener noreferrer">
								<ExternalLink
									className="size-[18px] shrink-0 text-muted-foreground"
									aria-hidden="true"
								/>
								{link.name}
							</a>
						</DialogClose>
					))}
				</nav>
				<div className="sh-menu-foot">
					<LanguageSwitcher />
					<ModeToggle />
				</div>
			</DialogContent>
		</Dialog>
	);
}

function DashboardLink({ className, ...props }: ComponentProps<"a">) {
	const { t } = useTranslation();
	const { setNeedReconnect } = useWebSocketContext();
	const previousLoginState = useRef<boolean | null>(null);
	const {
		data: userData,
		isFetched,
		isLoadingError,
		isError,
		refetch,
	} = useQuery({
		queryKey: ["login-user"],
		queryFn: () => fetchLoginUser(),
		refetchOnMount: false,
		refetchOnWindowFocus: true,
		refetchIntervalInBackground: true,
		refetchInterval: 1000 * 30,
		retry: 0,
	});

	const isLogin = isError
		? false
		: userData
			? !!userData?.data?.id && !!document.cookie
			: false;

	if (isLoadingError) {
		previousLoginState.current = isLogin;
	}

	useEffect(() => {
		refetch();
	}, [refetch]);

	useEffect(() => {
		if (isFetched || isError) {
			// 只有当登录状态发生变化时才设置needReconnect
			if (
				previousLoginState.current !== null &&
				previousLoginState.current !== isLogin
			) {
				setNeedReconnect(true);
			}
			previousLoginState.current = isLogin;
		}
	}, [isLogin, isError, isFetched, setNeedReconnect]);

	return (
		<a
			{...props}
			href={"/dashboard"}
			rel="noopener noreferrer"
			className={cn(
				"whitespace-nowrap text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground",
				className,
			)}
		>
			{!isLogin && t("login")}
			{isLogin && t("dashboard")}
		</a>
	);
}

/** Page heading for the overview page: title plus a live local clock. */
export function Overview() {
	const { t } = useTranslation();
	const time = useCurrentTime();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<section className="header-timer flex items-end justify-between gap-3">
			<h1 className="eyebrow">{t("overview")}</h1>
			<div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
				<span className="hidden min-[380px]:inline">{t("whereTheTimeIs")}</span>
				{mounted ? (
					<div className="flex items-center font-mono text-[13px] text-foreground tabular-nums">
						<AnimateCountClient count={time.hh} minDigits={2} />
						<span className="text-muted-foreground">:</span>
						<AnimateCountClient count={time.mm} minDigits={2} />
						<span className="text-muted-foreground">:</span>
						<AnimateCountClient count={time.ss} minDigits={2} />
					</div>
				) : (
					<Skeleton className="h-4 w-16 animate-none" />
				)}
			</div>
		</section>
	);
}
export default Header;
