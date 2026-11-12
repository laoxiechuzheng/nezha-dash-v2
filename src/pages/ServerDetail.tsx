import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import NetworkChartLoading from "@/components/NetworkChartLoading";
import ServerDetailChart from "@/components/ServerDetailChart";
import ServerDetailOverview from "@/components/ServerDetailOverview";
import TabSwitch from "@/components/TabSwitch";

const NetworkChart = lazy(() =>
	import("@/components/NetworkChart").then((module) => ({
		default: module.NetworkChart,
	})),
);

export default function ServerDetail() {
	useEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: "instant" });
	}, []);

	const tabs = ["Detail", "Network"];
	const [currentTab, setCurrentTab] = useState(tabs[0]);

	const { id: server_id } = useParams();

	if (!server_id) {
		return <Navigate to="/404" replace />;
	}

	return (
		<div className="server-info flex w-full min-w-0 flex-col gap-5">
			<ServerDetailOverview server_id={server_id} />
			<TabSwitch
				tabs={tabs}
				currentTab={currentTab}
				setCurrentTab={setCurrentTab}
			/>
			{currentTab === tabs[0] && <ServerDetailChart server_id={server_id} />}
			{currentTab === tabs[1] && (
				<Suspense fallback={<NetworkChartLoading />}>
					<NetworkChart server_id={Number(server_id)} show={true} />
				</Suspense>
			)}
		</div>
	);
}
