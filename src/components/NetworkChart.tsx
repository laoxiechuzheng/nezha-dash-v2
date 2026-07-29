"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
	CartesianGrid,
	ComposedChart,
	Line,
	ReferenceArea,
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
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveIndicator } from "@/hooks/use-active-indicator";
import {
	buildOutageIntervals,
	buildTimeDomain,
	buildTimeTicks,
	compactMonitorPoints,
	formatDuration,
	periodDurationMs,
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
const DESKTOP_POINT_LIMIT = 720;
const MOBILE_POINT_LIMIT = 360;

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
	const loadingStartedAtRef = React.useRef<number | null>(null);
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
	const timeDomain = React.useMemo(
		() => buildTimeDomain(period, domainEnd),
		[period, domainEnd],
	);
	const timeTicks = React.useMemo(
		() => buildTimeTicks(period, domainEnd, isMobile ? 4 : 6),
		[period, domainEnd, isMobile],
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
	const chartPoints = React.useMemo(
		() =>
			compactMonitorPoints(
				visiblePoints,
				isMobile ? MOBILE_POINT_LIMIT : DESKTOP_POINT_LIMIT,
			),
		[visiblePoints, isMobile],
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
	const minimumVisibleOutage =
		periodDurationMs(period) * (isMobile ? 0.012 : 0.006);
	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;
	const formatTick = (value: number) => {
		const date = new Date(value);
		if (period === "7d" || period === "30d") {
			return (
				(date.getMonth() + 1).toString().padStart(2, "0") +
				"-" +
				date.getDate().toString().padStart(2, "0")
			);
		}
		return (
			date.getHours().toString().padStart(2, "0") +
			":" +
			date.getMinutes().toString().padStart(2, "0")
		);
	};

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2 sm:-mt-5 -mt-3">
				<TooltipProvider delayDuration={120}>
					<div
						ref={containerRef}
						className="relative flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border/60 bg-muted p-0.5"
					>
						{indicator && (
							<div
								className="active-indicator-fade-in absolute left-0 top-0 z-10 rounded-full bg-white ring-1 ring-border/60 dark:bg-background"
								style={{
									height: indicator.height,
									transform: `translate(${indicator.x}px, ${indicator.y}px)`,
									transition: indicator.shouldAnimate
										? "transform 0.35s var(--timing), width 0.35s var(--timing), height 0.35s var(--timing)"
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
									onClick={() => {
										if (period !== option.value) enableIndicatorAnimation();
										onPeriodChange(option.value);
									}}
									className={cn(
										"relative z-20 min-h-9 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
										period === option.value
											? "text-foreground"
											: "text-muted-foreground hover:text-foreground",
										locked && "cursor-not-allowed opacity-40 grayscale",
									)}
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
				</TooltipProvider>
				<span className="text-xs text-muted-foreground">
					{t("monitor.trueSamples", "真实采样")} · {chartPoints.length} /{" "}
					{visiblePoints.length}
				</span>
			</div>

			<Card className={cn(customBackgroundImage && "bg-card/70")}>
				<CardHeader className="space-y-0 overflow-hidden rounded-t-lg p-0">
					<div className="flex flex-col gap-1 border-b px-4 py-4 sm:px-6">
						<CardTitle className="text-base">{serverName}</CardTitle>
						<CardDescription className="text-xs">
							{chartDataKey.length} {t("monitor.monitorCount")}
						</CardDescription>
					</div>
					<fieldset
						className="flex snap-x snap-mandatory gap-2 overflow-x-auto p-3 sm:p-4"
						aria-label={t("monitor.selectMonitor", "选择监控目标")}
					>
						{chartDataKey.map((key) => {
							const points = chartData[key];
							const lastPoint = points[points.length - 1];
							const failed = lastPoint ? isPointFailed(lastPoint) : false;
							const delays = points
								.filter(
									(point) => !isPointFailed(point) && point.avg_delay !== null,
								)
								.map((point) => point.avg_delay as number);
							return (
								<button
									type="button"
									key={key}
									onClick={() => setSelectedMonitor(key)}
									aria-pressed={selectedMonitor === key}
									className={cn(
										"min-h-24 min-w-[168px] snap-start rounded-xl border p-3 text-left transition-colors sm:min-w-[190px]",
										selectedMonitor === key
											? "border-primary bg-primary/5 ring-1 ring-primary/25"
											: "border-border bg-muted/20 hover:bg-muted/50",
									)}
								>
									<span className="block truncate text-xs text-muted-foreground">
										{key}
									</span>
									<span
										className={cn(
											"mt-2 block text-lg font-semibold",
											failed && "text-red-500",
										)}
									>
										{failed
											? errorLabel(lastPoint.error_code, t)
											: `${(lastPoint?.avg_delay ?? 0).toFixed(2)} ms`}
									</span>
									<span className="mt-1 block text-[11px] text-muted-foreground">
										{delays.length
											? "最低 " +
												Math.min(...delays).toFixed(0) +
												" · 最高 " +
												Math.max(...delays).toFixed(0) +
												" ms"
											: t("monitor.noSuccessfulSample", "暂无成功采样")}
									</span>
								</button>
							);
						})}
					</fieldset>
				</CardHeader>

				<CardContent className="px-1 pb-5 pt-4 sm:px-4 sm:pt-6">
					<div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-2">
						<div>
							<p className="text-sm font-medium">{selectedMonitor}</p>
							<p className="text-xs text-muted-foreground">
								{currentFailed
									? errorLabel(latestPoint?.error_code, t) +
										" · " +
										formatDuration(
											domainEnd - (activeOutage?.start ?? domainEnd),
										)
									: t("monitor.currentNormal", "当前正常")}
							</p>
						</div>
						<div className="flex items-center gap-3 text-[11px] text-muted-foreground">
							<span className="inline-flex items-center gap-1">
								<i className="size-2 rounded-full bg-red-500" />
								{t("monitor.outagePeriod", "故障时段")}
							</span>
							<span className="inline-flex items-center gap-1">
								<i className="h-3 w-0.5 bg-green-500" />
								{t("monitor.recoveryTime", "恢复时间")}
							</span>
						</div>
					</div>
					<div className="relative">
						<ChartContainer
							config={chartConfig}
							className={cn(
								"aspect-auto h-[320px] w-full transition-opacity sm:h-[380px]",
								showPeriodLoading && "opacity-60",
							)}
						>
							<ComposedChart
								data={chartPoints}
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
									domain={[0, "auto"]}
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
												fill="#ef4444"
												fillOpacity={0.16}
												stroke="#ef4444"
												strokeOpacity={0.25}
											/>
											{outage.end !== null && (
												<ReferenceLine
													xAxisId={0}
													yAxisId="delay"
													x={outage.end}
													stroke="#22c55e"
													strokeWidth={2}
												/>
											)}
										</React.Fragment>
									);
								})}
								<ChartTooltip
									isAnimationActive={false}
									content={
										<ChartTooltipContent
											indicator="line"
											labelKey="created_at"
											labelFormatter={(_, payload) =>
												payload[0]?.payload?.created_at
													? formatTime(payload[0].payload.created_at)
													: ""
											}
											formatter={(value, _name, _item, _index, payload) => {
												const point = payload?.payload as
													| MonitorChartPoint
													| undefined;
												const failed = point ? isPointFailed(point) : false;
												return (
													<div className="flex min-w-44 items-center justify-between gap-4">
														<span className="text-muted-foreground">
															{failed
																? t("monitor.status", "状态")
																: t("monitor.avgDelay", "延迟")}
														</span>
														<span
															className={cn(
																"font-medium tabular-nums",
																failed && "text-red-500",
															)}
														>
															{failed
																? errorLabel(point?.error_code, t)
																: `${Number(value).toFixed(2)} ms`}
														</span>
													</div>
												);
											}}
										/>
									}
								/>
								<Line
									isAnimationActive={false}
									type="linear"
									dataKey="avg_delay"
									name={selectedMonitor}
									stroke={selectedColor}
									strokeWidth={2}
									dot={false}
									activeDot={{ r: 6, strokeWidth: 2 }}
									connectNulls={false}
									yAxisId="delay"
								/>
							</ComposedChart>
						</ChartContainer>
						{showPeriodLoading && (
							<div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-md backdrop-blur-[1px]">
								<div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/70" />
							</div>
						)}
					</div>

					<div className="mt-5 border-t px-3 pt-4 sm:px-2">
						<div className="mb-3 flex items-center justify-between gap-2">
							<h3 className="text-sm font-semibold">
								{t("monitor.outageRecords", "故障记录")}
							</h3>
							<span className="text-xs text-muted-foreground">
								{outages.length} {t("monitor.outageCount", "次")}
							</span>
						</div>
						{recentOutages.length === 0 ? (
							<div className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
								{t("monitor.noOutage", "当前时间范围内没有故障")}
							</div>
						) : (
							<div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
								{recentOutages.map((outage) => {
									const end = outage.end ?? domainEnd;
									return (
										<div
											key={outage.start}
											className="min-h-24 rounded-xl border border-red-500/20 bg-red-500/5 p-3.5"
										>
											<div className="flex items-start justify-between gap-3">
												<div>
													<p className="font-medium text-red-600 dark:text-red-400">
														{errorLabel(outage.errorCode, t)}
													</p>
													<p className="mt-1 text-xs text-muted-foreground">
														{formatTime(outage.start)} →{" "}
														{outage.end
															? formatTime(outage.end)
															: t("monitor.notRecovered", "尚未恢复")}
													</p>
												</div>
												<span
													className={cn(
														"shrink-0 rounded-full px-2 py-1 text-[11px] font-medium",
														outage.recovered
															? "bg-green-500/10 text-green-600 dark:text-green-400"
															: "bg-red-500/10 text-red-600 dark:text-red-400",
													)}
												>
													{outage.recovered
														? t("monitor.recovered", "已恢复")
														: t("monitor.inOutage", "故障中")}
												</span>
											</div>
											<p className="mt-3 text-sm font-semibold tabular-nums">
												{t("monitor.duration", "持续")}{" "}
												{formatDuration(end - outage.start)}
											</p>
										</div>
									);
								})}
							</div>
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

const mergeLiveResults = (
	previous: ServiceLatestResult[],
	incoming: ServiceLatestResult[],
) => {
	const byEvent = new Map<string, ServiceLatestResult>();
	for (const item of [...previous, ...incoming]) {
		byEvent.set(`${item.monitor_id}:${item.created_at}`, item);
	}
	return [...byEvent.values()]
		.sort((a, b) => a.created_at - b.created_at || a.monitor_id - b.monitor_id)
		.slice(-4096);
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
