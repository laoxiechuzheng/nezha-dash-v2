import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-[4px] border border-transparent px-1.5 text-xs font-medium leading-none",
	{
		variants: {
			variant: {
				default: "bg-primary/12 text-primary",
				secondary: "bg-muted text-muted-foreground",
				destructive: "bg-danger/12 text-danger",
				outline: "border-border text-foreground",
				success: "bg-success/12 text-success",
				warning: "bg-warning/12 text-warning",
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
