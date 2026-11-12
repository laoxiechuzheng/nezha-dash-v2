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
			className="scrollbar-hidden flex min-w-0 max-w-full overflow-x-auto overscroll-x-contain"
		>
			<div
				ref={containerRef}
				data-indicator="true"
				className={cn("segmented relative flex items-center", {
					"bg-card/80": customBackgroundImage,
				})}
			>
				{indicator && (
					<div
						className="active-indicator-fade-in absolute left-0 top-0 z-0 rounded-[5px] bg-muted dark:bg-foreground/[0.08]"
						style={{
							height: indicator.height,
							transform: `translate(${indicator.x}px, ${indicator.y}px)`,
							transition: indicator.shouldAnimate
								? "transform 0.16s ease-out, width 0.16s ease-out, height 0.16s ease-out"
								: "none",
							width: indicator.width,
						}}
					/>
				)}
				{tabs.map((tab: string, index: number) => (
					<button
						type="button"
						key={tab}
						ref={setItemRef(index)}
						aria-pressed={currentTab === tab}
						onClick={() => {
							if (currentTab !== tab) {
								enableIndicatorAnimation();
							}
							setCurrentTab(tab);
						}}
						className="relative z-10"
					>
						{tab === "All" ? t("group.all", { defaultValue: "All" }) : tab}
					</button>
				))}
			</div>
		</div>
	);
}
