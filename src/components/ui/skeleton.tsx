import { cn } from "@/lib/utils";

function Skeleton({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"animate-pulse rounded-xl bg-gradient-to-r from-slate-200/65 via-white/80 to-slate-200/65 bg-[length:220%_100%] dark:from-white/5 dark:via-white/10 dark:to-white/5",
				className,
			)}
			{...props}
		/>
	);
}

export { Skeleton };
