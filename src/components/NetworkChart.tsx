"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as React from "react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	Area,
	CartesianGrid,
	ComposedChart,
	Line,
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
	ChartLegend,
	ChartLegendContent,
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
	fetchLoginUser,
	fetchMonitor,
	fetchMonitorLive,
	type MonitorPeriod,
} from "@/lib/nezha-api";
import { cn, formatTime } from "@/lib/utils";
import type {
	NezhaMonitor,
	ServerMonitorChart,
	ServiceLatestResult,
} from "@/types/nezha-api";
import NetworkChartLoading from "./NetworkChartLoading";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";

interface ResultItem {
	created_at: number;
	[key: string]: number | null | boolean;
}

const MIN_PERIOD_LOADING_MS = 500;
const LIVE_POLL_MIN_MS = 1000;
const LIVE_POLL_MAX_MS = 10000;

const errorLabel = (
	code: number | undefined,
	translate: (key: string, fallback: string) => string,
) => {
	switch (code) {
		case 1:
			return translate("monitor.timeout", "Timeout");
		case 2:
			return translate("monitor.connectionRefused", "Connection refused");
		case 3:
			return translate("monitor.dnsError", "DNS error");
		case 4:
			return translate("monitor.unreachable", "Network unreachable");
		case 5:
			return translate("monitor.invalidTarget", "Invalid target");
		default:
			return translate("monitor.failed", "Failed");
	}
};

const periodDurationMs = (period: MonitorPeriod) => {
	switch (period) {
		case "6h":
			return 6 * 60 * 60 * 1000;
		case "7d":
			return 7 * 24 * 60 * 60 * 1000;
		case "30d":
			return 30 * 24 * 60 * 60 * 1000;
		default:
			return 24 * 60 * 60 * 1000;
	}
};

/**
 * Helper method to calculate packet loss from delay data
 */
const calculatePacketLoss = (delays: number[]): number[] => {
	if (!delays || delays.length === 0) return [];

	const packetLossRates: number[] = [];
	const windowSize = Math.min(10, Math.max(3, Math.floor(delays.length / 10)));
	const timeoutThreshold = 3000;
	const extremeDelayThreshold = 10000;

	for (let i = 0; i < delays.length; i++) {
		const currentDelay = delays[i];
		let lossRate = 0;

		if (
			currentDelay === 0 ||
			currentDelay === null ||
			currentDelay === undefined
		) {
			lossRate = 100;
		} else if (currentDelay >= extremeDelayThreshold) {
			lossRate = Math.min(
				95,
				60 + (currentDelay - extremeDelayThreshold) / 1000,
			);
		} else if (currentDelay >= timeoutThreshold) {
			lossRate = Math.min(50, (currentDelay - timeoutThreshold) / 200);
		} else {
			const start = Math.max(0, i - Math.floor(windowSize / 2));
			const end = Math.min(delays.length, i + Math.ceil(windowSize / 2));
			const windowDelays = delays.slice(start, end).filter((d) => d > 0);

			if (windowDelays.length > 2) {
				const mean =
					windowDelays.reduce((sum, d) => sum + d, 0) / windowDelays.length;
				const variance =
					windowDelays.reduce((sum, d) => sum + (d - mean) ** 2, 0) /
					windowDelays.length;
				const standardDeviation = Math.sqrt(variance);
				const coefficientOfVariation = standardDeviation / mean;

				if (coefficientOfVariation > 0.8) {
					lossRate = Math.min(25, coefficientOfVariation * 15);
				} else if (coefficientOfVariation > 0.5) {
					lossRate = Math.min(10, coefficientOfVariation * 8);
				} else if (coefficientOfVariation > 0.3) {
					lossRate = Math.min(5, coefficientOfVariation * 5);
				}

				if (currentDelay > mean * 2.5) {
					lossRate += Math.min(15, (currentDelay / mean - 2.5) * 10);
				}
			}
		}

		if (i > 0) {
			const alpha = 0.3;
			lossRate = alpha * lossRate + (1 - alpha) * packetLossRates[i - 1];
		}

		packetLossRates.push(Math.max(0, Math.min(100, lossRate)));
	}

	return packetLossRates.map((rate) => Number(rate.toFixed(2)));
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
		refetchInterval: 1000 * 30,
		retry: 0,
	});
	const isLogin = isLoginError
		? false
		: userData
			? !!userData?.data?.id && !!document.cookie
			: false;

	React.useEffect(() => {
		if (!isLogin && period !== "1d" && period !== "6h") {
			setPeriod("6h");
		}
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

	if (monitorData?.success && !monitorData.data) {
		return (
			<>
				<div className="flex flex-col items-center justify-center">
					<p className="text-sm font-medium opacity-40"></p>
					<p className="text-sm font-medium opacity-40 mb-4">
						{t("monitor.noData")}
					</p>
				</div>
				<NetworkChartLoading />
			</>
		);
	}

	const mergedMonitorData = mergeMonitorData(
		monitorData.data,
		liveResults.filter((item) => item.server_id === server_id),
		period,
	);
	const transformedData = transformData(mergedMonitorData);

	const formattedData = formatData(mergedMonitorData);

	const monitorInfoByName = new Map(
		mergedMonitorData.map((item) => [
			item.monitor_name,
			{ id: item.monitor_id, displayIndex: item.display_index },
		]),
	);
	const chartDataKey = Object.keys(transformedData).sort((a, b) => {
		const aInfo = monitorInfoByName.get(a);
		const bInfo = monitorInfoByName.get(b);
		if (!aInfo && !bInfo) return a.localeCompare(b);
		if (!aInfo) return 1;
		if (!bInfo) return -1;

		const indexDiff = (bInfo.displayIndex ?? 0) - (aInfo.displayIndex ?? 0);
		if (indexDiff !== 0) return indexDiff;

		return aInfo.id - bInfo.id;
	});

	const initChartConfig = {
		avg_delay: {
			label: t("monitor.avgDelay"),
		},
		...chartDataKey.reduce((acc, key) => {
			acc[key] = {
				label: key,
			};
			return acc;
		}, {} as ChartConfig),
	} satisfies ChartConfig;

	return (
		<NetworkChartClient
			chartDataKey={chartDataKey}
			chartConfig={initChartConfig}
			chartData={transformedData}
			serverName={mergedMonitorData[0]?.server_name ?? ""}
			formattedData={formattedData}
			isPeriodLoading={isPlaceholderData}
			period={period}
			onPeriodChange={setPeriod}
			isLogin={isLogin}
		/>
	);
}

export const NetworkChartClient = React.memo(function NetworkChart({
	chartDataKey,
	chartConfig,
	chartData,
	serverName,
	formattedData,
	isPeriodLoading,
	period,
	onPeriodChange,
	isLogin,
}: {
	chartDataKey: string[];
	chartConfig: ChartConfig;
	chartData: ServerMonitorChart;
	serverName: string;
	formattedData: ResultItem[];
	isPeriodLoading: boolean;
	period: MonitorPeriod;
	onPeriodChange: (period: MonitorPeriod) => void;
	isLogin: boolean;
}) {
	const { t } = useTranslation();
	const [showPeriodLoading, setShowPeriodLoading] = React.useState(false);
	const loadingStartedAtRef = React.useRef<number | null>(null);

	const TIME_RANGE_OPTIONS = useMemo<{ value: MonitorPeriod; label: string }[]>(
		() => [
			{ value: "6h", label: t("monitor.period6h", "6h") },
			{ value: "1d", label: t("monitor.period1d") },
			{ value: "7d", label: t("monitor.period7d") },
			{ value: "30d", label: t("monitor.period30d") },
		],
		[t],
	);
	const timeRangeValues = useMemo(
		() => TIME_RANGE_OPTIONS.map((option) => option.value),
		[TIME_RANGE_OPTIONS],
	);
	const { containerRef, enableIndicatorAnimation, indicator, setItemRef } =
		useActiveIndicator(timeRangeValues, period);

	React.useEffect(() => {
		let timeoutId: number | undefined;

		if (isPeriodLoading) {
			loadingStartedAtRef.current = Date.now();
			setShowPeriodLoading(true);
			return;
		}

		const loadingStartedAt = loadingStartedAtRef.current;
		if (loadingStartedAt === null) {
			setShowPeriodLoading(false);
			return;
		}

		const elapsed = Date.now() - loadingStartedAt;
		const remaining = Math.max(0, MIN_PERIOD_LOADING_MS - elapsed);

		timeoutId = window.setTimeout(() => {
			setShowPeriodLoading(false);
			loadingStartedAtRef.current = null;
		}, remaining);

		return () => {
			if (timeoutId !== undefined) {
				window.clearTimeout(timeoutId);
			}
		};
	}, [isPeriodLoading]);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const forcePeakCutEnabled = (window.ForcePeakCutEnabled as boolean) ?? false;

	// Change from string to string array for multi-selection
	const [activeCharts, setActiveCharts] = React.useState<string[]>([]);
	const [isPeakEnabled, setIsPeakEnabled] = React.useState(forcePeakCutEnabled);

	// Function to clear all selected charts
	const clearAllSelections = useCallback(() => {
		setActiveCharts([]);
	}, []);

	// Updated to handle multiple selections
	const handleButtonClick = useCallback((chart: string) => {
		setActiveCharts((prev) => {
			// If chart is already selected, remove it
			if (prev.includes(chart)) {
				return prev.filter((c) => c !== chart);
			}
			// Otherwise, add it to selected charts
			return [...prev, chart];
		});
	}, []);

	const getColorByIndex = useCallback(
		(chart: string) => {
			const index = chartDataKey.indexOf(chart);
			return `hsl(var(--chart-${(index % 10) + 1}))`;
		},
		[chartDataKey],
	);

	const chartStats = useMemo(() => {
		const stats: { [key: string]: { minDelay: number; maxDelay: number } } = {};

		for (const key of chartDataKey) {
			const data = chartData[key] || [];
			if (data.length > 0) {
				const delays = data
					.filter((item) => item.avg_delay !== null && (item.status ?? 1) === 1)
					.map((item) => item.avg_delay as number);
				if (delays.length === 0) {
					stats[key] = { minDelay: 0, maxDelay: 0 };
					continue;
				}
				const minDelay = Math.min(...delays);
				const maxDelay = Math.max(...delays);
				stats[key] = { minDelay, maxDelay };
			} else {
				stats[key] = { minDelay: 0, maxDelay: 0 };
			}
		}

		return stats;
	}, [chartDataKey, chartData]);

	const chartButtons = useMemo(
		() =>
			chartDataKey.map((key) => {
				const monitorData = chartData[key];
				const lastPoint = monitorData[monitorData.length - 1];
				const lastDelay = lastPoint.avg_delay;
				const isFailed = (lastPoint.status ?? 1) === 0;
				const stats = chartStats[key];

				// Calculate average packet loss if available
				const packetLossData = monitorData.reduce<number[]>((acc, item) => {
					if (item.packet_loss !== undefined) {
						acc.push(item.packet_loss);
					}
					return acc;
				}, []);
				const avgPacketLoss =
					packetLossData.length > 0
						? packetLossData.reduce((sum, loss) => sum + loss, 0) /
							packetLossData.length
						: null;

				return (
					<button
						key={key}
						data-active={activeCharts.includes(key)}
						className={`relative z-30 flex cursor-pointer grow basis-0 flex-col justify-center gap-1 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 text-left data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-6`}
						onClick={() => handleButtonClick(key)}
					>
						<span className="whitespace-nowrap text-xs text-muted-foreground">
							{key}
						</span>
						<div className="flex flex-col gap-0.5">
							<span className="text-md font-semibold leading-none sm:text-xl">
								{isFailed
									? errorLabel(lastPoint.error_code, t)
									: `${(lastDelay ?? 0).toFixed(2)}ms`}
							</span>
							<div className="flex items-center gap-2 text-[12px]">
								<span className="text-green-600 dark:text-green-400">
									↓{stats.minDelay.toFixed(0)}
								</span>
								<span className="text-red-600 dark:text-red-500">
									↑{stats.maxDelay.toFixed(0)}
								</span>
								{avgPacketLoss !== null && (
									<span className="text-muted-foreground flex items-center gap-1">
										{avgPacketLoss.toFixed(2)}%
									</span>
								)}
								<span className="text-muted-foreground">
									{new Date(lastPoint.created_at).toLocaleTimeString()}
								</span>
							</div>
						</div>
					</button>
				);
			}),
		[chartDataKey, activeCharts, chartData, chartStats, handleButtonClick, t],
	);

	const chartElements = useMemo(() => {
		const elements = [];

		// If exactly one chart is selected, show delay line and packet loss area
		if (activeCharts.length === 1) {
			const chart = activeCharts[0];
			elements.push(
				<Area
					key="packet-loss-area"
					isAnimationActive={false}
					dataKey="packet_loss"
					stroke="none"
					fill="hsl(45, 100%, 60%)"
					fillOpacity={0.3}
					yAxisId="packet-loss"
				/>,
				<Line
					key="delay-line"
					isAnimationActive={false}
					strokeWidth={1}
					type="linear"
					dot={false}
					dataKey="avg_delay"
					stroke={getColorByIndex(chart)}
					yAxisId="delay"
					connectNulls={false}
				/>,
				<Line
					key="outage-points"
					isAnimationActive={false}
					dataKey="outage"
					legendType="none"
					stroke="transparent"
					dot={{ r: 4, fill: "#ef4444", stroke: "#991b1b" }}
					connectNulls={false}
					yAxisId="delay"
				/>,
				<Line
					key="recovery-points"
					isAnimationActive={false}
					dataKey="recovery"
					legendType="none"
					stroke="transparent"
					dot={{ r: 4, fill: "#22c55e", stroke: "#166534" }}
					connectNulls={false}
					yAxisId="delay"
				/>,
			);
		} else if (activeCharts.length > 1) {
			// Multiple charts selected - show only delay lines for selected monitors
			elements.push(
				...activeCharts.map((chart) => (
					<Line
						key={chart}
						isAnimationActive={false}
						strokeWidth={1}
						type="linear"
						dot={false}
						dataKey={chart}
						stroke={getColorByIndex(chart)}
						name={chart}
						connectNulls={false}
						yAxisId="delay"
					/>
				)),
				...activeCharts.flatMap((chart) => [
					<Line
						key={`${chart}-outage`}
						isAnimationActive={false}
						dataKey={`${chart}_outage`}
						legendType="none"
						stroke="transparent"
						dot={{ r: 3, fill: "#ef4444" }}
						yAxisId="delay"
					/>,
					<Line
						key={`${chart}-recovery`}
						isAnimationActive={false}
						dataKey={`${chart}_recovery`}
						legendType="none"
						stroke="transparent"
						dot={{ r: 3, fill: "#22c55e" }}
						yAxisId="delay"
					/>,
				]),
			);
		} else {
			// No selection - show all charts (default view)
			elements.push(
				...chartDataKey.map((key) => (
					<Line
						key={key}
						isAnimationActive={false}
						strokeWidth={1}
						type="linear"
						dot={false}
						dataKey={key}
						stroke={getColorByIndex(key)}
						connectNulls={false}
						yAxisId="delay"
					/>
				)),
				...chartDataKey.flatMap((key) => [
					<Line
						key={`${key}-outage`}
						isAnimationActive={false}
						dataKey={`${key}_outage`}
						legendType="none"
						stroke="transparent"
						dot={{ r: 3, fill: "#ef4444" }}
						yAxisId="delay"
					/>,
					<Line
						key={`${key}-recovery`}
						isAnimationActive={false}
						dataKey={`${key}_recovery`}
						legendType="none"
						stroke="transparent"
						dot={{ r: 3, fill: "#22c55e" }}
						yAxisId="delay"
					/>,
				]),
			);
		}

		return elements;
	}, [activeCharts, chartDataKey, getColorByIndex]);

	const processedData = useMemo(() => {
		// Special handling for single chart selection
		let baseData = formattedData;
		if (activeCharts.length === 1) {
			const selectedChart = activeCharts[0];
			baseData = chartData[selectedChart].map((item) => ({
				created_at: item.created_at,
				avg_delay: item.avg_delay,
				packet_loss: item.packet_loss ?? 0,
				outage: item.status === 0 ? 0 : null,
				recovery: item.recovered ? item.avg_delay : null,
				error_code: item.error_code ?? 0,
			}));
		}

		if (!isPeakEnabled) {
			return baseData;
		}

		// For peak cutting, use the base data
		const data = baseData;

		const windowSize = 11; // 增加窗口大小以获取更好的统计效果
		const alpha = 0.3; // EWMA平滑因子

		// 辅助函数：计算中位数
		const getMedian = (arr: number[]) => {
			const sorted = [...arr].sort((a, b) => a - b);
			const mid = Math.floor(sorted.length / 2);
			return sorted.length % 2
				? sorted[mid]
				: (sorted[mid - 1] + sorted[mid]) / 2;
		};

		// 辅助函数：异常值处理
		const processValues = (values: number[]) => {
			if (values.length === 0) return null;

			const median = getMedian(values);
			const deviations = values.map((v) => Math.abs(v - median));
			const medianDeviation = getMedian(deviations) * 1.4826; // MAD估计器

			// 使用中位数绝对偏差(MAD)进行异常值检测
			const validValues = values.filter(
				(v) =>
					Math.abs(v - median) <= 3 * medianDeviation && // 更严格的异常值判定
					v <= median * 3, // 限制最大值不超过中位数的3倍
			);

			if (validValues.length === 0) return median; // 如果没有有效值，返回中位数

			// 计算EWMA
			let ewma = validValues[0];
			for (let i = 1; i < validValues.length; i++) {
				ewma = alpha * validValues[i] + (1 - alpha) * ewma;
			}

			return ewma;
		};

		// 初始化EWMA历史值
		const ewmaHistory: { [key: string]: number } = {};

		return data.map((point, index) => {
			if (index < windowSize - 1) return point;

			const window = data.slice(index - windowSize + 1, index + 1);
			const smoothed = { ...point } as ResultItem;

			// Special handling for single chart selection
			if (activeCharts.length === 1) {
				if (point.avg_delay === null) {
					return smoothed;
				}
				// Process avg_delay for single chart
				const values = window
					.map((w) => w.avg_delay as number)
					.filter((v) => v !== undefined && v !== null);

				if (values.length > 0) {
					const processed = processValues(values);
					if (processed !== null) {
						if (ewmaHistory.avg_delay === undefined) {
							ewmaHistory.avg_delay = processed;
						} else {
							ewmaHistory.avg_delay =
								alpha * processed + (1 - alpha) * ewmaHistory.avg_delay;
						}
						smoothed.avg_delay = ewmaHistory.avg_delay;
					}
				}
			} else {
				// Process all chart keys or just the selected ones
				const keysToProcess =
					activeCharts.length > 0 ? activeCharts : chartDataKey;

				keysToProcess.forEach((key) => {
					if (point[key] === null) {
						return;
					}
					const values = window
						.map((w) => w[key])
						.filter((v) => v !== undefined && v !== null) as number[];

					if (values.length > 0) {
						const processed = processValues(values);
						if (processed !== null) {
							// Apply EWMA smoothing
							if (ewmaHistory[key] === undefined) {
								ewmaHistory[key] = processed;
							} else {
								ewmaHistory[key] =
									alpha * processed + (1 - alpha) * ewmaHistory[key];
							}
							smoothed[key] = ewmaHistory[key];
						}
					}
				});
			}

			return smoothed;
		});
	}, [isPeakEnabled, activeCharts, formattedData, chartData, chartDataKey]);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-3 sm:-mt-5 -mt-3 flex-wrap">
				<TooltipProvider delayDuration={120}>
					<div
						ref={containerRef}
						className="relative flex items-center gap-1 rounded-full bg-muted dark:bg-muted/40 p-0.5 border border-border/60 dark:border-border"
					>
						{indicator && (
							<div
								className="active-indicator-fade-in absolute left-0 top-0 z-10 bg-white dark:bg-background rounded-full ring-1 ring-border/60 dark:ring-border/40"
								style={{
									height: indicator.height,
									transform: `translate(${indicator.x}px, ${indicator.y}px)`,
									transition: indicator.shouldAnimate
										? "transform 0.5s var(--timing), width 0.5s var(--timing), height 0.5s var(--timing)"
										: "none",
									width: indicator.width,
								}}
							/>
						)}
						{TIME_RANGE_OPTIONS.map((option, index) => {
							const isLocked =
								!isLogin && option.value !== "1d" && option.value !== "6h";
							const optionItem = (
								<div
									ref={setItemRef(index)}
									onClick={() => {
										if (!isLocked) {
											if (period !== option.value) {
												enableIndicatorAnimation();
											}
											onPeriodChange(option.value);
										}
									}}
									className={cn(
										"relative cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-300",
										period === option.value
											? "text-foreground"
											: "text-muted-foreground hover:text-foreground",
										isLocked && "cursor-not-allowed opacity-40 grayscale",
									)}
								>
									<span className="relative z-20">{option.label}</span>
								</div>
							);

							if (isLocked) {
								return (
									<Tooltip key={option.value}>
										<TooltipTrigger asChild>{optionItem}</TooltipTrigger>
										<TooltipContent>
											{t("monitor.loginRequired", "Please login to view")}
										</TooltipContent>
									</Tooltip>
								);
							}

							return <div key={option.value}>{optionItem}</div>;
						})}
					</div>
				</TooltipProvider>
				<div className="flex items-center space-x-2">
					<Switch
						id="Peak"
						checked={isPeakEnabled}
						onCheckedChange={setIsPeakEnabled}
					/>
					<Label className="text-xs" htmlFor="Peak">
						{t("monitor.peakCut")}
					</Label>
				</div>
			</div>
			<Card
				className={cn({
					"bg-card/70": customBackgroundImage,
				})}
			>
				<CardHeader className="flex flex-col items-stretch space-y-0 overflow-hidden rounded-t-lg p-0 sm:flex-row">
					<div className="flex flex-none flex-col justify-center gap-1 border-b px-6 py-4">
						<CardTitle className="flex flex-none items-center gap-0.5 text-md">
							{serverName}
						</CardTitle>
						<CardDescription className="text-xs">
							{chartDataKey.length} {t("monitor.monitorCount")}
						</CardDescription>
					</div>
					<div className="flex flex-wrap w-full">{chartButtons}</div>
				</CardHeader>
				<CardContent className="pr-2 pl-0 py-4 sm:pt-6 sm:pb-6 sm:pr-6 sm:pl-2">
					<div className="relative">
						{activeCharts.length > 0 && (
							<button
								className="absolute -top-2 right-1 z-10 text-xs px-2 py-1 bg-stone-100/80 dark:bg-stone-800/80 backdrop-blur-xs rounded-[5px] text-muted-foreground hover:text-foreground transition-colors"
								onClick={clearAllSelections}
							>
								{t("monitor.clearSelections", "Clear")} ({activeCharts.length})
							</button>
						)}
						<ChartContainer
							config={chartConfig}
							className={cn(
								"aspect-auto h-62.5 w-full transition-opacity",
								showPeriodLoading && "opacity-60",
							)}
						>
							<ComposedChart
								accessibilityLayer
								data={processedData}
								margin={{ left: 12, right: 12 }}
							>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="created_at"
									tickLine={true}
									tickSize={3}
									axisLine={false}
									tickMargin={8}
									minTickGap={80}
									ticks={processedData
										.filter((item, index, array) => {
											if (array.length < 6) {
												return index === 0 || index === array.length - 1;
											}

											// 计算数据的总时间跨度（毫秒）
											const timeSpan =
												array[array.length - 1].created_at -
												array[0].created_at;
											const hours = timeSpan / (1000 * 60 * 60);

											// 根据时间跨度调整显示间隔
											if (hours <= 12) {
												// 12小时内，每60分钟显示一个刻度
												return (
													index === 0 ||
													index === array.length - 1 ||
													new Date(item.created_at).getMinutes() % 60 === 0
												);
											}
											// 超过12小时，每2小时显示一个刻度
											const date = new Date(item.created_at);
											return (
												date.getMinutes() === 0 && date.getHours() % 2 === 0
											);
										})
										.map((item) => item.created_at)}
									tickFormatter={(value) => {
										const date = new Date(value);
										const minutes = date.getMinutes();
										return minutes === 0
											? `${date.getHours()}:00`
											: `${date.getHours()}:${minutes}`;
									}}
								/>
								<YAxis
									yAxisId="delay"
									tickLine={false}
									axisLine={false}
									tickMargin={15}
									minTickGap={20}
									tickFormatter={(value) => `${value}ms`}
								/>
								{activeCharts.length === 1 && (
									<YAxis
										yAxisId="packet-loss"
										orientation="right"
										tickLine={false}
										axisLine={false}
										tickMargin={15}
										minTickGap={20}
										tickFormatter={(value) => `${value}%`}
									/>
								)}
								<ChartTooltip
									isAnimationActive={false}
									content={
										<ChartTooltipContent
											indicator={"line"}
											labelKey="created_at"
											labelFormatter={(_, payload) => {
												return formatTime(payload[0].payload.created_at);
											}}
											formatter={(value, name, _item, _index, payload) => {
												let formattedValue: string;
												let label: string;
												const field = String(name);

												if (field === "outage" || field.endsWith("_outage")) {
													const monitorName = field.replace(/_outage$/, "");
													const code = Number(
														payload?.payload?.[
															field === "outage"
																? "error_code"
																: `${monitorName}_error_code`
														] ?? 6,
													);
													formattedValue = errorLabel(code, t);
													label = t("monitor.outage", "Outage");
												} else if (
													field === "recovery" ||
													field.endsWith("_recovery")
												) {
													formattedValue = `${Number(value).toFixed(2)}ms`;
													label = t("monitor.recovered", "Recovered");
												} else if (name === "packet_loss") {
													formattedValue = `${Number(value).toFixed(2)}%`;
													label = t("monitor.packetLoss", "Packet Loss");
												} else if (name === "avg_delay") {
													formattedValue = `${Number(value).toFixed(2)}ms`;
													label = t("monitor.avgDelay", "Avg Delay");
												} else {
													// For monitor names (in multi-chart view) - delay data
													formattedValue = `${Number(value).toFixed(2)}ms`;
													label = name as string;
												}

												return (
													<div className="flex flex-1 items-center justify-between leading-none">
														<span className="text-muted-foreground">
															{label}
														</span>
														<span className="ml-2 font-medium text-foreground tabular-nums">
															{formattedValue}
														</span>
													</div>
												);
											}}
										/>
									}
								/>
								{activeCharts.length !== 1 && (
									<ChartLegend content={<ChartLegendContent />} />
								)}
								{chartElements}
							</ComposedChart>
						</ChartContainer>
						{showPeriodLoading && (
							<div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-md backdrop-blur-[1px]">
								<div className="flex size-9 items-center justify-center">
									<div className="absolute inset-0 flex items-center justify-center">
										<div className="size-4 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/70 animate-spin" />
									</div>
								</div>
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
});

const transformData = (data: NezhaMonitor[]) => {
	const monitorData: ServerMonitorChart = {};

	data.forEach((item) => {
		const monitorName = item.monitor_name;

		if (!monitorData[monitorName]) {
			monitorData[monitorName] = [];
		}

		// Calculate packet loss from delay data if not provided
		const packetLoss = item.packet_loss ?? calculatePacketLoss(item.avg_delay);
		let previousStatus: number | undefined;

		for (let i = 0; i < item.created_at.length; i++) {
			const status =
				item.status?.[i] ??
				((packetLoss[i] ?? 0) >= 100 || item.avg_delay[i] === 0 ? 0 : 1);
			monitorData[monitorName].push({
				created_at: item.created_at[i],
				avg_delay: status === 1 ? item.avg_delay[i] : null,
				packet_loss: packetLoss[i],
				status,
				error_code: item.error_code?.[i] ?? (status === 0 ? 6 : 0),
				recovered: status === 1 && previousStatus === 0,
			});
			previousStatus = status;
		}
	});

	return monitorData;
};

const formatData = (rawData: NezhaMonitor[]) => {
	const result: { [time: number]: ResultItem } = {};

	const allTimes = new Set<number>();
	rawData.forEach((item) => {
		item.created_at.forEach((time) => {
			allTimes.add(time);
		});
	});

	const allTimeArray = Array.from(allTimes).sort((a, b) => a - b);

	rawData.forEach((item) => {
		const { monitor_name, created_at, avg_delay } = item;

		// Calculate packet loss if not provided
		const packetLoss = item.packet_loss ?? calculatePacketLoss(avg_delay);

		allTimeArray.forEach((time) => {
			if (!result[time]) {
				result[time] = { created_at: time };
			}

			const timeIndex = created_at.indexOf(time);
			const status = timeIndex !== -1 ? item.status?.[timeIndex] : undefined;
			const resolvedStatus =
				timeIndex !== -1
					? (status ??
						((packetLoss[timeIndex] ?? 0) >= 100 || avg_delay[timeIndex] === 0
							? 0
							: 1))
					: undefined;
			const delay =
				timeIndex !== -1 && resolvedStatus === 1 ? avg_delay[timeIndex] : null;
			result[time][monitor_name] = delay;
			result[time][`${monitor_name}_outage`] =
				timeIndex !== -1 && resolvedStatus === 0 ? 0 : null;
			result[time][`${monitor_name}_recovery`] =
				timeIndex > 0 &&
				resolvedStatus === 1 &&
				(item.status?.[timeIndex - 1] ??
					((packetLoss[timeIndex - 1] ?? 0) >= 100 ||
					avg_delay[timeIndex - 1] === 0
						? 0
						: 1)) === 0
					? avg_delay[timeIndex]
					: null;
			result[time][`${monitor_name}_error_code`] =
				timeIndex !== -1 ? (item.error_code?.[timeIndex] ?? 0) : null;
			// Add packet loss data if available
			if (packetLoss) {
				result[time][`${monitor_name}_packet_loss`] =
					timeIndex !== -1 ? packetLoss[timeIndex] : null;
			}
		});
	});

	return Object.values(result).sort((a, b) => a.created_at - b.created_at);
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
	const byID = new Map<number, NezhaMonitor>();
	for (const item of history) {
		const copy: NezhaMonitor = {
			...item,
			created_at: [],
			avg_delay: [],
			packet_loss: [],
			status: [],
			error_code: [],
		};
		for (let i = 0; i < item.created_at.length; i++) {
			if (item.created_at[i] < cutoff) continue;
			copy.created_at.push(item.created_at[i]);
			copy.avg_delay.push(item.avg_delay[i]);
			copy.packet_loss?.push(
				item.packet_loss?.[i] ?? (item.status?.[i] === 0 ? 100 : 0),
			);
			copy.status?.push(item.status?.[i] ?? (item.avg_delay[i] === 0 ? 0 : 1));
			copy.error_code?.push(item.error_code?.[i] ?? 0);
		}
		byID.set(item.monitor_id, copy);
	}

	for (const event of live) {
		if (event.created_at < cutoff) continue;
		let item = byID.get(event.monitor_id);
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
			byID.set(event.monitor_id, item);
		}
		const existingIndex = item.created_at.indexOf(event.created_at);
		const index = existingIndex >= 0 ? existingIndex : item.created_at.length;
		item.created_at[index] = event.created_at;
		item.avg_delay[index] = event.delay;
		item.packet_loss ??= [];
		item.status ??= [];
		item.error_code ??= [];
		item.packet_loss[index] = event.successful ? 0 : 100;
		item.status[index] = event.successful ? 1 : 0;
		item.error_code[index] = event.error_code;
	}

	for (const item of byID.values()) {
		const order = item.created_at
			.map((_, i) => i)
			.sort((a, b) => item.created_at[a] - item.created_at[b]);
		item.created_at = order.map((i) => item.created_at[i]);
		item.avg_delay = order.map((i) => item.avg_delay[i]);
		item.packet_loss = order.map((i) => item.packet_loss?.[i] ?? 0);
		item.status = order.map((i) => item.status?.[i] ?? 1);
		item.error_code = order.map((i) => item.error_code?.[i] ?? 0);
	}
	return [...byID.values()];
};
