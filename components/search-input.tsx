import { SearchIcon } from "lucide-react"
import { Input } from "@/components/ui/input"

/** Búsqueda por query string (?q=). Funciona sin JavaScript: es un form GET. */
export function SearchInput({ defaultValue, placeholder, children }: { defaultValue?: string; placeholder: string; children?: React.ReactNode }) {
  return (
    <form className="flex flex-wrap items-center gap-2" role="search">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={defaultValue} placeholder={placeholder} className="w-80 border-transparent bg-secondary pl-9 focus-visible:bg-background" aria-label={placeholder} />
      </div>
      {children}
    </form>
  )
}
