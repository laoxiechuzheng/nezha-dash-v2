import type React from "react";
import { useTranslation } from "react-i18next";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { Separator } from "./ui/separator";

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

export const ServiceTrackerClient: React.FC<ServiceTrackerProps> = ({
	days,
	className,
	title,
	uptime = 100,
	avgDelay = 0,
	currentStatus = "unknown",
}) => {
	const { t } = useTranslation();
	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const getUptimeColor = (uptime: number) => {
		if (uptime >= 99) return "text-emerald-500";
		if (uptime >= 95) return "text-amber-500";
		return "text-rose-500";
	};

	const getDelayColor = (delay: number) => {
		if (delay < 100) return "text-emerald-500";
		if (delay < 300) return "text-amber-500";
		return "text-rose-500";
	};

	const incidentDays = days.filter(
		(day) => day.hasData !== false && day.uptime < 99,
	).length;
	const statusLabel =
		currentStatus === "healthy"
			? "当前正常"
			: currentStatus === "degraded"
				? "当前异常"
				: "等待采样";

	return (
		<div
			className={cn(
				"glass-panel w-full space-y-4 rounded-2xl px-4 py-4 text-card-foreground sm:px-5",
				className,
				{
					"bg-card/70": customBackgroundImage,
				},
			)}
		>
			<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
				<div className="flex items-center gap-2">
					<div
						className={cn(
							"w-2.5 h-2.5 rounded-full transition-colors",
							currentStatus === "healthy"
								? "bg-emerald-500"
								: currentStatus === "degraded"
									? "bg-rose-500"
									: "bg-slate-400",
						)}
					/>
					<div>
						<span className="block text-sm font-bold">{title}</span>
						<span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
							{statusLabel} · 过去 30 天 ·{" "}
							{incidentDays ? `${incidentDays} 天发生异常` : "无异常记录"}
						</span>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2 sm:gap-3">
					<span
						className={cn(
							"font-medium text-sm transition-colors",
							getDelayColor(avgDelay),
						)}
					>
						{avgDelay.toFixed(0)}ms
					</span>
					<Separator className="h-4" orientation="vertical" />
					<span
						className={cn(
							"font-medium text-sm transition-colors",
							getUptimeColor(uptime),
						)}
					>
						{uptime.toFixed(1)}% {t("serviceTracker.uptime")}
					</span>
				</div>
			</div>

			<div
				className="flex gap-1 rounded-xl border border-white/60 bg-white/35 p-1.5 dark:border-white/5 dark:bg-white/[0.025]"
				role="img"
				aria-label="30 天服务可用性时间线"
			>
				{days.map((day, index) => (
					<TooltipProvider delayDuration={50} key={index}>
						<Tooltip>
							<TooltipTrigger asChild>
								<div
									className={cn(
										"relative flex-1 h-7 rounded-[8px] transition-all duration-200 cursor-help",
										"before:absolute before:inset-0 before:rounded-[4px] before:opacity-0 hover:before:opacity-100 before:bg-white/10 before:transition-opacity",
										"after:absolute after:inset-0 after:rounded-[4px] after:shadow-[inset_0_1px_--theme(--color-white/10%)]",
										day.hasData === false
											? "bg-slate-300 dark:bg-slate-700"
											: day.uptime >= 99
												? "bg-linear-to-b from-emerald-400 to-emerald-600 shadow-[0_1px_2px_--theme(--color-green-600/30%)]"
												: day.uptime >= 95
													? "bg-linear-to-b from-amber-400 to-amber-500"
													: "bg-linear-to-b from-rose-400 to-rose-600",
									)}
								/>
							</TooltipTrigger>
							<TooltipContent className="p-0 overflow-hidden rounded-[10px]">
								<div className="px-3 py-2 bg-popover">
									<p className="font-medium text-sm mb-2">
										{day.date?.toLocaleDateString()}
									</p>
									<div className="space-y-1.5">
										<div className="flex items-center justify-between gap-3">
											<span className="text-xs text-muted-foreground">
												{t("serviceTracker.uptime")}:
											</span>
											<span
												className={cn(
													"text-xs font-medium",
													day.uptime > 95 ? "text-green-500" : "text-red-500",
												)}
											>
												{day.uptime.toFixed(1)}%
											</span>
										</div>
										<div className="flex items-center justify-between gap-3">
											<span className="text-xs text-muted-foreground">
												{t("serviceTracker.delay")}:
											</span>
											<span
												className={cn(
													"text-xs font-medium",
													day.delay < 100
														? "text-green-500"
														: day.delay < 300
															? "text-yellow-500"
															: "text-red-500",
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
				))}
			</div>

			<div className="flex justify-between text-xs text-stone-500 dark:text-stone-400">
				<span>30 {t("serviceTracker.daysAgo")}</span>
				<span>{t("serviceTracker.today")}</span>
			</div>
		</div>
	);
};

export default ServiceTrackerClient;
