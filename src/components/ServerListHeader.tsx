import { useTranslation } from "react-i18next";

/** Column header for the list view; shares the `.server-row` grid template. */
export default function ServerListHeader() {
	const { t } = useTranslation();
	const cell = "truncate text-xs font-medium text-muted-foreground";

	return (
		<div
			aria-hidden="true"
			className="server-list-head h-9 border-b border-border bg-muted/50 px-4 dark:bg-foreground/[0.02]"
		>
			<span className={`${cell} [grid-area:name]`}>{t("serverList.name")}</span>
			<span className={`${cell} text-right [grid-area:cpu]`}>
				{t("serverList.cpu")}
			</span>
			<span className={`${cell} text-right [grid-area:mem]`}>
				{t("serverList.mem")}
			</span>
			<span className={`${cell} text-right [grid-area:disk]`}>
				{t("serverList.disk")}
			</span>
			<span className={`${cell} text-right [grid-area:speed]`}>
				{t("serverList.speed")}
			</span>
			<span className={`${cell} text-right [grid-area:traffic]`}>
				{t("serverList.traffic")}
			</span>
			<span className={`${cell} hidden text-right [grid-area:load] xl:block`}>
				{t("serverList.load")}
			</span>
			<span className={`${cell} hidden text-right [grid-area:uptime] xl:block`}>
				{t("serverList.uptime")}
			</span>
		</div>
	);
}
