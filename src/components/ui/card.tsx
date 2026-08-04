import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

const Card = forwardRef<HTMLDivElement, DivProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card"
    className={cn(
      "bg-card text-card-foreground rounded-xl border shadow-sm",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, DivProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-1 p-5", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<HTMLDivElement, DivProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-base leading-none font-semibold", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<HTMLDivElement, DivProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = forwardRef<HTMLDivElement, DivProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = forwardRef<HTMLDivElement, DivProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-5 pt-0", className)} {...props} />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
