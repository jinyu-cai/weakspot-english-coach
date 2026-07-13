// label is kept for accessibility (aria-label / hover tooltip); the dropdown
// shows a visual preview chip (bg + primary + accent) rather than the name.
export const PALETTES = [
  { id: "cream", label: "Warm Oat", bg: "oklch(0.982 0.01 78)", primary: "oklch(0.58 0.13 48)", accent: "oklch(0.58 0.11 145)" },
  { id: "green", label: "Sage", bg: "oklch(0.98 0.012 82)", primary: "oklch(0.53 0.105 145)", accent: "oklch(0.92 0.045 145)" },
  { id: "sky", label: "Soft Sky", bg: "oklch(0.98 0.012 82)", primary: "oklch(0.52 0.1 230)", accent: "oklch(0.92 0.04 225)" },
  { id: "blossom", label: "Blossom", bg: "oklch(0.98 0.012 82)", primary: "oklch(0.57 0.13 15)", accent: "oklch(0.93 0.045 15)" },
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
