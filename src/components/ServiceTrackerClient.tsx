import type React from "react";
import { useTranslation } from "react-i18next";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ServiceTrackerProps {
	days: Array<{
		completed: boolean;
		hasData?: boolean;
		date?: Date;
		uptime: number;
		delay: number;
	}>;
	className?: string;
	title?: string;
	uptime?: number;
	avgDelay?: number;
	currentStatus?: "healthy" | "degraded" | "unknown";
}

type Level = "good" | "warn" | "bad";

/** Uptime severity: >= 99% good, >= 95% warning, otherwise bad. */
const getUptimeLevel = (uptime: number): Level => {
	if (uptime >= 99) return "good";
	if (uptime >= 95) return "warn";
	return "bad";
};

/** Latency severity: < 100ms good, < 300ms warning, otherwise bad. */
const getDelayLevel = (delay: number): Level => {
	if (delay < 100) return "good";
	if (delay < 300) return "warn";
	return "bad";
};

const levelText: Record<Level, string> = {
	good: "text-success",
	warn: "text-warning",
	bad: "text-danger",
};

const levelFill: Record<Level, string> = {
	good: "bg-success",
	warn: "bg-warning",
	bad: "bg-danger",
};

export const ServiceTrackerClient: React.FC<ServiceTrackerProps> = ({
	days,
	className,
	title,
	uptime = 100,
	avgDelay = 0,
	currentStatus = "unknown",
}) => {
	const { t } = useTranslation();
	const uptimeLevel = getUptimeLevel(uptime);
	const delayLevel = getDelayLevel(avgDelay);

	const incidentDays = days.filter(
		(day) => day.hasData !== false && day.uptime < 99,
	).length;
	const statusLabel =
		currentStatus === "healthy"
			? t("serviceTracker.statusHealthy")
			: currentStatus === "degraded"
				? t("serviceTracker.statusDegraded")
				: t("serviceTracker.statusUnknown");

	return (
		<div
			className={cn(
				"flex flex-col gap-2.5 px-4 py-3 lg:flex-row lg:items-center lg:gap-8",
				className,
			)}
		>
			<div className="flex min-w-0 items-start justify-between gap-3 lg:w-[40%] lg:shrink-0">
				<div className="flex min-w-0 items-start gap-2.5">
					<span
						className="status-dot mt-[5px]"
						data-status={currentStatus}
						aria-hidden="true"
					/>
					<div className="min-w-0">
						<span className="block truncate text-[13px] font-medium">
							{title}
						</span>
						<span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
							<span
								className={cn(currentStatus === "degraded" && "text-danger")}
							>
								{statusLabel}
							</span>
							{" · "}
							{incidentDays
								? t("serviceTracker.incidentDays", { count: incidentDays })
								: t("serviceTracker.noIncident")}
						</span>
					</div>
				</div>
				<div className="flex shrink-0 flex-col items-end gap-0.5 text-xs tabular-nums sm:flex-row sm:items-center sm:gap-4">
					<span
						data-level={uptimeLevel}
						className={cn("font-medium", levelText[uptimeLevel])}
					>
						{uptime.toFixed(1)}% {t("serviceTracker.uptime")}
					</span>
					<span
						data-level={delayLevel}
						className={cn("font-medium", levelText[delayLevel])}
					>
						{avgDelay.toFixed(0)}ms
					</span>
				</div>
			</div>

			<div className="min-w-0 flex-1">
				<div
					className="flex h-6 items-stretch gap-[3px]"
					role="img"
					aria-label={t("serviceTracker.timelineLabel")}
				>
					{days.map((day, index) => {
						const dayLevel =
							day.hasData === false ? null : getUptimeLevel(day.uptime);
						return (
							<TooltipProvider delayDuration={50} key={index}>
								<Tooltip>
									<TooltipTrigger asChild>
										<div
											data-level={dayLevel ?? "none"}
											className={cn(
												"min-w-0 flex-1 cursor-help rounded-[2px] transition-opacity duration-150 hover:opacity-70",
												dayLevel
													? levelFill[dayLevel]
													: "bg-muted dark:bg-foreground/[0.08]",
											)}
										/>
									</TooltipTrigger>
									<TooltipContent className="p-0">
										<div className="px-3 py-2">
											<p className="mb-1.5 text-xs font-medium">
												{day.date?.toLocaleDateString()}
											</p>
											<div className="space-y-1">
												<div className="flex items-center justify-between gap-4">
													<span className="text-xs text-muted-foreground">
														{t("serviceTracker.uptime")}
													</span>
													<span
														className={cn(
															"text-xs font-medium tabular-nums",
															day.uptime > 95 ? "text-success" : "text-danger",
														)}
													>
														{day.uptime.toFixed(1)}%
													</span>
												</div>
												<div className="flex items-center justify-between gap-4">
													<span className="text-xs text-muted-foreground">
														{t("serviceTracker.delay")}
													</span>
													<span
														className={cn(
															"text-xs font-medium tabular-nums",
															levelText[getDelayLevel(day.delay)],
														)}
													>
														{day.delay.toFixed(0)}ms
													</span>
												</div>
											</div>
										</div>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						);
					})}
				</div>
				<div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
					<span>30 {t("serviceTracker.daysAgo")}</span>
					<span>{t("serviceTracker.today")}</span>
				</div>
			</div>
		</div>
	);
};

export default ServiceTrackerClient;
