export const REQUEST_TIMEOUT_MESSAGE = "The request timed out. Your current work is still safe."

/**
 * Keep one deadline alive until the response body has been fully consumed.
 *
 * `fetch()` resolves as soon as response headers arrive. Streaming endpoints
 * can flush headers/keepalive bytes long before their JSON or audio body is
 * complete, so clearing the timer immediately after `fetch()` would not be a
 * total request timeout.
 */
export async function fetchWithTotalTimeout<T>(
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
  consume: (response: Response) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  const callerSignal = init.signal
  const abortFromCaller = () => controller.abort(callerSignal?.reason)
  if (callerSignal?.aborted) {
    controller.abort(callerSignal.reason)
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true })
  }
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    if (controller.signal.aborted) {
      throw callerSignal?.reason ?? new DOMException("Aborted", "AbortError")
    }
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    })
    return await consume(response)
  } catch (error) {
    if (controller.signal.aborted && !callerSignal?.aborted) {
      throw new Error(REQUEST_TIMEOUT_MESSAGE)
    }
    throw error
  } finally {
    clearTimeout(timeout)
    callerSignal?.removeEventListener("abort", abortFromCaller)
  }
}
