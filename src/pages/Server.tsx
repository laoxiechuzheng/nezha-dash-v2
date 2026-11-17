import {
	ArrowDownIcon,
	ArrowsUpDownIcon,
	ArrowUpIcon,
	ChartBarSquareIcon,
	ExclamationTriangleIcon,
	ListBulletIcon,
	MapIcon,
	ServerStackIcon,
	Squares2X2Icon,
} from "@heroicons/react/20/solid";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import GlobalMap from "@/components/GlobalMap";
import GroupSwitch from "@/components/GroupSwitch";
import AttentionStrip from "@/components/home/AttentionStrip";
import { DenseRowProvider } from "@/components/home/DenseRow";
import DrawingDefs from "@/components/home/DrawingDefs";
import { HomeDisplayContext } from "@/components/home/HomeDisplay";
import {
	buildNodeTraces,
	fleetMemberKey,
	type NodeSample,
} from "@/lib/fleet-trace";
import "@/styles/home.css";
import { Loader } from "@/components/loading/Loader";
import ServerCard from "@/components/ServerCard";
import ServerCardInline from "@/components/ServerCardInline";
import ServerListHeader from "@/components/ServerListHeader";
import ServerOverview from "@/components/ServerOverview";
import { ServiceTracker } from "@/components/ServiceTracker";
import { Skeleton } from "@/components/ui/skeleton";
import { SORT_TYPES } from "@/context/sort-context";
import { useSort } from "@/hooks/use-sort";
import { useStatus } from "@/hooks/use-status";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { fetchServerGroup, fetchService } from "@/lib/nezha-api";
import { cn } from "@/lib/utils";
import type { NezhaServer, ServerGroup } from "@/types/nezha-api";

type PreparedServer = {
	online: boolean;
	server: NezhaServer;
};

type ServerView = "list" | "card" | "map";

const EMPTY_SERVER_LIST: NezhaServer[] = [];

const isServerOnline = (now: number, server: NezhaServer) => {
	const lastActiveTime = server.last_active.startsWith("000")
		? 0
		: Date.parse(server.last_active);

	return now - lastActiveTime <= 30000;
};

const getUsagePercent = (used = 0, total = 0) => {
	if (!total) return 0;
	return (used / total) * 100;
};

const getErrorMessage = (error: unknown) => {
	if (!error) return "";
	if (error instanceof Error) return error.message;
	return String(error);
};

/**
 * Reads a persisted "0"/"1" view flag. `force` mirrors the window.Force*
 * switches site owners can set through custom code.
 */
const readStoredFlag = (key: string, fallback: string, force?: boolean) => {
	if (force) return "1";
	return localStorage.getItem(key) ?? fallback;
};

function BackendErrorState({
	error,
	onRetry,
}: {
	error: unknown;
	onRetry: () => void;
}) {
	const { t } = useTranslation();
	const message = getErrorMessage(error);

	return (
		<div className="flex min-h-96 flex-col items-center justify-center text-center">
			<div className="panel flex w-full max-w-lg flex-col items-center gap-2 px-6 py-10">
				<ExclamationTriangleIcon
					aria-hidden="true"
					className="mb-1 size-6 text-warning"
				/>
				<p className="text-base font-semibold">
					{t("error.backendUnavailableTitle")}
				</p>
				<p className="text-[13px] text-muted-foreground">
					{t("error.backendUnavailableDescription")}
				</p>
				<button type="button" className="hm-reconnect" onClick={onRetry}>
					{t("v2Home.reconnect")}
				</button>
				{message && (
					<p className="mt-2 max-w-full break-words rounded-md bg-danger/10 px-3 py-2 font-mono text-xs text-danger">
						{message}
					</p>
				)}
			</div>
		</div>
	);
}

function ServerEmptyState({ filtered = false }: { filtered?: boolean }) {
	const { t } = useTranslation();

	return (
		<div
			className="server-empty-state panel flex min-h-52 flex-col items-center justify-center gap-2 px-4 text-center"
			role="status"
		>
			<ServerStackIcon
				aria-hidden="true"
				className="size-6 text-muted-foreground/60"
			/>
			<p className="text-[13px] text-muted-foreground">
				{t(filtered ? "info.noMatchingServers" : "info.noServers")}
			</p>
		</div>
	);
}

/** Skeleton of the overview page shown while the websocket connects. */
function ServerPageSkeleton({ label }: { label: string }) {
	return (
		<div className="flex w-full flex-col gap-4" aria-busy="true">
			<div className="flex items-center gap-2 text-[13px] text-muted-foreground">
				<Loader visible={true} />
				{label}
			</div>
			<div className="hm-hero">
				<Skeleton className="hm-stage" />
				<Skeleton className="hm-skeleton-fleet" />
			</div>
			<div className="hm-node-grid hm-skeleton-grid">
				{Array.from({ length: 6 }, (_, index) => (
					<Skeleton key={index} className="hm-node-tile hm-skeleton-tile" />
				))}
			</div>
		</div>
	);
}

export default function Servers({
	backendError,
}: {
	backendError?: Error | null;
}) {
	const { t } = useTranslation();
	const { sortType, sortOrder, setSortOrder, setSortType } = useSort();
	const { data: groupData, error: groupError } = useQuery({
		queryKey: ["server-group"],
		queryFn: () => fetchServerGroup(),
		retry: false,
	});
	const { data: serviceData, error: serviceError } = useQuery({
		queryKey: ["service"],
		queryFn: () => fetchService(),
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		refetchInterval: 10000,
		retry: false,
	});
	const serviceCount = Object.keys(serviceData?.data?.services ?? {}).length;
	const hasServices = serviceCount > 0;
	const { lastData, connected, messageHistory, reconnect } =
		useWebSocketContext();
	const { status, setStatus } = useStatus();
	const [showServices, setShowServices] = useState<string>(() =>
		readStoredFlag("showServices", "0", window.ForceShowServices),
	);
	const [showMap, setShowMap] = useState<string>(() =>
		readStoredFlag("showMap", "0", window.ForceShowMap),
	);
	// 已保存/强制偏好优先；无偏好在首批非空数据到达时锁定，resize 不重置。
	const [inline, setInline] = useState<string | null>(() =>
		window.ForceCardInline ? "1" : localStorage.getItem("inline"),
	);
	const defaultInline = useRef<string | null>(null);
	if (defaultInline.current === null && lastData?.servers.length) {
		defaultInline.current =
			window.innerWidth >= 768 && lastData.servers.length <= 120 ? "0" : "1";
	}
	const resolvedInline = inline ?? defaultInline.current ?? "1";
	const hasWsData = Boolean(lastData);
	const [reducedMotion, setReducedMotion] = useState(
		() => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	);
	const highDensity = (lastData?.servers.length ?? 0) > 120;
	const motion =
		!reducedMotion && (lastData?.servers.length ?? 0) <= 60 ? "live" : "still";
	const gridRef = useRef<HTMLElement>(null);
	const entered = useRef(false);
	const hasRestoredScroll = useRef(false);
	const [currentGroup, setCurrentGroup] = useState<string>("All");
	const nezhaWsData = lastData;

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const restoreScrollPosition = useCallback(() => {
		const isFromMainPage = sessionStorage.getItem("fromMainPage") === "true";
		const savedPosition = sessionStorage.getItem("scrollPosition");
		const scrollTop = savedPosition ? Number(savedPosition) : Number.NaN;

		if (
			hasRestoredScroll.current ||
			!isFromMainPage ||
			!Number.isFinite(scrollTop)
		) {
			return;
		}

		hasRestoredScroll.current = true;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				window.scrollTo({ top: scrollTop, left: 0, behavior: "auto" });
			});
		});
	}, []);

	const handleTagChange = (newGroup: string) => {
		setCurrentGroup(newGroup);
		sessionStorage.setItem("selectedGroup", newGroup);
		sessionStorage.setItem("scrollPosition", String(window.scrollY || 0));
	};

	const selectView = (view: ServerView) => {
		if (view === "map") {
			setShowMap("1");
			localStorage.setItem("showMap", "1");
			return;
		}
		const nextInline = view === "list" ? "1" : "0";
		setShowMap("0");
		localStorage.setItem("showMap", "0");
		setInline(nextInline);
		localStorage.setItem("inline", nextInline);
	};

	const toggleServices = () => {
		const next = showServices === "1" ? "0" : "1";
		setShowServices(next);
		localStorage.setItem("showServices", next);
	};

	useEffect(() => {
		const savedGroup = sessionStorage.getItem("selectedGroup") || "All";
		setCurrentGroup(savedGroup);
	}, []);

	useEffect(() => {
		if (nezhaWsData) {
			restoreScrollPosition();
		}
	}, [nezhaWsData, restoreScrollPosition]);

	const groupServerIdSets = useMemo(() => {
		const sets = new Map<string, Set<number>>();

		for (const item of groupData?.data ?? []) {
			if (Array.isArray(item.servers)) {
				sets.set(item.group.name, new Set(item.servers));
			}
		}

		return sets;
	}, [groupData?.data]);

	const groupTabs = useMemo(
		() => [
			"All",
			...(groupData?.data?.map((item: ServerGroup) => item.group.name) || []),
		],
		[groupData?.data],
	);
	const {
		down,
		downSpeed,
		filteredServers,
		offlineServers,
		onlineServers,
		totalServers,
		up,
		upSpeed,
	} = useMemo(() => {
		if (!nezhaWsData) {
			return {
				down: 0,
				downSpeed: 0,
				filteredServers: EMPTY_SERVER_LIST,
				offlineServers: 0,
				onlineServers: 0,
				totalServers: 0,
				up: 0,
				upSpeed: 0,
			};
		}

		const currentGroupServerIds = groupServerIdSets.get(currentGroup);
		const groupFilteredServers: PreparedServer[] = [];
		const overview = {
			down: 0,
			downSpeed: 0,
			offlineServers: 0,
			onlineServers: 0,
			up: 0,
			upSpeed: 0,
		};

		for (const server of nezhaWsData.servers) {
			if (currentGroup !== "All" && !currentGroupServerIds?.has(server.id)) {
				continue;
			}

			const online = isServerOnline(nezhaWsData.now, server);

			groupFilteredServers.push({
				online,
				server,
			});

			if (!online) {
				overview.offlineServers += 1;
				continue;
			}

			overview.onlineServers += 1;
			overview.up += server.state?.net_out_transfer ?? 0;
			overview.down += server.state?.net_in_transfer ?? 0;
			overview.upSpeed += server.state?.net_out_speed ?? 0;
			overview.downSpeed += server.state?.net_in_speed ?? 0;
		}

		const statusFilteredServers =
			status === "all"
				? groupFilteredServers
				: groupFilteredServers.filter((item) =>
						status === "online" ? item.online : !item.online,
					);

		if (sortType === "default") {
			const onlineServers: NezhaServer[] = [];
			const offlineServers: NezhaServer[] = [];

			for (const item of statusFilteredServers) {
				if (item.online) {
					onlineServers.push(item.server);
				} else {
					offlineServers.push(item.server);
				}
			}

			return {
				...overview,
				filteredServers: [...onlineServers, ...offlineServers],
				totalServers: groupFilteredServers.length,
			};
		}

		const sortedServers = [...statusFilteredServers].sort((a, b) => {
			if (sortType !== "name") {
				if (!a.online && b.online) return 1;
				if (a.online && !b.online) return -1;
				if (!a.online && !b.online) {
					return 0;
				}
			}

			let comparison = 0;

			switch (sortType) {
				case "name":
					comparison = a.server.name.localeCompare(b.server.name);
					break;
				case "uptime":
					comparison =
						(a.server.state?.uptime ?? 0) - (b.server.state?.uptime ?? 0);
					break;
				case "system":
					comparison = (a.server.host?.platform ?? "").localeCompare(
						b.server.host?.platform ?? "",
					);
					break;
				case "cpu":
					comparison = (a.server.state?.cpu ?? 0) - (b.server.state?.cpu ?? 0);
					break;
				case "mem":
					comparison =
						getUsagePercent(
							a.server.state?.mem_used,
							a.server.host?.mem_total,
						) -
						getUsagePercent(b.server.state?.mem_used, b.server.host?.mem_total);
					break;
				case "disk":
					comparison =
						getUsagePercent(
							a.server.state?.disk_used,
							a.server.host?.disk_total,
						) -
						getUsagePercent(
							b.server.state?.disk_used,
							b.server.host?.disk_total,
						);
					break;
				case "up":
					comparison =
						(a.server.state?.net_out_speed ?? 0) -
						(b.server.state?.net_out_speed ?? 0);
					break;
				case "down":
					comparison =
						(a.server.state?.net_in_speed ?? 0) -
						(b.server.state?.net_in_speed ?? 0);
					break;
				case "up total":
					comparison =
						(a.server.state?.net_out_transfer ?? 0) -
						(b.server.state?.net_out_transfer ?? 0);
					break;
				case "down total":
					comparison =
						(a.server.state?.net_in_transfer ?? 0) -
						(b.server.state?.net_in_transfer ?? 0);
					break;
				default:
					comparison = 0;
			}

			return sortOrder === "asc" ? comparison : -comparison;
		});

		return {
			...overview,
			filteredServers: sortedServers.map((item) => item.server),
			totalServers: groupFilteredServers.length,
		};
	}, [
		currentGroup,
		groupServerIdSets,
		nezhaWsData,
		sortOrder,
		sortType,
		status,
	]);

	const groupServers = useMemo(
		() =>
			(nezhaWsData?.servers ?? EMPTY_SERVER_LIST).filter(
				(server) =>
					currentGroup === "All" ||
					groupServerIdSets.get(currentGroup)?.has(server.id),
			),
		[nezhaWsData?.servers, currentGroup, groupServerIdSets],
	);
	const memberKey = fleetMemberKey(
		currentGroup,
		currentGroup === "All"
			? groupServers.map((server) => server.id)
			: [...(groupServerIdSets.get(currentGroup) ?? [])],
	);
	const memberIds = useMemo(
		() => (JSON.parse(memberKey) as [string, number[]])[1],
		[memberKey],
	);
	const traces = useMemo(
		() =>
			highDensity
				? new Map<number, NodeSample[]>()
				: buildNodeTraces(messageHistory, memberIds),
		[highDensity, messageHistory, memberIds],
	);
	const display = useMemo(
		() => ({ highDensity, traces }),
		[highDensity, traces],
	);

	useEffect(() => {
		const query = window.matchMedia("(prefers-reduced-motion: reduce)");
		const change = () => setReducedMotion(query.matches);
		query.addEventListener("change", change);
		return () => query.removeEventListener("change", change);
	}, []);
	useEffect(() => {
		if (!nezhaWsData) return;
		document.documentElement.dataset.fleet = nezhaWsData.servers.some(
			(server) => !isServerOnline(nezhaWsData.now, server),
		)
			? "down"
			: "ok";
		return () => {
			delete document.documentElement.dataset.fleet;
		};
	}, [nezhaWsData]);
	useEffect(() => {
		const grid = gridRef.current;
		if (
			resolvedInline !== "0" ||
			!hasWsData ||
			!grid ||
			highDensity ||
			reducedMotion ||
			!window.matchMedia("(hover: hover) and (pointer: fine)").matches
		)
			return;
		let frame = 0;
		let latest: PointerEvent | null = null;
		const move = (event: PointerEvent) => {
			if (event.pointerType !== "mouse") return;
			latest = event;
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				const event = latest;
				const tile =
					event?.target instanceof Element
						? event.target.closest<HTMLElement>(".spot")
						: null;
				if (!event || !tile) return;
				const rect = tile.getBoundingClientRect();
				tile.style.setProperty("--mx", `${event.clientX - rect.left}px`);
				tile.style.setProperty("--my", `${event.clientY - rect.top}px`);
			});
		};
		grid.addEventListener("pointermove", move);
		return () => {
			grid.removeEventListener("pointermove", move);
			if (frame) cancelAnimationFrame(frame);
		};
	}, [highDensity, reducedMotion, resolvedInline, hasWsData]);
	useEffect(() => {
		if (!hasWsData || entered.current) return;
		entered.current = true;
		const grid = gridRef.current;
		if (!grid || motion !== "live") return;
		grid.dataset.enter = "true";
		const timer = window.setTimeout(() => {
			delete grid.dataset.enter;
		}, 700);
		return () => {
			window.clearTimeout(timer);
			delete grid.dataset.enter;
		};
	}, [hasWsData, motion]);

	const currentBackendError = backendError || groupError || serviceError;

	if (!nezhaWsData && currentBackendError) {
		return (
			<BackendErrorState error={currentBackendError} onRetry={reconnect} />
		);
	}

	if (!connected && !lastData) {
		return <ServerPageSkeleton label={t("info.websocketConnecting")} />;
	}

	if (!nezhaWsData) {
		return (
			<div className="flex flex-col items-center justify-center py-16">
				<p className="text-[13px] text-muted-foreground">
					{t("info.processing")}
				</p>
			</div>
		);
	}

	const hasServers = nezhaWsData.servers.length > 0;
	const activeView: ServerView =
		showMap === "1" ? "map" : resolvedInline === "1" ? "list" : "card";
	const viewOptions: {
		value: ServerView;
		label: string;
		icon: typeof MapIcon;
	}[] = [
		{ value: "list", label: t("view.list"), icon: ListBulletIcon },
		{ value: "card", label: t("view.card"), icon: Squares2X2Icon },
		{ value: "map", label: t("view.map"), icon: MapIcon },
	];
	const statusOptions = [
		{ value: "all", label: t("filter.all") },
		{ value: "online", label: t("filter.online") },
		{ value: "offline", label: t("filter.offline") },
	] as const;

	return (
		<HomeDisplayContext.Provider value={display}>
			<div
				className="hm-home flex w-full min-w-0 flex-col gap-4"
				data-density={highDensity ? "high" : "normal"}
				data-motion={motion}
			>
				<DrawingDefs />
				{!connected && (
					<div className="hm-disconnected-line" role="status">
						{t("v2Home.trace.stale")}
					</div>
				)}
				<ServerOverview
					total={totalServers}
					online={onlineServers}
					offline={offlineServers}
					up={up}
					down={down}
					upSpeed={upSpeed}
					downSpeed={downSpeed}
					groupServerIds={currentGroup === "All" ? undefined : memberIds}
					servers={groupServers}
					now={nezhaWsData.now}
				/>
				<AttentionStrip servers={groupServers} now={nezhaWsData.now} />
				<div
					hidden={!hasServers}
					className="server-overview-controls hm-controls surface glass"
				>
					<div className="hm-control-groups flex min-w-0 items-center">
						<GroupSwitch
							tabs={groupTabs}
							currentTab={currentGroup}
							setCurrentTab={handleTagChange}
						/>
					</div>
					<div className="hm-control-actions flex min-w-0 flex-wrap items-center gap-2">
						<fieldset
							aria-label={t("filter.status")}
							className={cn("segmented", {
								"bg-card/80": customBackgroundImage,
							})}
						>
							{statusOptions.map((option) => (
								<button
									key={option.value}
									type="button"
									aria-pressed={status === option.value}
									onClick={() => setStatus(option.value)}
								>
									{option.value !== "all" && (
										<span className="status-dot" data-status={option.value} />
									)}
									{option.label}
								</button>
							))}
						</fieldset>
						<div
							className={cn(
								"flex h-9 shrink-0 items-center rounded-md border border-border bg-card text-[13px]",
								{ "bg-card/80": customBackgroundImage },
							)}
						>
							<button
								type="button"
								aria-label="Toggle sort direction"
								onClick={() =>
									setSortOrder(sortOrder === "asc" ? "desc" : "asc")
								}
								disabled={sortType === "default"}
								className={cn(
									"flex h-full items-center gap-1.5 rounded-l-md px-2.5 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
									sortType !== "default" && "text-primary",
								)}
							>
								{sortOrder === "asc" && sortType !== "default" ? (
									<ArrowUpIcon className="size-3.5 shrink-0" />
								) : sortOrder === "desc" && sortType !== "default" ? (
									<ArrowDownIcon className="size-3.5 shrink-0" />
								) : (
									<ArrowsUpDownIcon className="size-3.5 shrink-0" />
								)}
								<span className="hidden sm:inline">{t("sort.label")}</span>
							</button>
							<span aria-hidden="true" className="h-4 w-px bg-border" />
							<span className="relative inline-flex h-full items-center px-2.5">
								<span
									className="pointer-events-none select-none whitespace-nowrap font-medium"
									aria-hidden
								>
									{t(`sort.types.${sortType.replace(/ /g, "_")}`)}
								</span>
								<select
									aria-label="Sort metric"
									value={sortType}
									onChange={(e) => {
										const val = e.target.value as typeof sortType;
										setSortType(val);
										if (val === "default") setSortOrder("desc");
									}}
									className="absolute inset-0 cursor-pointer appearance-none bg-transparent text-transparent outline-none [&>option]:text-foreground"
								>
									{SORT_TYPES.map((type) => (
										<option key={type} value={type} className="bg-popover">
											{t(`sort.types.${type.replace(/ /g, "_")}`)}
										</option>
									))}
								</select>
							</span>
						</div>
						<div className="ml-auto flex items-center gap-2">
							{hasServices && (
								<button
									type="button"
									aria-label={t("serviceTracker.toggleLabel", {
										count: serviceCount,
									})}
									aria-pressed={showServices === "1"}
									onClick={toggleServices}
									className={cn(
										"flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground",
										showServices === "1" &&
											"border-primary/40 bg-primary/10 text-primary hover:text-primary",
									)}
								>
									<ChartBarSquareIcon className="size-4" />
									<span className="hidden sm:inline">
										{t("serviceTracker.toggle")}
									</span>
									<span className="tabular-nums">{serviceCount}</span>
								</button>
							)}
							<fieldset
								aria-label={t("view.label")}
								className={cn("segmented", {
									"bg-card/80": customBackgroundImage,
								})}
							>
								{viewOptions.map(({ value, label, icon: Icon }) => (
									<button
										key={value}
										type="button"
										aria-label={label}
										title={label}
										aria-pressed={activeView === value}
										onClick={() => selectView(value)}
									>
										<Icon className="size-4" />
										<span className="hidden md:inline">{label}</span>
									</button>
								))}
							</fieldset>
						</div>
					</div>
				</div>
				{hasServers && showMap === "1" && (
					<GlobalMap now={nezhaWsData.now} serverList={nezhaWsData.servers} />
				)}
				{hasServers && hasServices && showServices === "1" && (
					<ServiceTracker serverList={filteredServers} />
				)}
				{!hasServers ? (
					<ServerEmptyState />
				) : filteredServers.length > 0 ? (
					resolvedInline === "1" ? (
						<section
							aria-label={t("serverList.count", {
								count: filteredServers.length,
							})}
							className={cn("server-inline-list hm-node-list", {
								"bg-card/85": customBackgroundImage,
							})}
						>
							<ServerListHeader />
							<DenseRowProvider enabled={highDensity}>
								<div className="hm-node-rows">
									{filteredServers.map((serverInfo) => (
										<ServerCardInline
											key={serverInfo.id}
											now={nezhaWsData.now}
											serverInfo={serverInfo}
										/>
									))}
								</div>
							</DenseRowProvider>
						</section>
					) : (
						<section ref={gridRef} className="server-card-list hm-node-grid">
							{filteredServers.map((serverInfo) => (
								<ServerCard
									key={serverInfo.id}
									now={nezhaWsData.now}
									serverInfo={serverInfo}
								/>
							))}
						</section>
					)
				) : (
					<div className="hm-filter-empty">
						<ServerEmptyState filtered />
						<button
							type="button"
							className="hm-clear-filters"
							onClick={() => {
								setStatus("all");
								handleTagChange("All");
							}}
						>
							{t("v2Home.clearFilters")}
						</button>
					</div>
				)}
			</div>
		</HomeDisplayContext.Provider>
	);
}
