import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
	const navigate = useNavigate();
	const { t } = useTranslation();
	return (
		<div className="flex min-h-[55vh] items-center justify-center py-12">
			<section className="surface flex w-full max-w-[560px] flex-col items-center px-6 py-12 text-center">
				<span className="sh-empty-icon">
					<SearchX
						className="size-6 text-muted-foreground"
						aria-hidden="true"
					/>
				</span>
				<p className="num mt-4 font-mono text-sm text-muted-foreground">404</p>
				<h1 className="mt-2 text-xl font-semibold">
					{t("error.pageNotFound")}
				</h1>
				<Button
					onClick={() => navigate("/")}
					variant="outline"
					className="mt-6"
				>
					<ArrowLeftIcon />
					{t("error.backToHome")}
				</Button>
			</section>
		</div>
	);
}
