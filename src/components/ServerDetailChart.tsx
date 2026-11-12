import {
	CircleStackIcon,
	ClockIcon,
	CpuChipIcon,
	QueueListIcon,
	SignalIcon,
	Square3Stack3DIcon,
} from "@heroicons/react/20/solid";
import { useQuery } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	LineChart,
	XAxis,
	YAxis,
} from "recharts";
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
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { formatBytes } from "@/lib/format";
import {
	fetchLoginUser,
	fetchServerMetrics,
	fetchSetting,
} from "@/lib/nezha-api";
import {
	bytesPerSecondToMbps,
	cn,
	formatMbps,
	formatNezhaInfo,
	formatRelativeTime,
	formatTime,
} from "@/lib/utils";
import type {
	MetricPeriod,
	NezhaServer,
	NezhaWebsocketResponse,
} from "@/types/nezha-api";

import ChartSkeleton from "./loading/ChartSkeleton";
import { ServerDetailChartLoading } from "./loading/ServerDetailLoading";
import { getUsageLevel } from "./ServerUsageBar";

type ChartPeriod = "realtime" | MetricPeriod;
const PersistentMetricsContext = createContext(true);

type gpuChartData = {
	timeStamp: string;
	gpu: number;
};

type cpuChartData = {
	timeStamp: string;
	cpu: number;
};

type processChartData = {
	timeStamp: string;
	process: number;
};

type diskChartData = {
	timeStamp: string;
	disk: number;
};

type memChartData = {
	timeStamp: string;
	mem: number;
	swap: number;
};

type networkChartData = {
	timeStamp: string;
	upload: number;
	download: number;
};

type connectChartData = {
	timeStamp: string;
	tcp: number;
	udp: number;
};

const MIN_HISTORY_LOADING_MS = 300;
const sleep = (ms: number) =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});

type MetricType =
	| "cpu"
	| "gpu"
	| "memory"
	| "disk"
	| "process"
	| "network"
	| "connection";

const metricIcons: Record<MetricType, typeof SignalIcon> = {
	cpu: CpuChipIcon,
	gpu: CpuChipIcon,
	memory: Square3Stack3DIcon,
	disk: CircleStackIcon,
	process: QueueListIcon,
	network: SignalIcon,
	connection: SignalIcon,
};

/** Current reading for a usage metric, coloured by the shared usage thresholds. */
function UsageValue({ value, digits = 2 }: { value: number; digits?: number }) {
	const level = getUsageLevel(value);
	return (
		<span
			data-level={level}
			className={cn(
				level === "warn" && "text-warning",
				level === "bad" && "text-danger",
			)}
		>
			{value.toFixed(digits)}%
		</span>
	);
}

function LegendItem({
	color,
	label,
	value,
}: {
	color: string;
	label: string;
	value: ReactNode;
}) {
	return (
		<span className="inline-flex min-w-0 items-center gap-1.5">
			<span
				aria-hidden="true"
				className="size-2 shrink-0 rounded-[2px]"
				style={{ backgroundColor: color }}
			/>
			<span>{label}</span>
			<span className="font-medium text-foreground tabular-nums">{value}</span>
		</span>
	);
}

/** Shared "metric card" shell: title, current value, optional legend, chart. */
function MetricCard({
	title,
	type,
	value,
	legend,
	meta,
	children,
}: {
	title: string;
	type: MetricType;
	value?: ReactNode;
	legend?: ReactNode;
	meta?: ReactNode;
	children: ReactNode;
}) {
	const Icon = metricIcons[type];
	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	return (
		<article
			data-metric={type}
			className={cn(
				"metric-card flex min-w-0 flex-col rounded-lg border border-border bg-card",
				customBackgroundImage && "bg-card/70",
			)}
		>
			<header className="flex items-start justify-between gap-3 px-4 pt-3.5">
				<div className="flex min-w-0 items-center gap-2">
					<Icon
						aria-hidden="true"
						className="size-4 shrink-0 text-muted-foreground"
					/>
					<h3 className="truncate text-[13px] font-medium">{title}</h3>
				</div>
				{value !== undefined && (
					<div className="shrink-0 text-right text-lg font-semibold leading-5 tabular-nums">
						{value}
					</div>
				)}
			</header>
			{(legend || meta) && (
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pt-2 text-xs text-muted-foreground tabular-nums">
					{legend && (
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
							{legend}
						</div>
					)}
					{meta && <span>{meta}</span>}
				</div>
			)}
			<div className="px-2 pt-1 pb-2">{children}</div>
		</article>
	);
}

function PeriodSelector({
	selectedPeriod,
	onPeriodChange,
	isLogin,
	isTsdbEnabled,
}: {
	selectedPeriod: ChartPeriod;
	onPeriodChange: (period: ChartPeriod) => void;
	isLogin: boolean;
	isTsdbEnabled: boolean;
}) {
	const { t } = useTranslation();

	const periods = useMemo<{ value: ChartPeriod; label: string }[]>(
		() => [
			{ value: "realtime", label: t("serverDetailChart.realtime") },
			{ value: "1d", label: t("serverDetailChart.period1d") },
			{ value: "7d", label: t("serverDetailChart.period7d") },
			{ value: "30d", label: t("serverDetailChart.period30d") },
		],
		[t],
	);
	const periodValues = useMemo(
		() => periods.map((period) => period.value),
		[periods],
	);
	const { containerRef, enableIndicatorAnimation, indicator, setItemRef } =
		useActiveIndicator(periodValues, selectedPeriod);

	return (
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
					{periods.map((period, index) => {
						const isHistoryPeriod = period.value !== "realtime";
						const isLockedByTsdb = !isTsdbEnabled && isHistoryPeriod;
						// Only realtime and 1d are available for non-logged-in users
						const isLockedByLogin =
							!isLockedByTsdb &&
							!isLogin &&
							period.value !== "realtime" &&
							period.value !== "1d";
						const isLocked = isLockedByTsdb || isLockedByLogin;
						const isSelected = selectedPeriod === period.value;

						const periodItem = (
							<button
								type="button"
								ref={setItemRef(index)}
								aria-pressed={isSelected}
								aria-disabled={isLocked || undefined}
								onClick={() => {
									if (!isLocked) {
										if (selectedPeriod !== period.value) {
											enableIndicatorAnimation();
										}
										onPeriodChange(period.value);
									}
								}}
								className={cn(
									"relative z-10",
									isLocked && "cursor-not-allowed opacity-40",
								)}
							>
								{period.value === "realtime" ? (
									<span
										aria-hidden="true"
										className="size-1.5 rounded-full bg-success"
									/>
								) : (
									<ClockIcon aria-hidden="true" className="size-3.5" />
								)}
								{period.label}
							</button>
						);

						if (isLockedByTsdb || isLockedByLogin) {
							return (
								<Tooltip key={period.value}>
									<TooltipTrigger asChild>{periodItem}</TooltipTrigger>
									<TooltipContent>
										{isLockedByTsdb
											? t(
													"serverDetailChart.tsdbRequired",
													"Enable TSDB to use historical data",
												)
											: t(
													"serverDetailChart.loginRequired",
													"Please login to view",
												)}
									</TooltipContent>
								</Tooltip>
							);
						}

						return <div key={period.value}>{periodItem}</div>;
					})}
				</div>
			</div>
		</TooltipProvider>
	);
}

export default function ServerDetailChart({
	server_id,
}: {
	server_id: string;
}) {
	const { lastData, connected, messageHistory } = useWebSocketContext();
	const [selectedPeriod, setSelectedPeriod] = useState<ChartPeriod>("realtime");

	// Check if user is logged in
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

	const { data: settingData } = useQuery({
		queryKey: ["setting"],
		queryFn: () => fetchSetting(),
		refetchOnMount: true,
		refetchOnWindowFocus: true,
	});
	const isTsdbEnabled = settingData?.data?.tsdb_enabled === true;

	useEffect(() => {
		if (!isTsdbEnabled && selectedPeriod !== "realtime") {
			setSelectedPeriod("realtime");
		}
	}, [isTsdbEnabled, selectedPeriod]);

	// Reset period if user is not logged in and selected period is restricted
	useEffect(() => {
		if (
			isTsdbEnabled &&
			!isLogin &&
			selectedPeriod !== "realtime" &&
			selectedPeriod !== "1d"
		) {
			setSelectedPeriod("1d");
		}
	}, [isLogin, isTsdbEnabled, selectedPeriod]);

	if (!connected && !lastData) {
		return <ServerDetailChartLoading />;
	}

	const nezhaWsData = lastData;

	if (!nezhaWsData) {
		return <ServerDetailChartLoading />;
	}

	const server = nezhaWsData.servers.find((s) => s.id === Number(server_id));

	if (!server) {
		return <ServerDetailChartLoading />;
	}

	const gpuStats = server.state.gpu || [];
	const gpuList = server.host.gpu || [];

	return (
		<section className="server-detail-charts flex min-w-0 flex-col gap-3">
			<PeriodSelector
				selectedPeriod={selectedPeriod}
				onPeriodChange={setSelectedPeriod}
				isLogin={isLogin}
				isTsdbEnabled={isTsdbEnabled}
			/>
			<PersistentMetricsContext.Provider value={isTsdbEnabled}>
				<section className="server-charts grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
					<CpuChart
						now={nezhaWsData.now}
						data={server}
						messageHistory={messageHistory}
						period={selectedPeriod}
					/>
					{gpuStats.length >= 1 && gpuList.length === gpuStats.length
						? gpuList.map((gpu, index) => (
								<GpuChart
									index={index}
									id={server.id}
									now={nezhaWsData.now}
									gpuStat={gpuStats[index]}
									gpuName={gpu}
									messageHistory={messageHistory}
									period={selectedPeriod}
									key={index}
								/>
							))
						: gpuStats.length > 0
							? gpuStats.map((gpu, index) => (
									<GpuChart
										index={index}
										id={server.id}
										now={nezhaWsData.now}
										gpuStat={gpu}
										gpuName={`#${index + 1}`}
										messageHistory={messageHistory}
										period={selectedPeriod}
										key={index}
									/>
								))
							: null}
					<MemChart
						now={nezhaWsData.now}
						data={server}
						messageHistory={messageHistory}
						period={selectedPeriod}
					/>
					<DiskChart
						now={nezhaWsData.now}
						data={server}
						messageHistory={messageHistory}
						period={selectedPeriod}
					/>
					<ProcessChart
						now={nezhaWsData.now}
						data={server}
						messageHistory={messageHistory}
						period={selectedPeriod}
					/>
					<NetworkChart
						now={nezhaWsData.now}
						data={server}
						messageHistory={messageHistory}
						period={selectedPeriod}
					/>
					<ConnectChart
						now={nezhaWsData.now}
						data={server}
						messageHistory={messageHistory}
						period={selectedPeriod}
					/>
				</section>
			</PersistentMetricsContext.Provider>
		</section>
	);
}

function useHistoricalData<T>(
	serverId: number,
	metricName: string,
	period: ChartPeriod,
	transformData: (timestamp: number, value: number) => T,
) {
	const persistentMetricsEnabled = useContext(PersistentMetricsContext);
	const [historicalData, setHistoricalData] = useState<T[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [displayData, setDisplayData] = useState<T[]>([]);
	const [loadedPeriod, setLoadedPeriod] = useState<ChartPeriod>("realtime");

	useEffect(() => {
		let cancelled = false;
		if (period === "realtime" && !persistentMetricsEnabled) {
			setIsLoading(false);
			return;
		}
		const requestPeriod: MetricPeriod = period === "realtime" ? "1d" : period;

		const fetchData = async () => {
			const loadingStartedAt = Date.now();
			if (period !== "realtime") setIsLoading(true);

			try {
				const response = await fetchServerMetrics(
					serverId,
					metricName as Parameters<typeof fetchServerMetrics>[1],
					requestPeriod,
				);
				if (response.success && response.data?.data_points) {
					const transformedData = response.data.data_points
						.map((point) => transformData(point.ts, point.value))
						.slice(period === "realtime" ? -30 : undefined);
					if (!cancelled) {
						setHistoricalData(transformedData);
						setDisplayData(transformedData);
					}
				}
			} catch (error) {
				console.error(`Failed to fetch ${metricName} metrics:`, error);
			} finally {
				const elapsed = Date.now() - loadingStartedAt;
				if (period !== "realtime" && elapsed < MIN_HISTORY_LOADING_MS) {
					await sleep(MIN_HISTORY_LOADING_MS - elapsed);
				}
				if (!cancelled) {
					setIsLoading(false);
					setLoadedPeriod(period);
				}
			}
		};

		fetchData();
		return () => {
			cancelled = true;
		};
	}, [serverId, metricName, period, transformData, persistentMetricsEnabled]);

	const isHistoricalLoading =
		period !== "realtime" && (isLoading || loadedPeriod !== period);

	return { historicalData, displayData, isLoading: isHistoricalLoading };
}

function GpuChart({
	id,
	index,
	gpuStat,
	gpuName,
	messageHistory,
	period,
}: {
	now: number;
	id: number;
	index: number;
	gpuStat: number;
	gpuName?: string;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const [gpuChartData, setGpuChartData] = useState<gpuChartData[]>([]);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const transformGpuData = useMemo(
		() => (timestamp: number, value: number) => ({
			timeStamp: timestamp.toString(),
			gpu: value,
		}),
		[],
	);

	const { displayData: gpuHistoricalData, isLoading } =
		useHistoricalData<gpuChartData>(id, "gpu", period, transformGpuData);

	useEffect(() => {
		if (
			period === "realtime" &&
			gpuHistoricalData.length &&
			!hasInitialized.current
		) {
			setGpuChartData(gpuHistoricalData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [gpuHistoricalData, period]);

	// 初始化历史数据
	useEffect(() => {
		if (
			period === "realtime" &&
			!hasInitialized.current &&
			messageHistory.length > 0
		) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === id);
					if (!server) return null;
					const { gpu } = formatNezhaInfo(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						gpu: gpu[index],
					};
				})
				.filter((item): item is gpuChartData => item !== null)
				.reverse();

			setGpuChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, id, index, period]);

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	useEffect(() => {
		if (gpuStat && historyLoaded && period === "realtime") {
			const timestamp = Date.now().toString();
			setGpuChartData((prevData) => {
				let newData = [] as gpuChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, gpu: gpuStat },
						{ timeStamp: timestamp, gpu: gpuStat },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, gpu: gpuStat }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [gpuStat, historyLoaded, period]);

	const chartConfig = {
		gpu: {
			label: "GPU",
		},
	} satisfies ChartConfig;

	const displayData = period === "realtime" ? gpuChartData : gpuHistoricalData;

	return (
		<MetricCard
			title={gpuName ? `GPU · ${gpuName}` : "GPU"}
			type="gpu"
			value={<UsageValue value={gpuStat} />}
		>
			<ChartContainer
				config={chartConfig}
				className="aspect-auto h-[130px] w-full"
			>
				{isLoading ? (
					<ChartSkeleton />
				) : (
					<AreaChart
						syncId="serverDetailCharts"
						accessibilityLayer
						data={displayData}
						margin={{
							top: 12,
							left: 12,
							right: 12,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="timeStamp"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={200}
							interval="preserveStartEnd"
							tickFormatter={(value) => formatRelativeTime(value)}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							mirror={true}
							tickMargin={-15}
							domain={[0, 100]}
							tickFormatter={(value) => `${value}%`}
						/>
						<ChartTooltip
							isAnimationActive={false}
							content={
								<ChartTooltipContent
									indicator="dot"
									labelFormatter={(_, payload) => {
										return formatTime(Number(payload[0]?.payload?.timeStamp));
									}}
									formatter={(value) => (
										<div className="flex flex-1 items-center justify-between leading-none">
											<span className="text-muted-foreground">GPU</span>
											<span className="ml-2 font-medium text-foreground tabular-nums">
												{Number(value).toFixed(1)}%
											</span>
										</div>
									)}
								/>
							}
						/>
						<Area
							isAnimationActive={false}
							dataKey="gpu"
							type="monotone"
							fill="hsl(var(--chart-1))"
							fillOpacity={0.12}
							strokeWidth={1.5}
							stroke="hsl(var(--chart-1))"
						/>
					</AreaChart>
				)}
			</ChartContainer>
		</MetricCard>
	);
}

function CpuChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const [cpuChartData, setCpuChartData] = useState<cpuChartData[]>([]);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const { cpu } = formatNezhaInfo(now, data);

	const transformCpuData = useMemo(
		() => (timestamp: number, value: number) => ({
			timeStamp: timestamp.toString(),
			cpu: value,
		}),
		[],
	);

	const { displayData: cpuHistoricalData, isLoading } =
		useHistoricalData<cpuChartData>(data.id, "cpu", period, transformCpuData);

	useEffect(() => {
		if (
			period === "realtime" &&
			cpuHistoricalData.length &&
			!hasInitialized.current
		) {
			setCpuChartData(cpuHistoricalData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [cpuHistoricalData, period]);

	// 初始化历史数据
	useEffect(() => {
		if (
			period === "realtime" &&
			!hasInitialized.current &&
			messageHistory.length > 0
		) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { cpu } = formatNezhaInfo(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						cpu: cpu,
					};
				})
				.filter((item): item is cpuChartData => item !== null)
				.reverse();

			setCpuChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 更新实时数据
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = Date.now().toString();
			setCpuChartData((prevData) => {
				let newData = [] as cpuChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, cpu: cpu },
						{ timeStamp: timestamp, cpu: cpu },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, cpu: cpu }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [data, historyLoaded, cpu, period]);

	const chartConfig = {
		cpu: {
			label: "CPU",
		},
	} satisfies ChartConfig;

	const displayData = period === "realtime" ? cpuChartData : cpuHistoricalData;

	return (
		<MetricCard title="CPU" type="cpu" value={<UsageValue value={cpu} />}>
			<ChartContainer
				config={chartConfig}
				className="aspect-auto h-[130px] w-full"
			>
				{isLoading ? (
					<ChartSkeleton />
				) : (
					<AreaChart
						syncId="serverDetailCharts"
						accessibilityLayer
						data={displayData}
						margin={{
							top: 12,
							left: 12,
							right: 12,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="timeStamp"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={200}
							interval="preserveStartEnd"
							tickFormatter={(value) => formatRelativeTime(value)}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							mirror={true}
							tickMargin={-15}
							domain={[0, 100]}
							tickFormatter={(value) => `${value}%`}
						/>
						<ChartTooltip
							isAnimationActive={false}
							content={
								<ChartTooltipContent
									indicator="dot"
									labelFormatter={(_, payload) => {
										return formatTime(Number(payload[0]?.payload?.timeStamp));
									}}
									formatter={(value) => (
										<div className="flex flex-1 items-center justify-between leading-none">
											<span className="text-muted-foreground">CPU</span>
											<span className="ml-2 font-medium text-foreground tabular-nums">
												{Number(value).toFixed(1)}%
											</span>
										</div>
									)}
								/>
							}
						/>
						<Area
							isAnimationActive={false}
							dataKey="cpu"
							type="monotone"
							fill="hsl(var(--chart-1))"
							fillOpacity={0.12}
							strokeWidth={1.5}
							stroke="hsl(var(--chart-1))"
						/>
					</AreaChart>
				)}
			</ChartContainer>
		</MetricCard>
	);
}

function ProcessChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const { t } = useTranslation();
	const [processChartData, setProcessChartData] = useState(
		[] as processChartData[],
	);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const { process } = formatNezhaInfo(now, data);

	const transformProcessData = useMemo(
		() => (timestamp: number, value: number) => ({
			timeStamp: timestamp.toString(),
			process: value,
		}),
		[],
	);

	const { displayData: processHistoricalData, isLoading } =
		useHistoricalData<processChartData>(
			data.id,
			"process_count",
			period,
			transformProcessData,
		);

	useEffect(() => {
		if (
			period === "realtime" &&
			processHistoricalData.length &&
			!hasInitialized.current
		) {
			setProcessChartData(processHistoricalData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [processHistoricalData, period]);

	// 初始化历史数据
	useEffect(() => {
		if (
			period === "realtime" &&
			!hasInitialized.current &&
			messageHistory.length > 0
		) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { process } = formatNezhaInfo(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						process,
					};
				})
				.filter((item): item is processChartData => item !== null)
				.reverse();

			setProcessChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 修改实时数据更新逻辑
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = Date.now().toString();
			setProcessChartData((prevData) => {
				let newData = [] as processChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, process },
						{ timeStamp: timestamp, process },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, process }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [data, historyLoaded, process, period]);

	const chartConfig = {
		process: {
			label: "Process",
		},
	} satisfies ChartConfig;

	const displayData =
		period === "realtime" ? processChartData : processHistoricalData;

	return (
		<MetricCard
			title={t("serverDetailChart.process")}
			type="process"
			value={process}
		>
			<ChartContainer
				config={chartConfig}
				className="aspect-auto h-[130px] w-full"
			>
				{isLoading ? (
					<ChartSkeleton />
				) : (
					<AreaChart
						syncId="serverDetailCharts"
						accessibilityLayer
						data={displayData}
						margin={{
							top: 12,
							left: 12,
							right: 12,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="timeStamp"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={200}
							interval="preserveStartEnd"
							tickFormatter={(value) => formatRelativeTime(value)}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							mirror={true}
							tickMargin={-15}
						/>
						<ChartTooltip
							isAnimationActive={false}
							content={
								<ChartTooltipContent
									indicator={"dot"}
									labelFormatter={(_, payload) => {
										return formatTime(Number(payload[0]?.payload?.timeStamp));
									}}
									formatter={(value) => (
										<div className="flex flex-1 items-center justify-between leading-none">
											<span className="text-muted-foreground">
												{t("serverDetailChart.process")}
											</span>
											<span className="ml-2 font-medium text-foreground tabular-nums">
												{Number(value).toFixed(0)}
											</span>
										</div>
									)}
								/>
							}
						/>
						<Area
							isAnimationActive={false}
							dataKey="process"
							type="monotone"
							fill="hsl(var(--chart-1))"
							fillOpacity={0.12}
							strokeWidth={1.5}
							stroke="hsl(var(--chart-1))"
						/>
					</AreaChart>
				)}
			</ChartContainer>
		</MetricCard>
	);
}

function MemChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const persistentMetricsEnabled = useContext(PersistentMetricsContext);
	const { t } = useTranslation();
	const [memChartData, setMemChartData] = useState([] as memChartData[]);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const { mem, swap } = formatNezhaInfo(now, data);

	// For memory, we fetch memory and swap separately and combine them
	const [memHistoricalData, setMemHistoricalData] = useState<memChartData[]>(
		[],
	);
	const [isLoadingMem, setIsLoadingMem] = useState(false);
	const [loadedPeriodMem, setLoadedPeriodMem] =
		useState<ChartPeriod>("realtime");

	useEffect(() => {
		let cancelled = false;
		if (period === "realtime" && !persistentMetricsEnabled) return;

		const requestPeriod: MetricPeriod = period === "realtime" ? "1d" : period;

		const fetchMemData = async () => {
			const loadingStartedAt = Date.now();
			if (period !== "realtime") setIsLoadingMem(true);
			try {
				const [memResponse, swapResponse] = await Promise.all([
					fetchServerMetrics(data.id, "memory", requestPeriod),
					fetchServerMetrics(data.id, "swap", requestPeriod),
				]);

				if (memResponse.success && memResponse.data?.data_points) {
					const swapMap = new Map<number, number>();
					if (swapResponse.success && swapResponse.data?.data_points) {
						for (const point of swapResponse.data.data_points) {
							// Convert bytes to percentage
							const swapPercent =
								data.host.swap_total > 0
									? (point.value / data.host.swap_total) * 100
									: 0;
							swapMap.set(point.ts, swapPercent);
						}
					}

					const combinedData = memResponse.data.data_points
						.map((point) => {
							// Convert bytes to percentage
							const memPercent =
								data.host.mem_total > 0
									? (point.value / data.host.mem_total) * 100
									: 0;
							return {
								timeStamp: point.ts.toString(),
								mem: memPercent,
								swap: swapMap.get(point.ts) || 0,
							};
						})
						.slice(period === "realtime" ? -30 : undefined);
					if (!cancelled) {
						setMemHistoricalData(combinedData);
					}
				}
			} catch (error) {
				console.error("Failed to fetch memory metrics:", error);
			} finally {
				const elapsed = Date.now() - loadingStartedAt;
				if (period !== "realtime" && elapsed < MIN_HISTORY_LOADING_MS) {
					await sleep(MIN_HISTORY_LOADING_MS - elapsed);
				}
				if (!cancelled) {
					setIsLoadingMem(false);
					setLoadedPeriodMem(period);
				}
			}
		};

		fetchMemData();
		return () => {
			cancelled = true;
		};
	}, [
		data.id,
		period,
		data.host.mem_total,
		data.host.swap_total,
		persistentMetricsEnabled,
	]);

	useEffect(() => {
		if (
			period === "realtime" &&
			memHistoricalData.length &&
			!hasInitialized.current
		) {
			setMemChartData(memHistoricalData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [memHistoricalData, period]);

	// 初始化历史数据
	useEffect(() => {
		if (
			period === "realtime" &&
			!hasInitialized.current &&
			messageHistory.length > 0
		) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { mem, swap } = formatNezhaInfo(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						mem,
						swap,
					};
				})
				.filter((item): item is memChartData => item !== null)
				.reverse();

			setMemChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// Reset when switching to realtime
	useEffect(() => {
		if (period !== "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 修改实时数据更新逻辑
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = Date.now().toString();
			setMemChartData((prevData) => {
				let newData = [] as memChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, mem, swap },
						{ timeStamp: timestamp, mem, swap },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, mem, swap }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [data, historyLoaded, mem, swap, period]);

	const chartConfig = {
		mem: {
			label: "Mem",
		},
		swap: {
			label: "Swap",
		},
	} satisfies ChartConfig;

	const displayData = period === "realtime" ? memChartData : memHistoricalData;
	const isMemLoading =
		period !== "realtime" && (isLoadingMem || loadedPeriodMem !== period);

	return (
		<MetricCard
			title={t("serverDetailChart.mem")}
			type="memory"
			value={
				<span className="text-xs font-normal text-muted-foreground">
					{formatBytes(data.state.mem_used)} /{" "}
					{formatBytes(data.host.mem_total)}
				</span>
			}
			legend={
				<>
					<LegendItem
						color="hsl(var(--chart-1))"
						label={t("serverDetailChart.mem")}
						value={`${mem.toFixed(0)}%`}
					/>
					<LegendItem
						color="hsl(var(--chart-2))"
						label={t("serverDetailChart.swap")}
						value={`${swap.toFixed(0)}%`}
					/>
				</>
			}
			meta={
				data.host.swap_total ? (
					<>
						swap: {formatBytes(data.state.swap_used)} /{" "}
						{formatBytes(data.host.swap_total)}
					</>
				) : (
					t("serverDetailChart.noSwap")
				)
			}
		>
			<ChartContainer
				config={chartConfig}
				className="aspect-auto h-[130px] w-full"
			>
				{isMemLoading ? (
					<ChartSkeleton />
				) : (
					<AreaChart
						syncId="serverDetailCharts"
						accessibilityLayer
						data={displayData}
						margin={{
							top: 12,
							left: 12,
							right: 12,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="timeStamp"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={200}
							interval="preserveStartEnd"
							tickFormatter={(value) => formatRelativeTime(value)}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							mirror={true}
							tickMargin={-15}
							domain={[0, 100]}
							tickFormatter={(value) => `${value}%`}
						/>
						<ChartTooltip
							isAnimationActive={false}
							content={
								<ChartTooltipContent
									indicator="dot"
									labelFormatter={(_, payload) => {
										return formatTime(Number(payload[0]?.payload?.timeStamp));
									}}
									formatter={(value, name) => {
										const label =
											name === "mem"
												? t("serverDetailChart.mem")
												: t("serverDetailChart.swap");
										return (
											<div className="flex flex-1 items-center justify-between leading-none">
												<span className="text-muted-foreground">{label}</span>
												<span className="ml-2 font-medium text-foreground tabular-nums">
													{Number(value).toFixed(1)}%
												</span>
											</div>
										);
									}}
								/>
							}
						/>
						<Area
							isAnimationActive={false}
							dataKey="mem"
							type="monotone"
							fill="hsl(var(--chart-1))"
							fillOpacity={0.12}
							strokeWidth={1.5}
							stroke="hsl(var(--chart-1))"
						/>
						<Area
							isAnimationActive={false}
							dataKey="swap"
							type="monotone"
							fill="hsl(var(--chart-2))"
							fillOpacity={0.12}
							strokeWidth={1.5}
							stroke="hsl(var(--chart-2))"
						/>
					</AreaChart>
				)}
			</ChartContainer>
		</MetricCard>
	);
}

function DiskChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const { t } = useTranslation();
	const [diskChartData, setDiskChartData] = useState([] as diskChartData[]);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const { disk } = formatNezhaInfo(now, data);

	const transformDiskData = useMemo(
		() => (timestamp: number, value: number) => {
			// Convert bytes to percentage
			const diskPercent =
				data.host.disk_total > 0 ? (value / data.host.disk_total) * 100 : 0;
			return {
				timeStamp: timestamp.toString(),
				disk: diskPercent,
			};
		},
		[data.host.disk_total],
	);

	const { displayData: diskHistoricalData, isLoading } =
		useHistoricalData<diskChartData>(
			data.id,
			"disk",
			period,
			transformDiskData,
		);

	useEffect(() => {
		if (
			period === "realtime" &&
			diskHistoricalData.length &&
			!hasInitialized.current
		) {
			setDiskChartData(diskHistoricalData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [diskHistoricalData, period]);

	// 初始化历史数据
	useEffect(() => {
		if (
			period === "realtime" &&
			!hasInitialized.current &&
			messageHistory.length > 0
		) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { disk } = formatNezhaInfo(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						disk,
					};
				})
				.filter((item): item is diskChartData => item !== null)
				.reverse();

			setDiskChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 修改实时数据更新逻辑
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = Date.now().toString();
			setDiskChartData((prevData) => {
				let newData = [] as diskChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, disk },
						{ timeStamp: timestamp, disk },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, disk }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [data, historyLoaded, disk, period]);

	const chartConfig = {
		disk: {
			label: "Disk",
		},
	} satisfies ChartConfig;

	const displayData =
		period === "realtime" ? diskChartData : diskHistoricalData;

	return (
		<MetricCard
			title={t("serverDetailChart.disk")}
			type="disk"
			value={<UsageValue value={disk} digits={0} />}
			meta={
				<>
					{formatBytes(data.state.disk_used)} /{" "}
					{formatBytes(data.host.disk_total)}
				</>
			}
		>
			<ChartContainer
				config={chartConfig}
				className="aspect-auto h-[130px] w-full"
			>
				{isLoading ? (
					<ChartSkeleton />
				) : (
					<AreaChart
						syncId="serverDetailCharts"
						accessibilityLayer
						data={displayData}
						margin={{
							top: 12,
							left: 12,
							right: 12,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="timeStamp"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={200}
							interval="preserveStartEnd"
							tickFormatter={(value) => formatRelativeTime(value)}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							mirror={true}
							tickMargin={-15}
							domain={[0, 100]}
							tickFormatter={(value) => `${value}%`}
						/>
						<ChartTooltip
							isAnimationActive={false}
							content={
								<ChartTooltipContent
									indicator="dot"
									labelFormatter={(_, payload) => {
										return formatTime(Number(payload[0]?.payload?.timeStamp));
									}}
									formatter={(value) => (
										<div className="flex flex-1 items-center justify-between leading-none">
											<span className="text-muted-foreground">
												{t("serverDetailChart.disk")}
											</span>
											<span className="ml-2 font-medium text-foreground tabular-nums">
												{Number(value).toFixed(1)}%
											</span>
										</div>
									)}
								/>
							}
						/>
						<Area
							isAnimationActive={false}
							dataKey="disk"
							type="monotone"
							fill="hsl(var(--chart-1))"
							fillOpacity={0.12}
							strokeWidth={1.5}
							stroke="hsl(var(--chart-1))"
						/>
					</AreaChart>
				)}
			</ChartContainer>
		</MetricCard>
	);
}

function NetworkChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const persistentMetricsEnabled = useContext(PersistentMetricsContext);
	const { t } = useTranslation();
	const [networkChartData, setNetworkChartData] = useState(
		[] as networkChartData[],
	);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const { up, down } = formatNezhaInfo(now, data);

	// For network, we fetch upload and download separately and combine them
	const [networkHistoricalData, setNetworkHistoricalData] = useState<
		networkChartData[]
	>([]);
	const [isLoadingNetwork, setIsLoadingNetwork] = useState(false);
	const [loadedPeriodNetwork, setLoadedPeriodNetwork] =
		useState<ChartPeriod>("realtime");

	useEffect(() => {
		let cancelled = false;
		if (period === "realtime" && !persistentMetricsEnabled) return;

		const requestPeriod: MetricPeriod = period === "realtime" ? "1d" : period;

		const fetchNetworkData = async () => {
			const loadingStartedAt = Date.now();
			if (period !== "realtime") setIsLoadingNetwork(true);
			try {
				const [uploadResponse, downloadResponse] = await Promise.all([
					fetchServerMetrics(data.id, "net_out_speed", requestPeriod),
					fetchServerMetrics(data.id, "net_in_speed", requestPeriod),
				]);

				if (uploadResponse.success && uploadResponse.data?.data_points) {
					const downloadMap = new Map<number, number>();
					if (downloadResponse.success && downloadResponse.data?.data_points) {
						for (const point of downloadResponse.data.data_points) {
							downloadMap.set(point.ts, bytesPerSecondToMbps(point.value));
						}
					}

					const combinedData = uploadResponse.data.data_points
						.map((point) => ({
							timeStamp: point.ts.toString(),
							upload: bytesPerSecondToMbps(point.value),
							download: downloadMap.get(point.ts) || 0,
						}))
						.slice(period === "realtime" ? -30 : undefined);
					if (!cancelled) {
						setNetworkHistoricalData(combinedData);
					}
				}
			} catch (error) {
				console.error("Failed to fetch network metrics:", error);
			} finally {
				const elapsed = Date.now() - loadingStartedAt;
				if (period !== "realtime" && elapsed < MIN_HISTORY_LOADING_MS) {
					await sleep(MIN_HISTORY_LOADING_MS - elapsed);
				}
				if (!cancelled) {
					setIsLoadingNetwork(false);
					setLoadedPeriodNetwork(period);
				}
			}
		};

		fetchNetworkData();
		return () => {
			cancelled = true;
		};
	}, [data.id, period, persistentMetricsEnabled]);

	useEffect(() => {
		if (
			period === "realtime" &&
			networkHistoricalData.length &&
			!hasInitialized.current
		) {
			setNetworkChartData(networkHistoricalData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [networkHistoricalData, period]);

	// 初始化历史数据
	useEffect(() => {
		if (
			period === "realtime" &&
			!hasInitialized.current &&
			messageHistory.length > 0
		) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { up, down } = formatNezhaInfo(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						upload: up,
						download: down,
					};
				})
				.filter((item): item is networkChartData => item !== null)
				.reverse();

			setNetworkChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// Reset when switching to realtime
	useEffect(() => {
		if (period !== "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 修改实时数据更新逻辑
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = Date.now().toString();
			setNetworkChartData((prevData) => {
				let newData = [] as networkChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, upload: up, download: down },
						{ timeStamp: timestamp, upload: up, download: down },
					];
				} else {
					newData = [
						...prevData,
						{ timeStamp: timestamp, upload: up, download: down },
					];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [data, historyLoaded, down, up, period]);

	const displayData =
		period === "realtime" ? networkChartData : networkHistoricalData;
	const isNetworkLoading =
		period !== "realtime" &&
		(isLoadingNetwork || loadedPeriodNetwork !== period);

	let maxDownload = Math.max(...displayData.map((item) => item.download));
	maxDownload = Math.ceil(maxDownload);
	if (maxDownload < 1) {
		maxDownload = 1;
	}

	const chartConfig = {
		upload: {
			label: "Upload",
		},
		download: {
			label: "Download",
		},
	} satisfies ChartConfig;

	return (
		<MetricCard
			title={t("serverDetailChart.network")}
			type="network"
			legend={
				<>
					<LegendItem
						color="hsl(var(--chart-1))"
						label={t("serverDetailChart.upload")}
						value={formatMbps(up)}
					/>
					<LegendItem
						color="hsl(var(--chart-2))"
						label={t("serverDetailChart.download")}
						value={formatMbps(down)}
					/>
				</>
			}
		>
			<ChartContainer
				config={chartConfig}
				className="aspect-auto h-[130px] w-full"
			>
				{isNetworkLoading ? (
					<ChartSkeleton />
				) : (
					<LineChart
						syncId="serverDetailCharts"
						accessibilityLayer
						data={displayData}
						margin={{
							top: 12,
							left: 12,
							right: 12,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="timeStamp"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={200}
							interval="preserveStartEnd"
							tickFormatter={(value) => formatRelativeTime(value)}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							mirror={true}
							tickMargin={-15}
							type="number"
							minTickGap={50}
							interval="preserveStartEnd"
							domain={[1, maxDownload]}
							tickFormatter={(value) => formatMbps(Number(value))}
						/>
						<ChartTooltip
							isAnimationActive={false}
							content={
								<ChartTooltipContent
									indicator="dot"
									labelFormatter={(_, payload) => {
										return formatTime(Number(payload[0]?.payload?.timeStamp));
									}}
									formatter={(value, name) => {
										const label =
											name === "upload"
												? t("serverDetailChart.upload")
												: t("serverDetailChart.download");
										return (
											<div className="flex flex-1 items-center justify-between leading-none">
												<span className="text-muted-foreground">{label}</span>
												<span className="ml-2 font-medium text-foreground tabular-nums">
													{formatMbps(Number(value))}
												</span>
											</div>
										);
									}}
								/>
							}
						/>
						<Line
							isAnimationActive={false}
							dataKey="upload"
							type="linear"
							stroke="hsl(var(--chart-1))"
							strokeWidth={1.5}
							dot={false}
						/>
						<Line
							isAnimationActive={false}
							dataKey="download"
							type="linear"
							stroke="hsl(var(--chart-2))"
							strokeWidth={1.5}
							dot={false}
						/>
					</LineChart>
				)}
			</ChartContainer>
		</MetricCard>
	);
}

function ConnectChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const persistentMetricsEnabled = useContext(PersistentMetricsContext);
	const [connectChartData, setConnectChartData] = useState(
		[] as connectChartData[],
	);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const { t } = useTranslation();
	const { tcp, udp } = formatNezhaInfo(now, data);

	// For connections, we fetch TCP and UDP separately and combine them
	const [connectHistoricalData, setConnectHistoricalData] = useState<
		connectChartData[]
	>([]);
	const [isLoadingConnect, setIsLoadingConnect] = useState(false);
	const [loadedPeriodConnect, setLoadedPeriodConnect] =
		useState<ChartPeriod>("realtime");

	useEffect(() => {
		let cancelled = false;
		if (period === "realtime" && !persistentMetricsEnabled) return;

		const requestPeriod: MetricPeriod = period === "realtime" ? "1d" : period;

		const fetchConnectData = async () => {
			const loadingStartedAt = Date.now();
			if (period !== "realtime") setIsLoadingConnect(true);
			try {
				const [tcpResponse, udpResponse] = await Promise.all([
					fetchServerMetrics(data.id, "tcp_conn", requestPeriod),
					fetchServerMetrics(data.id, "udp_conn", requestPeriod),
				]);

				if (tcpResponse.success && tcpResponse.data?.data_points) {
					const udpMap = new Map<number, number>();
					if (udpResponse.success && udpResponse.data?.data_points) {
						for (const point of udpResponse.data.data_points) {
							udpMap.set(point.ts, point.value);
						}
					}

					const combinedData = tcpResponse.data.data_points
						.map((point) => ({
							timeStamp: point.ts.toString(),
							tcp: point.value,
							udp: udpMap.get(point.ts) || 0,
						}))
						.slice(period === "realtime" ? -30 : undefined);
					if (!cancelled) {
						setConnectHistoricalData(combinedData);
					}
				}
			} catch (error) {
				console.error("Failed to fetch connection metrics:", error);
			} finally {
				const elapsed = Date.now() - loadingStartedAt;
				if (period !== "realtime" && elapsed < MIN_HISTORY_LOADING_MS) {
					await sleep(MIN_HISTORY_LOADING_MS - elapsed);
				}
				if (!cancelled) {
					setIsLoadingConnect(false);
					setLoadedPeriodConnect(period);
				}
			}
		};

		fetchConnectData();
		return () => {
			cancelled = true;
		};
	}, [data.id, period, persistentMetricsEnabled]);

	useEffect(() => {
		if (
			period === "realtime" &&
			connectHistoricalData.length &&
			!hasInitialized.current
		) {
			setConnectChartData(connectHistoricalData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [connectHistoricalData, period]);

	// 初始化历史数据
	useEffect(() => {
		if (
			period === "realtime" &&
			!hasInitialized.current &&
			messageHistory.length > 0
		) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { tcp, udp } = formatNezhaInfo(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						tcp,
						udp,
					};
				})
				.filter((item): item is connectChartData => item !== null)
				.reverse();

			setConnectChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// Reset when switching to realtime
	useEffect(() => {
		if (period !== "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 修改实时数据更新逻辑
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = Date.now().toString();
			setConnectChartData((prevData) => {
				let newData = [] as connectChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, tcp, udp },
						{ timeStamp: timestamp, tcp, udp },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, tcp, udp }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [data, historyLoaded, tcp, udp, period]);

	const chartConfig = {
		tcp: {
			label: "TCP",
		},
		udp: {
			label: "UDP",
		},
	} satisfies ChartConfig;

	const displayData =
		period === "realtime" ? connectChartData : connectHistoricalData;
	const isConnectLoading =
		period !== "realtime" &&
		(isLoadingConnect || loadedPeriodConnect !== period);

	return (
		<MetricCard
			title={t("serverDetailChart.connections")}
			type="connection"
			legend={
				<>
					<LegendItem color="hsl(var(--chart-1))" label="TCP" value={tcp} />
					<LegendItem color="hsl(var(--chart-2))" label="UDP" value={udp} />
				</>
			}
		>
			<ChartContainer
				config={chartConfig}
				className="aspect-auto h-[130px] w-full"
			>
				{isConnectLoading ? (
					<ChartSkeleton />
				) : (
					<LineChart
						syncId="serverDetailCharts"
						accessibilityLayer
						data={displayData}
						margin={{
							top: 12,
							left: 12,
							right: 12,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="timeStamp"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={200}
							interval="preserveStartEnd"
							tickFormatter={(value) => formatRelativeTime(value)}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							mirror={true}
							tickMargin={-15}
							type="number"
							interval="preserveStartEnd"
						/>
						<ChartTooltip
							isAnimationActive={false}
							content={
								<ChartTooltipContent
									indicator="dot"
									labelFormatter={(_, payload) => {
										return formatTime(Number(payload[0]?.payload?.timeStamp));
									}}
									formatter={(value, name) => {
										const label = name === "tcp" ? "TCP" : "UDP";
										return (
											<div className="flex flex-1 items-center justify-between leading-none">
												<span className="text-muted-foreground">{label}</span>
												<span className="ml-2 font-medium text-foreground tabular-nums">
													{Number(value).toFixed(0)}
												</span>
											</div>
										);
									}}
								/>
							}
						/>
						<Line
							isAnimationActive={false}
							dataKey="tcp"
							type="linear"
							stroke="hsl(var(--chart-1))"
							strokeWidth={1.5}
							dot={false}
						/>
						<Line
							isAnimationActive={false}
							dataKey="udp"
							type="linear"
							stroke="hsl(var(--chart-2))"
							strokeWidth={1.5}
							dot={false}
						/>
					</LineChart>
				)}
			</ChartContainer>
		</MetricCard>
	);
}
