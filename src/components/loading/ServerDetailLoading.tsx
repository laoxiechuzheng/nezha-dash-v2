import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

import { BackIcon } from "../Icon";

export function ServerDetailChartLoading() {
	return (
		<section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: 6 }, (_, index) => (
				<Skeleton
					key={index}
					className="h-[182px] w-full rounded-lg border border-border bg-card animate-none dark:bg-card"
				/>
			))}
		</section>
	);
}

export function ServerDetailLoading() {
	const navigate = useNavigate();

	return (
		<div className="flex w-full flex-col gap-4" aria-busy="true">
			<button
				type="button"
				onClick={() => {
					navigate("/");
				}}
				className="flex w-fit items-center gap-2.5"
			>
				<span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card [&_img]:mr-0! [&_img]:size-4">
					<BackIcon />
				</span>
				<Skeleton className="h-6 w-40" />
			</button>
			<div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4 lg:grid-cols-6">
				{Array.from({ length: 6 }, (_, index) => (
					<div key={index} className="flex flex-col gap-2 bg-card px-4 py-3">
						<Skeleton className="h-3 w-12" />
						<Skeleton className="h-4 w-20" />
					</div>
				))}
			</div>
		</div>
	);
}
