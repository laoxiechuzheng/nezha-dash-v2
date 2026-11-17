import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface ErrorPageProps {
	code?: string | number;
	message?: string;
}

export default function ErrorPage({ code = "500", message }: ErrorPageProps) {
	const { t } = useTranslation();
	return (
		<div className="flex min-h-[55vh] items-center justify-center py-12">
			<section
				className="sh-error-panel flex w-full max-w-[560px] flex-col items-center px-6 py-12 text-center"
				role="alert"
			>
				<span className="sh-empty-icon text-danger">
					<ExclamationTriangleIcon aria-hidden="true" className="size-6" />
				</span>
				<h1 className="num mt-4 font-mono text-sm font-medium text-muted-foreground">
					{code}
				</h1>
				<p className="mt-2 max-w-md break-words text-lg font-semibold">
					{message || t("error.somethingWentWrong")}
				</p>
				<Button
					variant="outline"
					className="mt-6"
					onClick={() => window.location.reload()}
				>
					{t("v2Shell.retry")}
				</Button>
			</section>
		</div>
	);
}
