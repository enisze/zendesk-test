import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  href?: string;
  disabled?: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
};

export function PaginationLink({ href, disabled, ariaLabel, children }: Props) {
  const className = cn(
    buttonVariants({ variant: "outline", size: "sm" }),
    disabled && "pointer-events-none opacity-50",
  );

  if (disabled || !href) {
    return (
      <span aria-disabled className={className}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={ariaLabel} className={className}>
      {children}
    </Link>
  );
}
