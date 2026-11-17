import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-transparent px-2 text-xs font-medium leading-none",
	{
		variants: {
			variant: {
				default:
					"border-primary/24 bg-primary/10 text-primary dark:bg-primary/14",
				secondary: "bg-muted text-muted-foreground",
				destructive:
					"border-danger/24 bg-danger/10 text-danger dark:bg-danger/14",
				outline: "border-border text-foreground",
				success:
					"border-success/24 bg-success/10 text-success dark:bg-success/14",
				warning:
					"border-warning/24 bg-warning/10 text-warning dark:bg-warning/14",
				neutral: "bg-neutral-status/14 text-muted-foreground",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

export { Badge, badgeVariants };
