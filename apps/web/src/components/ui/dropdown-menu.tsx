"use client";
import * as React from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
export const DropdownMenu = Dropdown.Root;
export const DropdownMenuTrigger = Dropdown.Trigger;
export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof Dropdown.Content>) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content
        sideOffset={sideOffset}
        className={cn(
          "workspace-dropdown z-50 min-w-44 rounded-[22px] border border-white bg-white/95 p-2 shadow-[0_12px_40px_#2032531c] outline-none backdrop-blur-xl data-[state=open]:animate-fade-in",
          className,
        )}
        {...props}
      />
    </Dropdown.Portal>
  );
}
export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof Dropdown.Item>) {
  return (
    <Dropdown.Item
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] outline-none transition-colors focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}
export function DropdownMenuSeparator() {
  return <Dropdown.Separator className="my-1 h-px bg-border" />;
}
