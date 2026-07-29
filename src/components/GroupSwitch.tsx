import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useActiveIndicator } from "@/hooks/use-active-indicator";
import { cn } from "@/lib/utils";

export default function GroupSwitch({
	tabs,
	currentTab,
	setCurrentTab,
}: {
	tabs: string[];
	currentTab: string;
	setCurrentTab: (tab: string) => void;
}) {
	const { t } = useTranslation();
	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const scrollRef = useRef<HTMLDivElement>(null);
	const {
		containerRef,
		enableIndicatorAnimation,
		indicator,
		itemRefs,
		setItemRef,
	} = useActiveIndicator(tabs, currentTab);

	useEffect(() => {
		const container = scrollRef.current;
		if (!container) return;

		const isOverflowing = container.scrollWidth > container.clientWidth;
		if (!isOverflowing) return;

		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			container.scrollLeft += e.deltaY;
		};

		container.addEventListener("wheel", onWheel, { passive: false });

		return () => {
			container.removeEventListener("wheel", onWheel);
		};
	}, []);

	useEffect(() => {
		if (tabs.length === 1 && tabs[0] === "All") {
			setCurrentTab("All");
			return;
		}
		const savedGroup = sessionStorage.getItem("selectedGroup");
		if (savedGroup && tabs.includes(savedGroup)) {
			setCurrentTab(savedGroup);
		}
	}, [tabs, setCurrentTab]);

	useEffect(() => {
		const currentTagRef = itemRefs.current[tabs.indexOf(currentTab)];
		const scrollContainer = scrollRef.current;

		if (currentTagRef && scrollContainer) {
			const nextScrollLeft =
				currentTagRef.offsetLeft -
				scrollContainer.clientWidth / 2 +
				currentTagRef.offsetWidth / 2;

			if (typeof scrollContainer.scrollTo === "function") {
				scrollContainer.scrollTo({
					behavior: "smooth",
					left: Math.max(0, nextScrollLeft),
				});
			} else {
				scrollContainer.scrollLeft = Math.max(0, nextScrollLeft);
			}
		}
	}, [currentTab, itemRefs, tabs]);

	if (tabs.length === 1 && tabs[0] === "All") {
		return null;
	}

	return (
		<div
			ref={scrollRef}
			className="scrollbar-hidden z-50 flex min-w-0 flex-col items-start overflow-x-auto overscroll-x-contain rounded-2xl"
		>
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
							"relative cursor-pointer rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-all duration-300 ease-out hover:text-sky-700 hover:dark:text-sky-300",
							currentTab === tab
								? "text-black dark:text-white"
								: "text-stone-400 dark:text-stone-500",
						)}
					>
						<div className="relative z-20 flex items-center gap-1">
							<p className="whitespace-nowrap">
								{tab === "All" ? t("group.all", { defaultValue: "All" }) : tab}
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
