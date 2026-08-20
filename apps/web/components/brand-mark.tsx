import { Crosshair } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * WeakSpot brand mark: a crosshair tile that stands for the product's core
 * promise — locate the exact weak spot, then train it. Replaces the playful
 * owl emoji with a geometric, professional mark.
 */
export function BrandMark({
  className,
  iconClassName,
}: {
  className?: string
  iconClassName?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm",
        className,
      )}
    >
      <Crosshair className={cn("size-[55%]", iconClassName)} strokeWidth={2.25} />
    </span>
  )
}
