"use client";

import {
	ArrowPathIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	MagnifyingGlassMinusIcon,
	MagnifyingGlassPlusIcon,
	SignalIcon,
} from "@heroicons/react/20/solid";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
	Area,
	CartesianGrid,
	ComposedChart,
	Line,
	ReferenceArea,
	ReferenceDot,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveIndicator } from "@/hooks/use-active-indicator";
import {
	buildAdaptiveTimeTicks,
	buildDelayChartScale,
	buildOutageIntervals,
	buildTimeDomain,
	compactMonitorPoints,
	formatAdaptiveTimeTick,
	formatDuration,
	periodDurationMs,
	selectAnomalyMonitorPoints,
	type TimeDomain,
	zoomTimeDomain,
} from "@/lib/network-chart";
import {
	fetchLoginUser,
	fetchMonitor,
	fetchMonitorLive,
	type MonitorPeriod,
} from "@/lib/nezha-api";
import { cn, formatTime } from "@/lib/utils";
import type {
	MonitorChartPoint,
	NezhaMonitor,
	ServerMonitorChart,
	ServiceLatestResult,
} from "@/types/nezha-api";
import NetworkChartLoading from "./NetworkChartLoading";

const MIN_PERIOD_LOADING_MS = 350;
const LIVE_POLL_MIN_MS = 1000;
const LIVE_POLL_MAX_MS = 10000;
const HISTORY_REFRESH_MS = 60000;
const DESKTOP_POINT_LIMIT = 1200;
const MOBILE_POINT_LIMIT = 600;
const DESKTOP_POINTS_PER_PIXEL = 0.75;
const MOBILE_POINTS_PER_PIXEL = 0.65;
const LIVE_POINT_LIMIT_PER_MONITOR = 8192;
const DESKTOP_CHART_LEFT_GUTTER = 68;
const MOBILE_CHART_LEFT_GUTTER = 56;
const CHART_RIGHT_GUTTER = 12;

type HoveredMonitorPoint = {
	point: MonitorChartPoint;
	x: number;
	y: number;
};

type PinchGesture = {
	distance: number;
	domain: TimeDomain;
	anchor: number;
};

const errorLabel = (
	code: number | undefined,
	translate: (key: string, fallback: string) => string,
) => {
	switch (code) {
		case 1:
			return translate("monitor.timeout", "连接超时");
		case 2:
			return translate("monitor.connectionRefused", "连接被拒绝");
		case 3:
			return translate("monitor.dnsError", "DNS 解析失败");
		case 4:
			return translate("monitor.unreachable", "网络不可达");
		case 5:
			return translate("monitor.invalidTarget", "目标地址无效");
		default:
			return translate("monitor.failed", "连接失败");
	}
};

const isPointFailed = (point: MonitorChartPoint) =>
	(point.status ??
		(point.avg_delay === null || point.avg_delay === 0 ? 0 : 1)) === 0;

export const findClosestMonitorPoint = (
	points: MonitorChartPoint[],
	timestamp: number,
) => {
	if (points.length === 0) return undefined;

	let low = 0;
	let high = points.length - 1;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		if (points[middle].created_at < timestamp) low = middle + 1;
		else high = middle;
	}

	const after = points[low];
	const before = points[Math.max(0, low - 1)];
	return Math.abs(before.created_at - timestamp) <=
		Math.abs(after.created_at - timestamp)
		? before
		: after;
};

export function NetworkChart({
	server_id,
	show,
}: {
	server_id: number;
	show: boolean;
}) {
	const { t } = useTranslation();
	const [period, setPeriod] = React.useState<MonitorPeriod>("6h");
	const [liveResults, setLiveResults] = React.useState<ServiceLatestResult[]>(
		[],
	);
	const [livePollMs, setLivePollMs] = React.useState(5000);
	const lastSeenByServerRef = React.useRef<Record<number, number>>({});
	const { data: userData, isError: isLoginError } = useQuery({
		queryKey: ["login-user"],
		queryFn: () => fetchLoginUser(),
		refetchOnMount: false,
		refetchOnWindowFocus: true,
		refetchIntervalInBackground: true,
		refetchInterval: 30000,
		retry: 0,
	});
	const isLogin = isLoginError
		? false
		: userData
			? Boolean(userData.data?.id && document.cookie)
			: false;

	React.useEffect(() => {
		if (!isLogin && period !== "1d" && period !== "6h") setPeriod("6h");
	}, [isLogin, period]);

	const { data: monitorData, isPlaceholderData } = useQuery({
		queryKey: ["monitor", server_id, period],
		queryFn: () => fetchMonitor(server_id, period),
		enabled: show,
		placeholderData: keepPreviousData,
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		refetchIntervalInBackground: true,
		refetchInterval: HISTORY_REFRESH_MS,
	});
	const { data: liveData } = useQuery({
		queryKey: ["monitor-live", server_id],
		queryFn: () =>
			fetchMonitorLive(server_id, lastSeenByServerRef.current[server_id] ?? 0),
		enabled: show,
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		refetchIntervalInBackground: true,
		refetchInterval: livePollMs,
	});

	React.useEffect(() => {
		if (!liveData?.data) return;
		const requestedInterval = Math.floor(liveData.data.min_duration_ms / 2);
		setLivePollMs(
			Math.max(LIVE_POLL_MIN_MS, Math.min(LIVE_POLL_MAX_MS, requestedInterval)),
		);
		if (!liveData.data.results?.length) return;
		lastSeenByServerRef.current[server_id] = Math.max(
			lastSeenByServerRef.current[server_id] ?? 0,
			...liveData.data.results.map((item) => item.created_at),
		);
		setLiveResults((previous) =>
			mergeLiveResults(previous, liveData.data.results),
		);
	}, [liveData, server_id]);

	if (!monitorData) return <NetworkChartLoading />;
	if (monitorData.success && !monitorData.data) {
		return (
			<div className="space-y-3">
				<p className="py-4 text-center text-sm text-muted-foreground">
					{t("monitor.noData")}
				</p>
				<NetworkChartLoading />
			</div>
		);
	}

	const mergedMonitorData = mergeMonitorData(
		monitorData.data,
		liveResults.filter((item) => item.server_id === server_id),
		period,
	);
	const chartData = transformData(mergedMonitorData);
	const monitorInfoByName = new Map(
		mergedMonitorData.map((item) => [
			item.monitor_name,
			{ id: item.monitor_id, displayIndex: item.display_index },
		]),
	);
	const chartDataKey = Object.keys(chartData)
		.filter((key) => chartData[key].length > 0)
		.sort((a, b) => {
			const aInfo = monitorInfoByName.get(a);
			const bInfo = monitorInfoByName.get(b);
			const indexDiff = (bInfo?.displayIndex ?? 0) - (aInfo?.displayIndex ?? 0);
			return indexDiff || (aInfo?.id ?? 0) - (bInfo?.id ?? 0);
		});
	const chartConfig = {
		avg_delay: { label: t("monitor.avgDelay") },
	} satisfies ChartConfig;

	return (
		<NetworkChartClient
			chartDataKey={chartDataKey}
			chartConfig={chartConfig}
			chartData={chartData}
			serverName={mergedMonitorData[0]?.server_name ?? ""}
			isPeriodLoading={isPlaceholderData}
			period={period}
			onPeriodChange={setPeriod}
			isLogin={isLogin}
		/>
	);
}

export const NetworkChartClient = React.memo(function NetworkChartClient({
	chartDataKey,
	chartConfig,
	chartData,
	serverName,
	isPeriodLoading,
	period,
	onPeriodChange,
	isLogin,
}: {
	chartDataKey: string[];
	chartConfig: ChartConfig;
	chartData: ServerMonitorChart;
	serverName: string;
	formattedData?: unknown[];
	isPeriodLoading: boolean;
	period: MonitorPeriod;
	onPeriodChange: (period: MonitorPeriod) => void;
	isLogin: boolean;
}) {
	const { t } = useTranslation();
	const [selectedMonitor, setSelectedMonitor] = React.useState(
		chartDataKey[0] ?? "",
	);
	const [showPeriodLoading, setShowPeriodLoading] = React.useState(false);
	const [isMobile, setIsMobile] = React.useState(false);
	const [chartPixelWidth, setChartPixelWidth] = React.useState(0);
	const [viewDomain, setViewDomain] = React.useState<TimeDomain | null>(null);
	const [hoveredPoint, setHoveredPoint] =
		React.useState<HoveredMonitorPoint | null>(null);
	const loadingStartedAtRef = React.useRef<number | null>(null);
	const monitorTrackRef = React.useRef<HTMLDivElement | null>(null);
	const chartViewportRef = React.useRef<HTMLDivElement | null>(null);
	const interactionOverlayRef = React.useRef<HTMLDivElement | null>(null);
	const activeTouchPointersRef = React.useRef(
		new Map<number, { x: number; y: number }>(),
	);
	const pinchGestureRef = React.useRef<PinchGesture | null>(null);
	const hoverFrameRef = React.useRef<number | null>(null);
	const pendingHoverRef = React.useRef<{ x: number; y: number } | null>(null);
	const monitorButtonRefs = React.useRef<
		Record<string, HTMLButtonElement | null>
	>({});
	const timeRangeOptions = React.useMemo<
		{ value: MonitorPeriod; label: string }[]
	>(
		() => [
			{ value: "6h", label: t("monitor.period6h", "6 小时") },
			{ value: "1d", label: t("monitor.period1d", "1 天") },
			{ value: "7d", label: t("monitor.period7d", "7 天") },
			{ value: "30d", label: t("monitor.period30d", "30 天") },
		],
		[t],
	);
	const timeRangeValues = React.useMemo(
		() => timeRangeOptions.map((option) => option.value),
		[timeRangeOptions],
	);
	const { containerRef, enableIndicatorAnimation, indicator, setItemRef } =
		useActiveIndicator(timeRangeValues, period);

	React.useEffect(() => {
		const media = window.matchMedia("(max-width: 640px)");
		const update = () => setIsMobile(media.matches);
		update();
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);
	React.useEffect(() => {
		if (!chartDataKey.includes(selectedMonitor)) {
			setSelectedMonitor(chartDataKey[0] ?? "");
		}
	}, [chartDataKey, selectedMonitor]);
	React.useEffect(() => {
		const track = monitorTrackRef.current;
		if (!track) return;
		const onWheel = (event: WheelEvent) => {
			if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
			if (track.scrollWidth <= track.clientWidth) return;
			event.preventDefault();
			event.stopPropagation();
			track.scrollBy({ left: event.deltaY, behavior: "auto" });
		};
		track.addEventListener("wheel", onWheel, { passive: false });
		return () => track.removeEventListener("wheel", onWheel);
	}, []);
	React.useEffect(() => {
		let timeoutId: number | undefined;
		if (isPeriodLoading) {
			loadingStartedAtRef.current = Date.now();
			setShowPeriodLoading(true);
			return;
		}
		const startedAt = loadingStartedAtRef.current;
		if (startedAt === null) {
			setShowPeriodLoading(false);
			return;
		}
		timeoutId = window.setTimeout(
			() => {
				setShowPeriodLoading(false);
				loadingStartedAtRef.current = null;
			},
			Math.max(0, MIN_PERIOD_LOADING_MS - (Date.now() - startedAt)),
		);
		return () => window.clearTimeout(timeoutId);
	}, [isPeriodLoading]);

	const selectedPoints = React.useMemo(
		() => chartData[selectedMonitor] ?? [],
		[chartData, selectedMonitor],
	);
	const domainEnd = React.useMemo(
		() =>
			selectedPoints.length
				? selectedPoints[selectedPoints.length - 1].created_at
				: Date.now(),
		[selectedPoints],
	);
	const fullTimeDomain = React.useMemo(
		() => buildTimeDomain(period, domainEnd),
		[period, domainEnd],
	);
	// Keep the selected domain anchored to the newest stored probe. If older
	// history is absent, the empty left side is a truthful storage gap rather
	// than a cropped 6h/1d timeline.
	const periodPoints = React.useMemo(
		() =>
			selectedPoints.filter(
				(point) =>
					point.created_at >= fullTimeDomain[0] &&
					point.created_at <= fullTimeDomain[1],
			),
		[selectedPoints, fullTimeDomain],
	);
	const availableHistoryMs = React.useMemo(() => {
		if (periodPoints.length < 2) return 0;
		return (
			periodPoints[periodPoints.length - 1].created_at -
			periodPoints[0].created_at
		);
	}, [periodPoints]);
	const hasIncompleteHistory =
		periodPoints.length > 0 &&
		availableHistoryMs < periodDurationMs(period) * 0.99;
	const timeDomain = viewDomain ?? fullTimeDomain;
	const timeTicks = React.useMemo(
		() => buildAdaptiveTimeTicks(timeDomain, isMobile ? 4 : 6),
		[timeDomain, isMobile],
	);
	const visiblePoints = React.useMemo(
		() =>
			selectedPoints.filter(
				(point) =>
					point.created_at >= timeDomain[0] &&
					point.created_at <= timeDomain[1],
			),
		[selectedPoints, timeDomain],
	);
	const chartPointLimit = React.useMemo(() => {
		if (chartPixelWidth <= 0)
			return isMobile ? MOBILE_POINT_LIMIT : DESKTOP_POINT_LIMIT;
		const leftGutter = isMobile
			? MOBILE_CHART_LEFT_GUTTER
			: DESKTOP_CHART_LEFT_GUTTER;
		const plotWidth = Math.max(
			1,
			chartPixelWidth - leftGutter - CHART_RIGHT_GUTTER,
		);
		const limit = isMobile ? MOBILE_POINT_LIMIT : DESKTOP_POINT_LIMIT;
		const density = isMobile
			? MOBILE_POINTS_PER_PIXEL
			: DESKTOP_POINTS_PER_PIXEL;
		return Math.min(limit, Math.max(120, Math.floor(plotWidth * density)));
	}, [chartPixelWidth, isMobile]);
	const chartPoints = React.useMemo(
		() => compactMonitorPoints(visiblePoints, chartPointLimit),
		[visiblePoints, chartPointLimit],
	);
	const delayScale = React.useMemo(
		() => buildDelayChartScale(visiblePoints),
		[visiblePoints],
	);
	const trendPoints = React.useMemo(
		() =>
			chartPoints
				.filter(
					(point) =>
						isPointFailed(point) ||
						point.avg_delay === null ||
						point.avg_delay === undefined ||
						point.avg_delay <= delayScale.maximum,
				)
				.map((point) => ({ ...point, trend_delay: point.avg_delay })),
		[chartPoints, delayScale.maximum],
	);
	const anomalyPoints = React.useMemo(
		() => selectAnomalyMonitorPoints(visiblePoints, delayScale.maximum),
		[delayScale.maximum, visiblePoints],
	);
	const outages = React.useMemo(
		() => buildOutageIntervals(visiblePoints),
		[visiblePoints],
	);
	const recentOutages = React.useMemo(
		() => [...outages].reverse().slice(0, 8),
		[outages],
	);
	const selectedIndex = Math.max(0, chartDataKey.indexOf(selectedMonitor));
	const selectedColor = `hsl(var(--chart-${(selectedIndex % 10) + 1}))`;
	const latestPoint = selectedPoints[selectedPoints.length - 1];
	const currentFailed = latestPoint ? isPointFailed(latestPoint) : false;
	const activeOutage = outages.find((outage) => !outage.recovered);
	const visibleSpan = timeDomain[1] - timeDomain[0];
	const minimumVisibleOutage = visibleSpan * (isMobile ? 0.012 : 0.006);
	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;
	const formatTick = (value: number) =>
		formatAdaptiveTimeTick(value, visibleSpan);
	const zoomChart = React.useCallback(
		(factor: number, anchor?: number) => {
			setViewDomain((current) =>
				zoomTimeDomain(
					current ?? fullTimeDomain,
					fullTimeDomain,
					factor,
					anchor,
					Math.max(60_000, periodDurationMs(period) / 720),
				),
			);
		},
		[fullTimeDomain, period],
	);
	const timeAtClientX = React.useCallback(
		(clientX: number) => {
			const viewport = chartViewportRef.current;
			if (!viewport) return (timeDomain[0] + timeDomain[1]) / 2;
			const rect = viewport.getBoundingClientRect();
			const leftGutter = isMobile
				? MOBILE_CHART_LEFT_GUTTER
				: DESKTOP_CHART_LEFT_GUTTER;
			const plotWidth = Math.max(
				1,
				rect.width - leftGutter - CHART_RIGHT_GUTTER,
			);
			const ratio = Math.min(
				1,
				Math.max(0, (clientX - rect.left - leftGutter) / plotWidth),
			);
			return timeDomain[0] + visibleSpan * ratio;
		},
		[isMobile, timeDomain, visibleSpan],
	);
	const updateHoveredPoint = React.useCallback(
		(clientX: number, clientY: number) => {
			const viewport = chartViewportRef.current;
			if (!viewport) return;
			const point = findClosestMonitorPoint(
				visiblePoints,
				timeAtClientX(clientX),
			);
			if (!point) return;
			const rect = viewport.getBoundingClientRect();
			setHoveredPoint({
				point,
				x: Math.max(92, Math.min(rect.width - 92, clientX - rect.left)),
				y: Math.max(68, clientY - rect.top),
			});
		},
		[timeAtClientX, visiblePoints],
	);
	const queueHoveredPoint = React.useCallback(
		(clientX: number, clientY: number) => {
			pendingHoverRef.current = { x: clientX, y: clientY };
			if (hoverFrameRef.current !== null) return;
			hoverFrameRef.current = window.requestAnimationFrame(() => {
				hoverFrameRef.current = null;
				const pending = pendingHoverRef.current;
				if (!pending) return;
				pendingHoverRef.current = null;
				updateHoveredPoint(pending.x, pending.y);
			});
		},
		[updateHoveredPoint],
	);
	const clearHoveredPoint = React.useCallback(() => {
		pendingHoverRef.current = null;
		if (hoverFrameRef.current !== null) {
			window.cancelAnimationFrame(hoverFrameRef.current);
			hoverFrameRef.current = null;
		}
		setHoveredPoint(null);
	}, []);
	const updatePinchGesture = React.useCallback(() => {
		const pointers = [...activeTouchPointersRef.current.values()];
		if (pointers.length < 2) return;
		const [first, second] = pointers;
		const distance = Math.hypot(second.x - first.x, second.y - first.y);
		if (distance === 0) return;
		if (!pinchGestureRef.current) {
			pinchGestureRef.current = {
				distance,
				domain: timeDomain,
				anchor: timeAtClientX((first.x + second.x) / 2),
			};
			return;
		}
		const pinch = pinchGestureRef.current;
		setViewDomain(
			zoomTimeDomain(
				pinch.domain,
				fullTimeDomain,
				pinch.distance / distance,
				pinch.anchor,
				Math.max(60_000, periodDurationMs(period) / 720),
			),
		);
	}, [fullTimeDomain, period, timeAtClientX, timeDomain]);
	const handleChartPointerDown = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (event.pointerType !== "touch") return;
			event.currentTarget.setPointerCapture(event.pointerId);
			activeTouchPointersRef.current.set(event.pointerId, {
				x: event.clientX,
				y: event.clientY,
			});
			if (activeTouchPointersRef.current.size < 2)
				pinchGestureRef.current = null;
			if (activeTouchPointersRef.current.size === 1)
				queueHoveredPoint(event.clientX, event.clientY);
			else clearHoveredPoint();
			updatePinchGesture();
		},
		[clearHoveredPoint, queueHoveredPoint, updatePinchGesture],
	);
	const handleChartPointerMove = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (event.pointerType !== "touch") {
				queueHoveredPoint(event.clientX, event.clientY);
				return;
			}
			if (!activeTouchPointersRef.current.has(event.pointerId)) return;
			activeTouchPointersRef.current.set(event.pointerId, {
				x: event.clientX,
				y: event.clientY,
			});
			if (activeTouchPointersRef.current.size < 2) {
				queueHoveredPoint(event.clientX, event.clientY);
				return;
			}
			event.preventDefault();
			clearHoveredPoint();
			updatePinchGesture();
		},
		[clearHoveredPoint, queueHoveredPoint, updatePinchGesture],
	);
	const handleChartPointerEnd = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (event.pointerType !== "touch") return;
			activeTouchPointersRef.current.delete(event.pointerId);
			if (activeTouchPointersRef.current.size < 2)
				pinchGestureRef.current = null;
		},
		[],
	);
	React.useEffect(() => {
		const viewport = chartViewportRef.current;
		if (!viewport) return;
		const updateWidth = () => {
			const width = viewport.getBoundingClientRect().width;
			if (width > 0) setChartPixelWidth(width);
		};
		updateWidth();
		const observer = new ResizeObserver(updateWidth);
		observer.observe(viewport);
		return () => observer.disconnect();
	}, []);
	React.useEffect(
		() => () => {
			if (hoverFrameRef.current !== null)
				window.cancelAnimationFrame(hoverFrameRef.current);
		},
		[],
	);
	React.useEffect(() => {
		const onWindowPointerMove = (event: PointerEvent) => {
			if (event.pointerType === "touch") return;
			const overlay = interactionOverlayRef.current;
			if (!overlay) return;
			const rect = overlay.getBoundingClientRect();
			const inside =
				event.clientX >= rect.left &&
				event.clientX <= rect.right &&
				event.clientY >= rect.top &&
				event.clientY <= rect.bottom;
			if (!inside) clearHoveredPoint();
		};
		window.addEventListener("pointermove", onWindowPointerMove, true);
		return () =>
			window.removeEventListener("pointermove", onWindowPointerMove, true);
	}, [clearHoveredPoint]);
	React.useEffect(() => {
		const viewport = chartViewportRef.current;
		if (!viewport) return;
		const onWheel = (event: WheelEvent) => {
			if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
			event.preventDefault();
			event.stopPropagation();
			const rect = viewport.getBoundingClientRect();
			const ratio = rect.width
				? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
				: 0.5;
			const anchor = timeDomain[0] + visibleSpan * ratio;
			zoomChart(event.deltaY < 0 ? 0.72 : 1.38, anchor);
		};
		viewport.addEventListener("wheel", onWheel, { passive: false });
		return () => viewport.removeEventListener("wheel", onWheel);
	}, [timeDomain, visibleSpan, zoomChart]);
	const selectMonitorAt = React.useCallback(
		(index: number) => {
			if (index < 0 || index >= chartDataKey.length) return;
			const monitor = chartDataKey[index];
			setViewDomain(null);
			setSelectedMonitor(monitor);
			window.requestAnimationFrame(() => {
				monitorButtonRefs.current[monitor]?.scrollIntoView?.({
					behavior: "smooth",
					block: "nearest",
					inline: "center",
				});
			});
		},
		[chartDataKey],
	);
	return (
		<div className="flex min-w-0 flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<TooltipProvider delayDuration={120}>
					<div className="scrollbar-hidden flex min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
						<div
							ref={containerRef}
							data-indicator="true"
							className="segmented relative flex items-center"
						>
							{indicator && (
								<div
									aria-hidden="true"
									className="active-indicator-fade-in absolute left-0 top-0 z-0 rounded-[5px] bg-muted dark:bg-foreground/[0.08]"
									style={{
										height: indicator.height,
										transform: `translate(${indicator.x}px, ${indicator.y}px)`,
										transition: indicator.shouldAnimate
											? "transform 0.16s ease-out, width 0.16s ease-out, height 0.16s ease-out"
											: "none",
										width: indicator.width,
									}}
								/>
							)}
							{timeRangeOptions.map((option, index) => {
								const locked =
									!isLogin && option.value !== "1d" && option.value !== "6h";
								const item = (
									<button
										type="button"
										disabled={locked}
										aria-pressed={period === option.value}
										onClick={() => {
											if (period !== option.value) enableIndicatorAnimation();
											setViewDomain(null);
											onPeriodChange(option.value);
										}}
										className="relative z-10"
									>
										{option.label}
									</button>
								);
								return (
									<div key={option.value} ref={setItemRef(index)}>
										{locked ? (
											<Tooltip>
												<TooltipTrigger asChild>{item}</TooltipTrigger>
												<TooltipContent>
													{t("monitor.loginRequired", "请登录后查看")}
												</TooltipContent>
											</Tooltip>
										) : (
											item
										)}
									</div>
								);
							})}
						</div>
					</div>
				</TooltipProvider>
				<span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs text-muted-foreground tabular-nums">
					<span
						className="status-dot"
						data-status="online"
						aria-hidden="true"
					/>
					{t("monitor.trueSamples", "真实采样")} {chartPoints.length} /{" "}
					{visiblePoints.length}
				</span>
				{hasIncompleteHistory && (
					<span
						data-testid="history-coverage"
						className="inline-flex h-7 items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-2.5 text-xs tabular-nums text-warning"
					>
						{t("monitor.historyCoverage", "历史覆盖")}{" "}
						{formatDuration(availableHistoryMs)} /{" "}
						{formatDuration(periodDurationMs(period))}
					</span>
				)}
			</div>

			<Card
				className={cn(
					"network-chart-panel min-w-0 overflow-hidden",
					customBackgroundImage && "bg-card/70",
				)}
			>
				<CardHeader className="min-w-0 space-y-0 p-0">
					<div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
						<div className="flex min-w-0 items-center gap-2.5">
							<SignalIcon
								aria-hidden="true"
								className="size-4 shrink-0 text-muted-foreground"
							/>
							<div className="min-w-0">
								<CardTitle className="truncate text-sm font-semibold leading-5">
									{serverName}
								</CardTitle>
								<CardDescription className="text-xs leading-4">
									{chartDataKey.length} {t("monitor.monitorCount")}
								</CardDescription>
							</div>
						</div>
						<div className="flex shrink-0 items-center gap-1.5">
							<span className="px-1 font-mono text-xs text-muted-foreground tabular-nums">
								{selectedIndex + 1} / {chartDataKey.length}
							</span>
							<button
								type="button"
								aria-label={t("monitor.previousMonitor", "上一个监控任务")}
								disabled={selectedIndex <= 0}
								onClick={() => selectMonitorAt(selectedIndex - 1)}
								className="flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
							>
								<ChevronLeftIcon className="size-4" />
							</button>
							<button
								type="button"
								aria-label={t("monitor.nextMonitor", "下一个监控任务")}
								disabled={selectedIndex >= chartDataKey.length - 1}
								onClick={() => selectMonitorAt(selectedIndex + 1)}
								className="flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
							>
								<ChevronRightIcon className="size-4" />
							</button>
						</div>
					</div>
					<div className="relative w-full min-w-0 border-b border-border">
						<div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-6 bg-gradient-to-r from-card to-transparent" />
						<div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-6 bg-gradient-to-l from-card to-transparent" />
						<div
							ref={monitorTrackRef}
							className="scrollbar-hidden w-full min-w-0 touch-pan-x overflow-x-auto overscroll-contain scroll-smooth px-4 py-3"
							data-testid="monitor-track"
						>
							<fieldset
								className="flex w-max min-w-full snap-x snap-mandatory gap-2 border-0 p-0"
								aria-label={t("monitor.selectMonitor", "选择监控目标")}
							>
								{chartDataKey.map((key, keyIndex) => {
									const points = chartData[key];
									const lastPoint = points[points.length - 1];
									const failed = lastPoint ? isPointFailed(lastPoint) : false;
									const selected = selectedMonitor === key;
									const delays = points
										.filter(
											(point) =>
												!isPointFailed(point) && point.avg_delay !== null,
										)
										.map((point) => point.avg_delay as number);
									return (
										<button
											type="button"
											key={key}
											ref={(node) => {
												monitorButtonRefs.current[key] = node;
											}}
											onClick={() => selectMonitorAt(chartDataKey.indexOf(key))}
											aria-pressed={selected}
											className={cn(
												"relative flex w-[168px] shrink-0 snap-center flex-col gap-1 overflow-hidden rounded-md border px-3 py-2.5 text-left transition-colors duration-150 sm:w-[196px]",
												selected
													? "border-primary/60 bg-primary/[0.06] dark:bg-primary/10"
													: "border-border bg-card hover:bg-muted/60 dark:hover:bg-foreground/[0.03]",
											)}
										>
											<span className="flex items-center justify-between gap-2">
												<span className="flex min-w-0 items-center gap-1.5">
													<span
														aria-hidden="true"
														className="size-2 shrink-0 rounded-[2px]"
														style={{
															backgroundColor: `hsl(var(--chart-${(keyIndex % 10) + 1}))`,
														}}
													/>
													<span className="truncate text-xs font-medium">
														{key}
													</span>
												</span>
												<span
													className="status-dot"
													data-status={failed ? "offline" : "online"}
												/>
											</span>
											<span
												className={cn(
													"text-base font-semibold leading-6 tabular-nums",
													failed && "text-danger",
												)}
											>
												{failed
													? errorLabel(lastPoint.error_code, t)
													: `${(lastPoint?.avg_delay ?? 0).toFixed(2)} ms`}
											</span>
											<span className="truncate text-[11px] text-muted-foreground tabular-nums">
												{delays.length
													? `${t("monitor.min", "最低")} ${Math.min(...delays).toFixed(0)} · ${t("monitor.max", "最高")} ${Math.max(...delays).toFixed(0)} ms`
													: t("monitor.noSuccessfulSample", "暂无成功采样")}
											</span>
										</button>
									);
								})}
							</fieldset>
						</div>
					</div>
				</CardHeader>

				<CardContent className="min-w-0 p-0">
					<div className="px-2 pt-3 pb-3 sm:px-4">
						<div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-2 sm:px-0">
							<div className="flex min-w-0 items-center gap-2.5">
								<span
									className="status-dot"
									data-status={currentFailed ? "offline" : "online"}
									aria-hidden="true"
								/>
								<div className="min-w-0">
									<p className="truncate text-[13px] font-medium">
										{selectedMonitor}
									</p>
									<p
										className={cn(
											"text-xs text-muted-foreground tabular-nums",
											currentFailed && "text-danger",
										)}
									>
										{currentFailed
											? errorLabel(latestPoint?.error_code, t) +
												" · " +
												formatDuration(
													domainEnd - (activeOutage?.start ?? domainEnd),
												)
											: t("monitor.currentNormal", "当前正常")}
									</p>
								</div>
							</div>
							<div className="flex flex-wrap items-center justify-end gap-3 text-xs text-muted-foreground">
								<span className="inline-flex items-center gap-1.5">
									<i
										aria-hidden="true"
										className="h-2.5 w-3 rounded-[2px] border border-danger/40 bg-danger/20"
									/>
									{t("monitor.outagePeriod", "故障时段")}
								</span>
								<span className="inline-flex items-center gap-1.5">
									<i aria-hidden="true" className="h-3 w-0.5 bg-success" />
									{t("monitor.recoveryTime", "恢复时间")}
								</span>
								<div className="segmented">
									<button
										type="button"
										aria-label={t("monitor.zoomIn", "放大时间线")}
										title={t("monitor.zoomIn", "放大时间线")}
										onClick={() => zoomChart(0.5)}
										className="w-8 px-0!"
									>
										<MagnifyingGlassPlusIcon className="size-4" />
									</button>
									<button
										type="button"
										aria-label={t("monitor.zoomOut", "缩小时间线")}
										title={t("monitor.zoomOut", "缩小时间线")}
										onClick={() => zoomChart(2)}
										className="w-8 px-0!"
									>
										<MagnifyingGlassMinusIcon className="size-4" />
									</button>
									<button
										type="button"
										aria-label={t("monitor.resetZoom", "重置时间线")}
										title={t("monitor.resetZoom", "重置时间线")}
										disabled={!viewDomain}
										onClick={() => setViewDomain(null)}
										className="w-8 px-0!"
									>
										<ArrowPathIcon className="size-4" />
									</button>
								</div>
							</div>
						</div>
						<div
							ref={chartViewportRef}
							data-testid="network-chart-viewport"
							className="relative min-w-0 touch-pan-y overflow-hidden"
							title={t(
								"monitor.zoomHint",
								"滚动鼠标滚轮可围绕指针位置缩放时间线",
							)}
						>
							<ChartContainer
								config={chartConfig}
								className={cn(
									"pointer-events-none aspect-auto h-[320px] w-full transition-opacity sm:h-[380px]",
									showPeriodLoading && "opacity-60",
								)}
							>
								<ComposedChart
									data={trendPoints}
									margin={{ top: 10, right: 12, bottom: 8, left: 4 }}
								>
									<CartesianGrid vertical={false} />
									<XAxis
										type="number"
										dataKey="created_at"
										domain={[timeDomain[0], timeDomain[1]]}
										ticks={timeTicks}
										scale="time"
										interval={0}
										tickLine
										tickSize={3}
										axisLine={false}
										tickMargin={9}
										tickFormatter={formatTick}
									/>
									<YAxis
										yAxisId="delay"
										domain={[0, delayScale.maximum]}
										allowDataOverflow
										width={isMobile ? 48 : 60}
										tickLine={false}
										axisLine={false}
										tickFormatter={(value) => `${Number(value).toFixed(0)} ms`}
									/>
									{outages.map((outage) => {
										const actualEnd = outage.end ?? domainEnd;
										const visibleEnd = Math.min(
											domainEnd,
											Math.max(actualEnd, outage.start + minimumVisibleOutage),
										);
										return (
											<React.Fragment key={outage.start}>
												<ReferenceArea
													xAxisId={0}
													yAxisId="delay"
													x1={outage.start}
													x2={visibleEnd}
													fill="hsl(var(--danger))"
													fillOpacity={0.14}
													stroke="hsl(var(--danger))"
													strokeOpacity={0.3}
												/>
												{outage.end !== null && (
													<ReferenceLine
														xAxisId={0}
														yAxisId="delay"
														x={outage.end}
														stroke="hsl(var(--success))"
														strokeWidth={2}
													/>
												)}
											</React.Fragment>
										);
									})}
									<Area
										isAnimationActive={false}
										type="linear"
										dataKey="trend_delay"
										stroke="none"
										fill={selectedColor}
										fillOpacity={0.08}
										connectNulls={false}
										yAxisId="delay"
									/>
									<Line
										isAnimationActive={false}
										type="linear"
										dataKey="trend_delay"
										name={selectedMonitor}
										stroke={selectedColor}
										strokeWidth={2}
										dot={false}
										activeDot={{ r: 5, strokeWidth: 2 }}
										connectNulls={false}
										yAxisId="delay"
									/>
									{anomalyPoints.map((point) => (
										<ReferenceDot
											key={`peak-${point.created_at}`}
											x={point.created_at}
											y={delayScale.maximum * 0.97}
											yAxisId="delay"
											r={2.5}
											fill="hsl(var(--danger))"
											stroke="hsl(var(--danger))"
										/>
									))}
								</ComposedChart>
							</ChartContainer>
							<div
								ref={interactionOverlayRef}
								data-testid="network-chart-interaction-overlay"
								className="absolute inset-y-2 z-10 touch-pan-y"
								style={{
									left: isMobile
										? MOBILE_CHART_LEFT_GUTTER
										: DESKTOP_CHART_LEFT_GUTTER,
									right: CHART_RIGHT_GUTTER,
								}}
								onPointerDown={handleChartPointerDown}
								onPointerMove={handleChartPointerMove}
								onPointerUp={handleChartPointerEnd}
								onPointerCancel={handleChartPointerEnd}
								onMouseLeave={clearHoveredPoint}
								onPointerLeave={(event) => {
									if (event.pointerType !== "touch") clearHoveredPoint();
								}}
							/>
							{hoveredPoint && (
								<div
									data-testid="network-chart-hover-tooltip"
									className="pointer-events-none absolute z-20 min-w-44 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg border border-border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-popover"
									style={{ left: hoveredPoint.x, top: hoveredPoint.y }}
								>
									<div className="mb-1.5 text-[11px] text-muted-foreground tabular-nums">
										{formatTime(hoveredPoint.point.created_at)}
									</div>
									<div className="flex items-center justify-between gap-4">
										<span className="text-muted-foreground">
											{t("monitor.avgDelay", "延迟")}
										</span>
										<span
											className={cn(
												"font-semibold tabular-nums",
												isPointFailed(hoveredPoint.point) && "text-danger",
											)}
										>
											{isPointFailed(hoveredPoint.point)
												? "--"
												: `${Number(hoveredPoint.point.avg_delay).toFixed(2)} ms`}
										</span>
									</div>
									<div className="mt-1 flex items-center justify-between gap-4">
										<span className="text-muted-foreground">
											{t("monitor.status", "状态")}
										</span>
										<span
											className={cn(
												"font-semibold",
												isPointFailed(hoveredPoint.point) && "text-danger",
											)}
										>
											{isPointFailed(hoveredPoint.point)
												? errorLabel(hoveredPoint.point.error_code, t)
												: t("monitor.currentNormal", "正常")}
										</span>
									</div>
									{hoveredPoint.point.packet_loss !== undefined && (
										<div className="mt-1 flex items-center justify-between gap-4">
											<span className="text-muted-foreground">
												{t("monitor.packetLoss", "丢包率")}
											</span>
											<span className="font-semibold tabular-nums">
												{Number(hoveredPoint.point.packet_loss).toFixed(2)}%
											</span>
										</div>
									)}
								</div>
							)}
							{showPeriodLoading && (
								<div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
									<div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/70" />
								</div>
							)}
						</div>
					</div>

					<div className="border-t border-border">
						<div className="flex items-center justify-between gap-2 px-4 py-3">
							<h3 className="text-[13px] font-semibold">
								{t("monitor.outageRecords", "故障记录")}
							</h3>
							<span className="text-xs text-muted-foreground tabular-nums">
								{outages.length} {t("monitor.outageCount", "次")}
							</span>
						</div>
						{recentOutages.length === 0 ? (
							<div className="border-t border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
								{t("monitor.noOutage", "当前时间范围内没有故障")}
							</div>
						) : (
							<ul className="divide-y divide-border border-t border-border">
								{recentOutages.map((outage) => {
									const end = outage.end ?? domainEnd;
									return (
										<li
											key={outage.start}
											className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-3"
										>
											<div className="flex min-w-0 items-start gap-2.5">
												<span
													className="status-dot mt-[5px]"
													data-status={outage.recovered ? "online" : "offline"}
													aria-hidden="true"
												/>
												<div className="min-w-0">
													<p className="text-[13px] font-medium text-danger">
														{errorLabel(outage.errorCode, t)}
													</p>
													<p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
														{formatTime(outage.start)} →{" "}
														{outage.end
															? formatTime(outage.end)
															: t("monitor.notRecovered", "尚未恢复")}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-3 pl-[18px] sm:pl-0">
												<span className="text-xs tabular-nums text-muted-foreground">
													{t("monitor.duration", "持续")}{" "}
													<span className="font-medium text-foreground">
														{formatDuration(end - outage.start)}
													</span>
												</span>
												<span
													className={cn(
														"inline-flex h-5 items-center rounded-[4px] px-1.5 text-xs font-medium",
														outage.recovered
															? "bg-success/12 text-success"
															: "bg-danger/12 text-danger",
													)}
												>
													{outage.recovered
														? t("monitor.recovered", "已恢复")
														: t("monitor.inOutage", "故障中")}
												</span>
											</div>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
});

const transformData = (data: NezhaMonitor[]): ServerMonitorChart => {
	const monitorData: ServerMonitorChart = {};
	for (const item of data) {
		const points = monitorData[item.monitor_name] ?? [];
		for (let index = 0; index < item.created_at.length; index++) {
			const status =
				item.status?.[index] ?? (item.avg_delay[index] === 0 ? 0 : 1);
			points.push({
				created_at: item.created_at[index],
				avg_delay: status === 1 ? item.avg_delay[index] : null,
				packet_loss: item.packet_loss?.[index] ?? (status === 0 ? 100 : 0),
				status,
				error_code: item.error_code?.[index] ?? (status === 0 ? 6 : 0),
			});
		}
		monitorData[item.monitor_name] = points.sort(
			(a, b) => a.created_at - b.created_at,
		);
	}
	return monitorData;
};

export const mergeLiveResults = (
	previous: ServiceLatestResult[],
	incoming: ServiceLatestResult[],
) => {
	const byEvent = new Map<string, ServiceLatestResult>();
	for (const item of [...previous, ...incoming]) {
		byEvent.set(`${item.monitor_id}:${item.created_at}`, item);
	}
	const byMonitor = new Map<number, ServiceLatestResult[]>();
	for (const item of byEvent.values()) {
		const points = byMonitor.get(item.monitor_id) ?? [];
		points.push(item);
		byMonitor.set(item.monitor_id, points);
	}
	const result: ServiceLatestResult[] = [];
	for (const points of byMonitor.values()) {
		points.sort((a, b) => a.created_at - b.created_at);
		result.push(...points.slice(-LIVE_POINT_LIMIT_PER_MONITOR));
	}
	return result.sort(
		(a, b) => a.created_at - b.created_at || a.monitor_id - b.monitor_id,
	);
};

const mergeMonitorData = (
	history: NezhaMonitor[],
	live: ServiceLatestResult[],
	period: MonitorPeriod,
): NezhaMonitor[] => {
	const cutoff = Date.now() - periodDurationMs(period);
	const byId = new Map<number, NezhaMonitor>();
	for (const item of history) {
		byId.set(item.monitor_id, {
			...item,
			created_at: [...item.created_at],
			avg_delay: [...item.avg_delay],
			packet_loss: item.created_at.map(
				(_, index) =>
					item.packet_loss?.[index] ?? (item.status?.[index] === 0 ? 100 : 0),
			),
			status: item.created_at.map(
				(_, index) =>
					item.status?.[index] ?? (item.avg_delay[index] === 0 ? 0 : 1),
			),
			error_code: item.created_at.map(
				(_, index) => item.error_code?.[index] ?? 0,
			),
		});
	}
	for (const event of live) {
		if (event.created_at < cutoff) continue;
		let item = byId.get(event.monitor_id);
		if (!item) {
			item = {
				monitor_id: event.monitor_id,
				monitor_name: event.monitor_name,
				duration: event.duration,
				server_id: event.server_id,
				server_name: event.server_name,
				created_at: [],
				avg_delay: [],
				packet_loss: [],
				status: [],
				error_code: [],
			};
			byId.set(event.monitor_id, item);
		}
		const existing = item.created_at.indexOf(event.created_at);
		const index = existing >= 0 ? existing : item.created_at.length;
		item.created_at[index] = event.created_at;
		item.avg_delay[index] = event.delay;
		item.packet_loss ??= [];
		item.status ??= [];
		item.error_code ??= [];
		item.packet_loss[index] = event.successful ? 0 : 100;
		item.status[index] = event.successful ? 1 : 0;
		item.error_code[index] = event.error_code;
	}
	for (const item of byId.values()) {
		const order = item.created_at
			.map((_, index) => index)
			.sort((a, b) => item.created_at[a] - item.created_at[b]);
		item.created_at = order.map((index) => item.created_at[index]);
		item.avg_delay = order.map((index) => item.avg_delay[index]);
		item.packet_loss = order.map((index) => item.packet_loss?.[index] ?? 0);
		item.status = order.map((index) => item.status?.[index] ?? 1);
		item.error_code = order.map((index) => item.error_code?.[index] ?? 0);
	}
	return [...byId.values()];
};
