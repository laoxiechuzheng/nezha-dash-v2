import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchService } from "@/lib/nezha-api";
import type { NezhaServer, ServiceData } from "@/types/nezha-api";

import { CycleTransferStatsCard } from "./CycleTransferStats";
import { Loader } from "./loading/Loader";
import ServiceTrackerClient from "./ServiceTrackerClient";

function processServiceData(serviceData: ServiceData) {
	const days = serviceData.up.map((up, index) => {
		const totalChecks = up + serviceData.down[index];
		const dailyUptime = totalChecks > 0 ? (up / totalChecks) * 100 : 0;
		return {
			completed: up > serviceData.down[index],
			hasData: totalChecks > 0,
			date: new Date(Date.now() - (29 - index) * 24 * 60 * 60 * 1000),
			uptime: dailyUptime,
			delay: serviceData.delay[index] || 0,
		};
	});

	const totalUp = serviceData.up.reduce((a, b) => a + b, 0);
	const totalChecks =
		serviceData.up.reduce((a, b) => a + b, 0) +
		serviceData.down.reduce((a, b) => a + b, 0);
	const uptime = totalChecks > 0 ? (totalUp / totalChecks) * 100 : 0;

	const measuredDelays = serviceData.delay.filter((delay) => delay > 0);
	const avgDelay =
		measuredDelays.length > 0
			? measuredDelays.reduce((a, b) => a + b, 0) / measuredDelays.length
			: 0;

	const currentStatus: "healthy" | "degraded" | "unknown" =
		serviceData.current_up + serviceData.current_down === 0
			? "unknown"
			: serviceData.current_down > 0
				? "degraded"
				: "healthy";

	return { days, uptime, avgDelay, currentStatus };
}

export function ServiceTracker({ serverList }: { serverList: NezhaServer[] }) {
	const { t } = useTranslation();
	const { data: serviceData, isLoading } = useQuery({
		queryKey: ["service"],
		queryFn: () => fetchService(),
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		refetchInterval: 10000,
		retry: false,
	});

	const serviceSummaries = useMemo(() => {
		return Object.entries(serviceData?.data?.services ?? {}).map(
			([name, data]) => ({
				...processServiceData(data),
				name,
				title: data.service_name,
			}),
		);
	}, [serviceData?.data?.services]);
	const [onlyUnhealthy, setOnlyUnhealthy] = useState(false);
	const visibleServices = onlyUnhealthy
		? serviceSummaries.filter((service) => service.currentStatus !== "healthy")
		: serviceSummaries;
	const healthyCount = serviceSummaries.filter(
		(service) => service.currentStatus === "healthy",
	).length;
	const averageUptime = serviceSummaries.length
		? serviceSummaries.reduce((total, service) => total + service.uptime, 0) /
			serviceSummaries.length
		: 0;

	if (isLoading) {
		return (
			<div className="mt-4 text-sm font-medium flex items-center gap-1">
				<Loader visible={true} />
				{t("serviceTracker.loading")}
			</div>
		);
	}

	if (
		!serviceData?.data?.services &&
		!serviceData?.data?.cycle_transfer_stats
	) {
		return (
			<div className="mt-4 text-sm font-medium flex items-center gap-1">
				<ExclamationTriangleIcon className="w-4 h-4" />
				{t("serviceTracker.noService")}
			</div>
		);
	}

	return (
		<div className="mt-4 w-full mx-auto ">
			{serviceData.data.cycle_transfer_stats && (
				<div>
					<CycleTransferStatsCard
						serverList={serverList}
						cycleStats={serviceData.data.cycle_transfer_stats}
					/>
				</div>
			)}
			{serviceSummaries.length > 0 && (
				<>
					<section className="glass-panel mt-4 flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
						<div>
							<p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
								服务运行中心
							</p>
							<h2 className="mt-1 text-lg font-black tracking-tight">
								{healthyCount === serviceSummaries.length
									? "全部服务运行正常"
									: `${serviceSummaries.length - healthyCount} 项服务需要关注`}
							</h2>
						</div>
						<div className="grid grid-cols-3 gap-2">
							<div className="rounded-xl border border-slate-200/70 bg-white/50 px-3 py-2 text-center dark:border-white/8 dark:bg-white/[0.03]">
								<b className="block text-lg tabular-nums">
									{serviceSummaries.length}
								</b>
								<span className="text-[10px] text-muted-foreground">
									监控服务
								</span>
							</div>
							<div className="rounded-xl border border-emerald-500/15 bg-emerald-500/7 px-3 py-2 text-center">
								<b className="block text-lg text-emerald-600 tabular-nums dark:text-emerald-300">
									{healthyCount}
								</b>
								<span className="text-[10px] text-muted-foreground">
									健康服务
								</span>
							</div>
							<div className="rounded-xl border border-sky-500/15 bg-sky-500/7 px-3 py-2 text-center">
								<b className="block text-lg text-sky-600 tabular-nums dark:text-sky-300">
									{averageUptime.toFixed(1)}%
								</b>
								<span className="text-[10px] text-muted-foreground">
									平均可用率
								</span>
							</div>
						</div>
						<button
							type="button"
							aria-pressed={onlyUnhealthy}
							onClick={() => setOnlyUnhealthy((value) => !value)}
							className="rounded-full border border-slate-200/80 bg-white/65 px-3 py-2 text-xs font-semibold shadow-sm transition hover:border-rose-400/40 hover:text-rose-600 dark:border-white/10 dark:bg-white/5"
						>
							{onlyUnhealthy ? "查看全部" : "仅看异常"}
						</button>
					</section>
					<section className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
						{visibleServices.map(
							({ avgDelay, currentStatus, days, name, title, uptime }) => (
								<ServiceTrackerClient
									key={name}
									days={days}
									title={title}
									uptime={uptime}
									avgDelay={avgDelay}
									currentStatus={currentStatus}
								/>
							),
						)}
					</section>
				</>
			)}
		</div>
	);
}

export default ServiceTracker;
