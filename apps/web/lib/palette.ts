// label is kept for accessibility (aria-label / hover tooltip); the dropdown
// shows a visual preview chip (bg + primary + accent) rather than the name.
export const PALETTES = [
  { id: "cream", label: "Cream", bg: "oklch(0.985 0.014 85)", primary: "oklch(0.78 0.16 82)", accent: "oklch(0.7 0.15 165)" },
  { id: "green", label: "Light Green", bg: "oklch(0.975 0.02 95)", primary: "oklch(0.72 0.11 150)", accent: "oklch(0.8 0.13 85)" },
  { id: "sky", label: "Sky", bg: "oklch(0.975 0.02 95)", primary: "oklch(0.71 0.1 220)", accent: "oklch(0.8 0.13 85)" },
  { id: "blossom", label: "Blossom", bg: "oklch(0.975 0.02 95)", primary: "oklch(0.75 0.12 12)", accent: "oklch(0.66 0.12 155)" },
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
