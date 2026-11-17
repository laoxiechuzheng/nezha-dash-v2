import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { BackIcon } from "../Icon";

export function ServerDetailChartLoading() {
	return (
		<section className="dt-chart-grid dt-loading-grid" aria-busy="true">
			{Array.from({ length: 6 }, (_, index) => (
				<div
					key={index}
					className="surface dt-loading-card"
					data-detail-skeleton="metric"
				>
					<div className="flex items-center justify-between gap-4">
						<Skeleton className="h-7 w-24" />
						<Skeleton className="h-8 w-20" />
					</div>
					<Skeleton className="h-3 w-36" />
					<div className="dt-metric-plot" />
				</div>
			))}
		</section>
	);
}

export function ServerDetailLoading() {
	const navigate = useNavigate();
	const { t } = useTranslation();
	return (
		<div className="dt-loading" aria-busy="true">
			<button
				type="button"
				onClick={() => navigate("/")}
				className="dt-title-link w-fit"
				aria-label={t("serverDetail.back")}
			>
				<span className="dt-back">
					<BackIcon />
				</span>
				<Skeleton className="h-6 w-40" />
			</button>
			<div className="surface-stage dt-loading-identity">
				<div className="dt-identity-main">
					<div className="dt-hardware">
						<div className="dt-platform-row">
							<Skeleton className="size-11 rounded-[14px]" />
							<Skeleton className="h-5 w-36" />
						</div>
						<Skeleton className="h-3 w-full max-w-64" />
						<Skeleton className="h-5 w-16" />
					</div>
					<div className="dt-spec-grid">
						{Array.from({ length: 6 }, (_, index) => (
							<div key={index} className="dt-fact">
								<Skeleton className="h-3 w-12" />
								<Skeleton className="h-5 w-20 max-w-full" />
							</div>
						))}
					</div>
				</div>
				<div className="dt-identity-times">
					<Skeleton className="h-3 w-60 max-w-full" />
				</div>
			</div>
		</div>
	);
}
