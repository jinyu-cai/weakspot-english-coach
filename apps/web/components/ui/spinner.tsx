import { cn } from "@/lib/utils"
import { getCopy } from "@/lib/i18n"
import { getOutputLanguage } from "@/lib/language"
import { Loader2Icon } from "lucide-react"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const label = getCopy(getOutputLanguage()).common.loading
  return <Loader2Icon data-slot="spinner" role="status" aria-label={label} className={cn("size-4 animate-spin", className)} {...props} />
}

export { Spinner }
