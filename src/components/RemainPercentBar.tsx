import { cn } from "@/lib/utils";

import { Progress } from "./ui/progress";

/** Remaining billing period: below 30% is critical, below 70% warns. */
const getRemainLevel = (value: number) =>
	value < 30 ? "bad" : value < 70 ? "warn" : "good";

const indicatorByLevel = {
	bad: "bg-danger",
	warn: "bg-warning",
	good: "bg-success",
} as const;

export default function RemainPercentBar({
	value,
	className,
}: {
	value: number;
	className?: string;
}) {
	const level = getRemainLevel(value);

	return (
		<Progress
			aria-label={"Server Usage Bar"}
			aria-labelledby={"Server Usage Bar"}
			value={value}
			data-level={level}
			indicatorClassName={indicatorByLevel[level]}
			className={cn("h-1 w-[70px]", className)}
		/>
	);
}
