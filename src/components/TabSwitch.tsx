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
	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;
	return (
		<div className="server-info-tab z-50 flex flex-col items-start rounded-2xl">
			<div
				ref={containerRef}
				className={cn(
					"glass-control relative flex items-center gap-1 rounded-2xl p-1",
					{
						"bg-stone-100/70 dark:bg-stone-800/70": customBackgroundImage,
					},
				)}
			>
				{indicator && (
					<div
						className="active-indicator-fade-in absolute left-0 top-0 z-10 content-center bg-gradient-to-br from-white to-sky-50 shadow-[0_8px_24px_-12px_rgba(14,165,233,0.65)] ring-1 ring-sky-500/15 dark:from-slate-700 dark:to-slate-800 dark:ring-white/10"
						style={{
							borderRadius: 46,
							height: indicator.height,
							transform: `translate(${indicator.x}px, ${indicator.y}px)`,
							transition: indicator.shouldAnimate
								? "transform 0.5s var(--timing), width 0.5s var(--timing), height 0.5s var(--timing)"
								: "none",
							width: indicator.width,
						}}
					/>
				)}
				{tabs.map((tab: string, index: number) => (
					<div
						key={tab}
						ref={setItemRef(index)}
						onClick={() => {
							if (currentTab !== tab) {
								enableIndicatorAnimation();
							}
							setCurrentTab(tab);
						}}
						className={cn(
							"relative cursor-pointer rounded-xl px-4 py-2 text-[13px] font-semibold transition-all duration-300 ease-out hover:text-sky-700 hover:dark:text-sky-300",
							currentTab === tab
								? "text-black dark:text-white"
								: "text-stone-400 dark:text-stone-500",
						)}
					>
						<div className="relative z-20 flex items-center gap-1">
							<p className="whitespace-nowrap">{t(`tabSwitch.${tab}`)}</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
