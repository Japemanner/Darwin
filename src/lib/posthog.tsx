import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { PostHogProvider } from 'posthog-js/react'
import { posthog } from 'posthog-js'

// This module intentionally exports the provider together with the analytics
// helpers; splitting them would only spread the same singleton over two files.
/* eslint-disable react-refresh/only-export-components */

/**
 * PostHog (EU Cloud) — product analytics module
 *
 * Scope: pageviews + custom events. Géén session replay, feature flags of A/B-testing.
 * Host is hardcoded EU Cloud fallback; VITE_PUBLIC_POSTHOG_HOST overschrijft indien aanwezig.
 */

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'

export const isPostHogEnabled = Boolean(POSTHOG_KEY)

/**
 * Centralisatie van alle event-namen om typfouten in de codebase te voorkomen.
 * Voeg nieuwe events hier toe, niet inline in componenten.
 */
export const PostHogEvent = {
  TASK_EFFORT_RATED: 'task_effort_rated',
  ROADMAP_VOTED: 'roadmap_voted',
  FEATURE_REQUEST_SUBMITTED: 'feature_request_submitted',
} as const

export type PostHogEventName = (typeof PostHogEvent)[keyof typeof PostHogEvent]

/**
 * Getypeerde properties per event. Lege interface = geen properties vereist.
 */
interface PostHogEventProperties {
  [PostHogEvent.TASK_EFFORT_RATED]: { ces_score: number; task: string }
  [PostHogEvent.ROADMAP_VOTED]: { feature_id: string; direction: number }
  [PostHogEvent.FEATURE_REQUEST_SUBMITTED]: { title: string }
}

/**
 * Type-safe wrapper rond posthog.capture(). Geen losse posthog.capture()-calls
 * elders in de codebase — ga altijd via deze helper.
 *
 * Als PostHog niet geïnitialiseerd is (ontbrekende env), is dit een no-op.
 */
export function trackEvent<K extends PostHogEventName>(
  name: K,
  properties?: K extends keyof PostHogEventProperties ? PostHogEventProperties[K] : Record<string, unknown>,
): void {
  if (!isPostHogEnabled) return
  posthog.capture(name, properties)
}

/**
 * Koppel PostHog-identiteit aan Supabase user-id (UUID).
 * Geen e-mail of andere PII als property — alleen de Supabase UUID als distinct_id.
 */
export function identifyUser(userId: string): void {
  if (!isPostHogEnabled) return
  posthog.identify(userId)
}

/**
 * Reset PostHog-identiteit bij logout.
 */
export function resetUser(): void {
  if (!isPostHogEnabled) return
  posthog.reset()
}

interface PostHogAppProviderProps {
  children: ReactNode
}

/**
 * Wrap de app (buiten de router) met de PostHogProvider.
 *
 * Config (verifieerd tegen posthog-js v1.393 / actuele docs):
 * - defaults: '2025-05-24' → capture_pageview defaultt naar 'history_change'
 *   (vangt SPA route-changes via history API automatisch)
 * - capture_pageleave: true → pageleave-events
 * - person_profiles: 'identified_only' → géén anonieme profielen (GDPR + kosten)
 * - autocapture: false → scope bewust beperkt tot pageviews + custom events
 * - disable_session_recording: true → géén session replay deze ronde
 *
 * Als de key ontbreekt, rendert deze component children zonder PostHog
 * (gevoelig voor dev zonder env-vars).
 */
export function PostHogAppProvider({ children }: PostHogAppProviderProps) {
  useEffect(() => {
    if (!POSTHOG_KEY) return
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      defaults: '2025-05-24',
      capture_pageleave: true,
      person_profiles: 'identified_only',
      autocapture: false,
      disable_session_recording: true,
      // Never send URL query strings or fragments to PostHog. This covers the
      // invitation token_hash on /auth/confirm and the existing ?code= on
      // /reset-password, for every event (pageview, pageleave and custom).
      before_send: (event) => {
        if (!event) return event
        const properties = event.properties
        if (properties) {
          for (const key of Object.keys(properties)) {
            if (
              key === '$current_url' ||
              key === '$referrer' ||
              key.startsWith('$initial_')
            ) {
              const value = properties[key]
              if (typeof value === 'string') {
                properties[key] = value.split(/[?#]/)[0]
              }
            }
          }
        }
        return event
      },
    })
  }, [])

  if (!POSTHOG_KEY) return <>{children}</>

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}

/**
 * CES (Customer Effort Score) — voorbeeld-event voor latere survey-UI.
 *
 * trackEvent(PostHogEvent.TASK_EFFORT_RATED, { ces_score: 5, task: 'create-assistant' })
 *
 * Koppelen aan UI (later, niet in deze ronde):
 *   1. Toon een 1-7 schaalvraag na voltooiing van een taak in de UI
 *      ("Hoe makkelijk was het om deze taak te voltooien?")
 *   2. Bij submit: roep trackEvent(PostHogEvent.TASK_EFFORT_RATED, { ces_score, task }) aan
 *   3. In PostHog: bouw een CES-survey of dashboard op dit event + gem. ces_score
 *   4. Optioneel: koppel via PostHog's ingebouwde survey-feature (buiten scope nu)
 */