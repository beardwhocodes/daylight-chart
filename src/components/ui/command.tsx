import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const Command = forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
      className,
    )}
    {...props}
  />
));
Command.displayName = "Command";

const CommandInput = forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex h-10 items-center gap-2 border-b px-3">
    <Search className="text-muted-foreground size-4 shrink-0" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "placeholder:text-muted-foreground/70 flex h-10 w-full bg-transparent py-3 text-sm outline-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = "CommandInput";

const CommandList = forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto p-1", className)}
    {...props}
  />
));
CommandList.displayName = "CommandList";

const CommandEmpty = forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="text-muted-foreground py-8 text-center text-sm"
    {...props}
  />
));
CommandEmpty.displayName = "CommandEmpty";

const CommandGroup = forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "text-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase",
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = "CommandGroup";

const CommandItem = forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative flex cursor-default items-center gap-2.5 rounded-md px-2 py-2 text-sm outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-45",
      "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = "CommandItem";

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem };
