import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ModuleShortcut({ href, title, description, icon: Icon, className }: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("module-shortcut", className)}>
      <span className="module-shortcut-icon"><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span>
      <span className="module-shortcut-copy"><strong>{title}</strong><small>{description}</small></span>
      <ArrowUpRight size={17} className="module-shortcut-arrow" aria-hidden="true" />
    </Link>
  );
}
