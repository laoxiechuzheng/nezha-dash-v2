import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
	const navigate = useNavigate();
	const { t } = useTranslation();

	return (
		<div className="flex min-h-[55vh] flex-col items-center justify-center">
			<div className="glass-panel relative flex w-full max-w-lg flex-col items-center gap-3 overflow-hidden rounded-3xl px-6 py-14 text-center">
				<div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.2),transparent_65%)]" />
				<h1 className="text-6xl font-black tracking-tight text-indigo-600 dark:text-indigo-300">
					404
				</h1>
				<p className="text-lg font-medium text-muted-foreground">
					{t("error.pageNotFound")}
				</p>
				<Button onClick={() => navigate("/")} className="mt-2">
					{t("error.backToHome")}
				</Button>
			</div>
		</div>
	);
}
