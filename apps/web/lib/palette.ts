export const PALETTES = [
  { id: "cream", label: "Cream", swatch: "oklch(0.78 0.16 82)" },
  { id: "green", label: "Light Green", swatch: "oklch(0.72 0.11 150)" },
  { id: "sky", label: "Sky", swatch: "oklch(0.71 0.1 220)" },
  { id: "blossom", label: "Blossom", swatch: "oklch(0.75 0.12 12)" },
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
