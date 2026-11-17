export default function ChartSkeleton({
	width,
	height,
}: {
	width?: number | string;
	height?: number | string;
}) {
	const resolvedWidth = typeof width === "number" ? `${width}px` : width;
	const resolvedHeight = typeof height === "number" ? `${height}px` : height;

	return (
		<div
			className="shimmer h-full w-full rounded-[10px]"
			style={{
				width: resolvedWidth || "100%",
				height: resolvedHeight || "100%",
			}}
		>
			<div className="absolute inset-0 flex items-center justify-center">
				<div className="size-4 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/70 animate-spin" />
			</div>
		</div>
	);
}
