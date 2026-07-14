export interface ChatComposerKeyEvent {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  nativeEvent: {
    isComposing: boolean
    keyCode: number
  }
}

export function shouldSendFromChatComposer(event: ChatComposerKeyEvent): boolean {
  return (
    event.key === "Enter"
    && (event.metaKey || event.ctrlKey)
    && !event.nativeEvent.isComposing
    && event.nativeEvent.keyCode !== 229
  )
}
