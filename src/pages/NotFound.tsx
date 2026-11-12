import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
	const navigate = useNavigate();
	const { t } = useTranslation();

	return (
		<div className="flex min-h-[55vh] flex-col items-center justify-center px-4 text-center">
			<p className="font-mono text-sm font-medium text-muted-foreground tabular-nums">
				404
			</p>
			<h1 className="mt-2 text-2xl font-semibold">{t("error.pageNotFound")}</h1>
			<Button onClick={() => navigate("/")} variant="outline" className="mt-6">
				<ArrowLeftIcon />
				{t("error.backToHome")}
			</Button>
		</div>
	);
}
