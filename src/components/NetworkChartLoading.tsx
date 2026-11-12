import { Loader } from "@/components/loading/Loader";
import { Skeleton } from "@/components/ui/skeleton";

export default function NetworkChartLoading() {
	return (
		<section
			className="network-chart-panel overflow-hidden rounded-lg border border-border bg-card"
			aria-busy="true"
		>
			<header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
				<div className="flex flex-col gap-2">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-3 w-36" />
				</div>
				<Loader visible={true} />
			</header>
			<div className="px-2 py-4 sm:px-4">
				<div className="aspect-auto h-[250px] w-full" />
			</div>
		</section>
	);
}
