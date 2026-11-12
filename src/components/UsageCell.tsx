import ServerUsageBar, { getUsageLevel } from "@/components/ServerUsageBar";
import { cn } from "@/lib/utils";

/** Label + tabular percentage above a threshold-colored usage bar. */
export default function UsageCell({
	label,
	value,
	className,
	labelClassName,
	valueRowClassName,
}: {
	label: string;
	value: number;
	className?: string;
	labelClassName?: string;
	valueRowClassName?: string;
}) {
	const level = getUsageLevel(value);

	return (
		<div className={cn("min-w-0", className)}>
			<div
				className={cn(
					"flex items-baseline justify-between gap-1.5",
					valueRowClassName,
				)}
			>
				<span
					className={cn(
						"truncate text-xs text-muted-foreground",
						labelClassName,
					)}
				>
					{label}
				</span>
				<span
					data-level={level}
					className={cn(
						"whitespace-nowrap text-[13px] font-medium tabular-nums",
						level === "warn" && "text-warning",
						level === "bad" && "text-danger",
					)}
				>
					{value.toFixed(2)}%
				</span>
			</div>
			<ServerUsageBar value={value} className="mt-1.5" />
		</div>
	);
}
