import { ChartBarIcon, SignalIcon } from "@heroicons/react/20/solid";
import { useTranslation } from "react-i18next";
import { useActiveIndicator } from "@/hooks/use-active-indicator";
import { cn } from "@/lib/utils";

export default function TabSwitch({
	tabs,
	currentTab,
	setCurrentTab,
}: {
	tabs: string[];
	currentTab: string;
	setCurrentTab: (tab: string) => void;
}) {
	const { t } = useTranslation();
	const { containerRef, enableIndicatorAnimation, indicator, setItemRef } =
		useActiveIndicator(tabs, currentTab);

	return (
		<div className="server-info-tab dt-tabs">
			<div
				ref={containerRef}
				role="tablist"
				className="relative -mb-px flex items-center gap-1"
			>
				{indicator && (
					<div
						aria-hidden="true"
						className="active-indicator-fade-in dt-tab-indicator"
						style={{
							transform: `translateX(${indicator.x}px)`,
							transition: indicator.shouldAnimate
								? "transform 220ms cubic-bezier(.3,.7,.2,1), width 220ms cubic-bezier(.3,.7,.2,1)"
								: "none",
							width: indicator.width,
						}}
					/>
				)}
				{tabs.map((tab: string, index: number) => {
					const selected = currentTab === tab;
					return (
						<button
							type="button"
							role="tab"
							aria-selected={selected}
							data-state={selected ? "active" : "inactive"}
							key={tab}
							ref={setItemRef(index)}
							onClick={() => {
								if (currentTab !== tab) {
									enableIndicatorAnimation();
								}
								setCurrentTab(tab);
							}}
							className={cn(
								"dt-tab relative flex h-10 cursor-pointer items-center gap-2 px-3 text-[13px] font-medium transition-colors duration-150",
								selected
									? "text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{tab === "Detail" ? (
								<ChartBarIcon className="size-4" aria-hidden="true" />
							) : (
								<SignalIcon className="size-4" aria-hidden="true" />
							)}
							<span className="whitespace-nowrap">{t(`tabSwitch.${tab}`)}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
