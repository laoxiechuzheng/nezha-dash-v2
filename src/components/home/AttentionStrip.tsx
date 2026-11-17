import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { isFleetOnline } from "@/lib/fleet-trace";
import { saveMainPageScrollPosition } from "@/lib/navigation";
import {
	getDaysBetweenDatesWithAutoRenewal,
	handlePublicNote,
	parsePublicNote,
} from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";

type Attention = {
	id: number;
	key: string;
	tone: "danger" | "warning";
	kind: "offline" | "resource" | "expiring" | "expired";
	name: string;
	metric?: string;
	value?: string;
	days?: number;
};

export default function AttentionStrip({
	servers,
	now,
}: {
	servers: NezhaServer[];
	now: number;
}) {
	const { t } = useTranslation();
	const { entries, count } = useMemo(() => {
		const entries: Attention[] = [];
		let count = 0;
		let offlineNames = 0;
		const add = (entry: Attention) => {
			count++;
			if (entries.length < 6) entries.push(entry);
		};
		for (const server of servers) {
			if (!isFleetOnline(now, server)) {
				offlineNames++;
				if (offlineNames <= 3)
					add({
						id: server.id,
						key: `${server.id}-offline`,
						tone: "danger",
						kind: "offline",
						name: server.name,
					});
				else count++;
			} else {
				const resources = [
					["CPU", server.state?.cpu],
					[
						"serverCard.mem",
						server.host?.mem_total > 0
							? (server.state?.mem_used / server.host.mem_total) * 100
							: Number.NaN,
					],
					[
						"serverCard.stg",
						server.host?.disk_total > 0
							? (server.state?.disk_used / server.host.disk_total) * 100
							: Number.NaN,
					],
				] as const;
				for (const [metric, value] of resources)
					if (Number.isFinite(value) && value > 90)
						add({
							id: server.id,
							key: `${server.id}-${metric}`,
							tone: "danger",
							kind: "resource",
							name: server.name,
							metric,
							value: `${value.toFixed(0)}%`,
						});
			}
			const billing = parsePublicNote(
				handlePublicNote(server.id, server.public_note || ""),
			)?.billingDataMod;
			if (
				!billing?.endDate ||
				billing.endDate.startsWith("0000-00-00") ||
				billing.autoRenewal === "1"
			)
				continue;
			try {
				const { days } = getDaysBetweenDatesWithAutoRenewal(billing);
				if (!Number.isFinite(days) || days > 7) continue;
				add({
					id: server.id,
					key: `${server.id}-billing`,
					tone: days < 0 ? "danger" : "warning",
					kind: days < 0 ? "expired" : "expiring",
					name: server.name,
					days: Math.abs(days),
				});
			} catch {
				/* 坏日期与原账单组件保持相同的跳过语义。 */
			}
		}
		return { entries, count };
	}, [servers, now]);
	if (!count) return null;
	return (
		<aside
			className="hm-attention surface"
			aria-label={t("v2Home.attention.title", { count })}
		>
			<h2 className="eyebrow">{t("v2Home.attention.title", { count })}</h2>
			<div className="hm-attention-chips">
				{entries.map((entry) => (
					<Link
						key={entry.key}
						to={`/server/${entry.id}`}
						className="chip"
						data-tone={entry.tone}
						onClick={(event) => {
							if (
								!event.ctrlKey &&
								!event.metaKey &&
								!event.shiftKey &&
								event.button === 0
							)
								saveMainPageScrollPosition();
						}}
						title={t(`v2Home.attention.${entry.kind}`, {
							...entry,
							metric: entry.metric === "CPU" ? "CPU" : t(entry.metric ?? ""),
						})}
					>
						{t(`v2Home.attention.${entry.kind}`, {
							...entry,
							metric: entry.metric === "CPU" ? "CPU" : t(entry.metric ?? ""),
						})}
					</Link>
				))}
				{count > entries.length && (
					<span className="chip" data-tone="neutral">
						{t("v2Home.attention.more", { count: count - entries.length })}
					</span>
				)}
			</div>
		</aside>
	);
}
