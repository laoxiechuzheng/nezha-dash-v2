import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchService } from "@/lib/nezha-api";
import { cn } from "@/lib/utils";
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
	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;
	const averageUptime = serviceSummaries.length
		? serviceSummaries.reduce((total, service) => total + service.uptime, 0) /
			serviceSummaries.length
		: 0;

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 text-[13px] text-muted-foreground">
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
			<div className="flex items-center gap-2 text-[13px] text-muted-foreground">
				<ExclamationTriangleIcon className="size-4 text-warning" />
				{t("serviceTracker.noService")}
			</div>
		);
	}

	const attentionCount = serviceSummaries.length - healthyCount;

	return (
		<div className="flex w-full flex-col gap-3">
			{serviceData.data.cycle_transfer_stats && (
				<CycleTransferStatsCard
					serverList={serverList}
					cycleStats={serviceData.data.cycle_transfer_stats}
				/>
			)}
			{serviceSummaries.length > 0 && (
				<section
					className={cn(
						"overflow-hidden rounded-lg border border-border bg-card",
						{ "bg-card/85": customBackgroundImage },
					)}
				>
					<header className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
						<div className="min-w-0">
							<h2 className="text-sm font-semibold">
								{t("serviceTracker.title")}
							</h2>
							<p
								className={cn(
									"mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground",
									attentionCount > 0 && "text-warning",
								)}
							>
								<span
									className="status-dot"
									data-status={attentionCount > 0 ? "degraded" : "healthy"}
								/>
								{attentionCount === 0
									? t("serviceTracker.allHealthy")
									: t("serviceTracker.needsAttention", {
											count: attentionCount,
										})}
							</p>
						</div>
						<div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
							<dl className="flex items-center gap-5 text-xs">
								<div className="flex flex-col">
									<dt className="text-muted-foreground">
										{t("serviceTracker.monitored")}
									</dt>
									<dd className="text-base font-semibold tabular-nums">
										{serviceSummaries.length}
									</dd>
								</div>
								<div className="flex flex-col">
									<dt className="text-muted-foreground">
										{t("serviceTracker.healthy")}
									</dt>
									<dd className="text-base font-semibold text-success tabular-nums">
										{healthyCount}
									</dd>
								</div>
								<div className="flex flex-col">
									<dt className="text-muted-foreground">
										{t("serviceTracker.avgUptime")}
									</dt>
									<dd className="text-base font-semibold tabular-nums">
										{averageUptime.toFixed(1)}%
									</dd>
								</div>
							</dl>
							<button
								type="button"
								aria-pressed={onlyUnhealthy}
								onClick={() => setOnlyUnhealthy((value) => !value)}
								className={cn(
									"h-8 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
									onlyUnhealthy &&
										"border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
								)}
							>
								{onlyUnhealthy
									? t("serviceTracker.showAll")
									: t("serviceTracker.onlyIssues")}
							</button>
						</div>
					</header>
					{visibleServices.length === 0 ? (
						<p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
							{t("serviceTracker.noIssues")}
						</p>
					) : (
						<div className="divide-y divide-border">
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
						</div>
					)}
				</section>
			)}
		</div>
	);
}

export default ServiceTracker;
