import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { useTranslation } from "react-i18next";

interface ErrorPageProps {
	code?: string | number;
	message?: string;
}

export default function ErrorPage({ code = "500", message }: ErrorPageProps) {
	const { t } = useTranslation();

	return (
		<div className="flex min-h-[55vh] flex-col items-center justify-center px-4 text-center">
			<ExclamationTriangleIcon
				aria-hidden="true"
				className="size-6 text-warning"
			/>
			<h1 className="mt-3 font-mono text-sm font-medium text-muted-foreground tabular-nums">
				{code}
			</h1>
			<p className="mt-1 max-w-md break-words text-lg font-semibold">
				{message || t("error.somethingWentWrong")}
			</p>
		</div>
	);
}
