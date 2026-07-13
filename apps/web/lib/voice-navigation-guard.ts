const VOICE_NAVIGATION_LOCK_EVENT = "weakspot:voice-navigation-lock"

declare global {
  interface Window {
    __weakspotVoiceNavigationLocked?: boolean
  }
}

export function setVoiceNavigationLocked(locked: boolean) {
  if (typeof window === "undefined") return
  window.__weakspotVoiceNavigationLocked = locked
  window.dispatchEvent(new CustomEvent(VOICE_NAVIGATION_LOCK_EVENT, { detail: { locked } }))
}

export function isVoiceNavigationLocked() {
  return typeof window !== "undefined" && window.__weakspotVoiceNavigationLocked === true
}

export { VOICE_NAVIGATION_LOCK_EVENT }
