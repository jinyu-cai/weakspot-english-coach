"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type NextExerciseStatus = "idle" | "preparing" | "ready"

type PreparedExercise<T> = {
  index: number
  token: number
  promise: Promise<T | null>
}

/**
 * Prepares one adaptive exercise in the background and lets the foreground
 * transition reuse it. A failed background request stays invisible; choosing
 * Next retries normally so feedback is never replaced by an error state.
 */
export function useNextExercise<T>() {
  const [status, setStatus] = useState<NextExerciseStatus>("idle")
  const preparedRef = useRef<PreparedExercise<T> | null>(null)
  const tokenRef = useRef(0)

  const reset = useCallback(() => {
    tokenRef.current += 1
    preparedRef.current = null
    setStatus("idle")
  }, [])

  const prepare = useCallback((index: number, load: () => Promise<T>) => {
    if (preparedRef.current?.index === index) return

    const token = tokenRef.current + 1
    tokenRef.current = token
    setStatus("preparing")

    const promise = load()
      .then((exercise) => {
        if (tokenRef.current === token) setStatus("ready")
        return exercise
      })
      .catch(() => {
        if (tokenRef.current === token) {
          preparedRef.current = null
          setStatus("idle")
        }
        return null
      })

    preparedRef.current = { index, token, promise }
  }, [])

  const take = useCallback(async (index: number, load: () => Promise<T>) => {
    const prepared = preparedRef.current?.index === index ? preparedRef.current : null
    const exercise = prepared ? await prepared.promise : null

    if (prepared && preparedRef.current?.token === prepared.token) {
      preparedRef.current = null
      setStatus("idle")
    }

    return exercise ?? load()
  }, [])

  useEffect(() => () => {
    tokenRef.current += 1
    preparedRef.current = null
  }, [])

  return { status, prepare, take, reset }
}
