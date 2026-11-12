import { Bars3Icon } from "@heroicons/react/20/solid";
import { useQuery } from "@tanstack/react-query";
import { ImageMinus } from "lucide-react";
import { DateTime } from "luxon";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ModeToggle } from "@/components/ThemeSwitcher";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackground } from "@/hooks/use-background";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { fetchLoginUser, fetchSetting } from "@/lib/nezha-api";
import { cn } from "@/lib/utils";

import AnimateCountClient from "./AnimatedCount";
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

/** Icon-sized header control: 40px touch target on phones, 36px on desktop. */
const headerControlClass = "size-10 px-0 sm:size-9";

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
	const customLogo = window.CustomLogo || "/apple-touch-icon.png";

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
		link.href = customLogo;
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
		<header
			className={cn(
				"sticky top-0 z-40 w-full border-b border-border bg-background",
				{
					"bg-card/85": customBackgroundImage,
				},
			)}
		>
			<div className="page-container flex h-14 min-w-0 items-center justify-between gap-3">
				<section
					onClick={() => {
						sessionStorage.removeItem("selectedGroup");
						navigate("/");
					}}
					className="flex min-w-0 cursor-pointer items-center gap-2.5"
				>
					<span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card">
						<img
							width={40}
							height={40}
							alt="apple-touch-icon"
							src={customLogo}
							className="size-5 object-cover object-top"
						/>
					</span>
					<span className="truncate text-[15px] font-semibold leading-none">
						{isLoading ? (
							<Skeleton className="h-4 w-20 animate-none" />
						) : (
							siteName || "NEZHA"
						)}
					</span>
					<span
						aria-hidden="true"
						className="hidden h-4 w-px shrink-0 bg-border md:block"
					/>
					<p className="hidden truncate text-[13px] text-muted-foreground md:block">
						{customDesc}
					</p>
				</section>
				<section className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5">
					<nav className="mr-2 hidden items-center gap-4 sm:flex">
						<Links />
						<DashboardLink />
					</nav>
					<SearchButton />
					<LanguageSwitcher />
					<ModeToggle />
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
							<ImageMinus className="size-4" />
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						title={t("header.viewers")}
						className="h-10 cursor-default gap-1.5 px-2.5 tabular-nums hover:bg-card sm:h-9"
					>
						<span
							className="status-dot"
							data-status={connected ? "online" : "offline"}
						/>
						{connected ? (
							<NumericText value={onlineCount} />
						) : (
							<Loader visible={true} />
						)}
						<p className="hidden text-muted-foreground min-[420px]:block">
							{connected ? t("online") : t("offline")}
						</p>
					</Button>
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
		<div className="refresh-toast-animate fixed left-1/2 top-4 z-[999] flex -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground shadow-popover">
			<LoadingSpinner />
			<p className="text-[13px] font-medium">{t("refreshing")}...</p>
		</div>
	);
}

/**
 * Phone-only navigation: the dashboard/login entry and any custom links share
 * one menu on the first header row instead of a second row.
 */
function MobileNavMenu() {
	const { t } = useTranslation();
	const links = getCustomLinks() ?? [];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					aria-label={t("header.menu")}
					title={t("header.menu")}
					className={cn(headerControlClass, "sm:hidden")}
				>
					<Bars3Icon className="size-4" aria-hidden="true" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-40">
				<DropdownMenuItem asChild>
					<DashboardLink className="w-full cursor-pointer text-popover-foreground hover:text-popover-foreground" />
				</DropdownMenuItem>
				{links.length > 0 && <DropdownMenuSeparator />}
				{links.map((link, index) => (
					<DropdownMenuItem key={index} asChild>
						<a
							href={link.link}
							target="_blank"
							rel="noopener noreferrer"
							className="w-full cursor-pointer"
						>
							{link.name}
						</a>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
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
			<h1 className="text-xl font-semibold leading-tight">{t("overview")}</h1>
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
