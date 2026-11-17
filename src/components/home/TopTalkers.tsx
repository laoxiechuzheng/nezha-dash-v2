import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import ServerFlag from "@/components/ServerFlag";
import { isFleetOnline } from "@/lib/fleet-trace";
import { saveMainPageScrollPosition } from "@/lib/navigation";
import { bytesPerSecondToMbps, formatMbps } from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";

export default function TopTalkers({
	servers,
	now,
}: {
	servers: NezhaServer[];
	now: number;
}) {
	const { t } = useTranslation();
	const { top, online } = useMemo(() => {
		const top: { server: NezhaServer; speed: number }[] = [];
		let online = 0;
		for (const server of servers) {
			if (!isFleetOnline(now, server)) continue;
			const speed =
				(server.state?.net_in_speed || 0) + (server.state?.net_out_speed || 0);
			if (!(speed > 0) || !Number.isFinite(speed)) continue;
			online++;
			const index = top.findIndex((entry) => speed > entry.speed);
			if (index < 0) {
				if (top.length < 3) top.push({ server, speed });
			} else {
				top.splice(index, 0, { server, speed });
				top.length = Math.min(3, top.length);
			}
		}
		return { top, online };
	}, [servers, now]);
	if (online < 2 || !top[0]?.speed) return null;
	return (
		<div className="hm-top-talkers">
			<h2 className="eyebrow">{t("v2Home.fleet.topTalkers")}</h2>
			{top.map(({ server, speed }, index) => (
				<Link
					key={server.id}
					to={`/server/${server.id}`}
					className="hm-top-talker"
					onClick={(event) => {
						if (
							!event.ctrlKey &&
							!event.metaKey &&
							!event.shiftKey &&
							event.button === 0
						)
							saveMainPageScrollPosition();
					}}
				>
					<span className="num">{index + 1}</span>
					<ServerFlag country_code={server.country_code} />
					<span className="hm-talker-name" title={server.name}>
						{server.name}
					</span>
					<strong className="num">
						{formatMbps(bytesPerSecondToMbps(speed))}
					</strong>
					<span
						className="hm-talker-bar"
						style={{ width: `${(speed / top[0].speed) * 100}%` }}
					/>
				</Link>
			))}
		</div>
	);
}
