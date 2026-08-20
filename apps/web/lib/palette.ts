// label is kept for accessibility (aria-label / hover tooltip); the dropdown
// shows a visual preview chip (bg + primary + accent) rather than the name.
// Palette ids are stable (stored in localStorage); paper & ink surfaces stay
// constant across palettes and only the accent hue changes.
export const PALETTES = [
  { id: "cream", label: "Editor's Red", bg: "oklch(0.965 0.009 88)", primary: "oklch(0.5 0.19 30)", accent: "oklch(0.925 0.032 38)" },
  { id: "green", label: "Forest", bg: "oklch(0.965 0.009 88)", primary: "oklch(0.48 0.1 155)", accent: "oklch(0.915 0.03 155)" },
  { id: "sky", label: "Blueprint", bg: "oklch(0.965 0.009 88)", primary: "oklch(0.46 0.12 255)", accent: "oklch(0.915 0.03 255)" },
  { id: "blossom", label: "Plum", bg: "oklch(0.965 0.009 88)", primary: "oklch(0.47 0.14 340)", accent: "oklch(0.915 0.032 340)" },
] as const

export type PaletteId = (typeof PALETTES)[number]["id"]

const KEY = "weakspot-palette"

export function getPalette(): PaletteId {
  if (typeof window === "undefined") return "cream"
  const v = window.localStorage.getItem(KEY)
  return (PALETTES.some((p) => p.id === v) ? v : "cream") as PaletteId
}

export function setPalette(id: PaletteId) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(KEY, id)
  const el = document.documentElement
  if (id === "cream") el.removeAttribute("data-palette")
  else el.setAttribute("data-palette", id)
}
