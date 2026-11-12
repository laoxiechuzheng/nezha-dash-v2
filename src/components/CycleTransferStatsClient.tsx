import type React from "react";
import { useTranslation } from "react-i18next";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CycleTransferStatsClientProps {
	name: string;
	from: string;
	to: string;
	max: number;
	serverStats: Array<{
		serverId: string;
		serverName: string;
		transfer: number;
		nextUpdate: string;
	}>;
	className?: string;
}

export const CycleTransferStatsClient: React.FC<
	CycleTransferStatsClientProps
> = ({ name, from, to, max, serverStats, className }) => {
	const { t } = useTranslation();
	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;
	return (
		<div
			className={cn(
				"w-full rounded-lg border border-border bg-card px-4 py-3.5 text-card-foreground",
				className,
				{
					"bg-card/80": customBackgroundImage,
				},
			)}
		>
			{serverStats.map(({ serverId, serverName, transfer, nextUpdate }) => {
				const progress = (transfer / max) * 100;
				const level = progress >= 90 ? "bad" : progress >= 70 ? "warn" : "good";

				return (
					<div key={serverId} className="space-y-2.5">
						<div className="flex items-center justify-between gap-3">
							<span className="truncate text-[13px] font-medium">
								{serverName}
							</span>
							<span className="inline-flex h-5 shrink-0 items-center rounded-[4px] bg-muted px-1.5 text-[11px] font-medium text-muted-foreground dark:bg-foreground/[0.06]">
								{name}
							</span>
						</div>

						<div className="space-y-1.5">
							<div className="flex items-baseline justify-between gap-2 tabular-nums">
								<div className="flex items-baseline gap-1">
									<span className="text-base font-semibold">
										{formatBytes(transfer)}
									</span>
									<span className="text-xs text-muted-foreground">
										/ {formatBytes(max)}
									</span>
								</div>
								<span
									data-level={level}
									className={cn(
										"text-xs font-medium",
										level === "warn" && "text-warning",
										level === "bad" && "text-danger",
									)}
								>
									{progress.toFixed(1)}%
								</span>
							</div>

							<div className="relative h-1 overflow-hidden rounded-[2px] bg-muted dark:bg-foreground/10">
								<div
									className={cn(
										"absolute inset-y-0 left-0 rounded-[2px] transition-[width] duration-150",
										level === "good" && "bg-primary",
										level === "warn" && "bg-warning",
										level === "bad" && "bg-danger",
									)}
									style={{ width: `${Math.min(progress, 100)}%` }}
								/>
							</div>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
							<span>
								{new Date(from).toLocaleDateString()} -{" "}
								{new Date(to).toLocaleDateString()}
							</span>
							<span>
								{t("cycleTransfer.nextUpdate")}:{" "}
								{new Date(nextUpdate).toLocaleString()}
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
};

export default CycleTransferStatsClient;
