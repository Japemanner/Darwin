import { BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import type { PushErrorCode } from '@/lib/push/types'

const ERROR_TEXTS: Partial<Record<PushErrorCode, string>> = {
  NOT_CONFIGURED:
    'Meldingen zijn niet beschikbaar. Neem contact op met de beheerder.',
  SERVICE_WORKER_FAILED:
    'De meldingsdienst kon niet worden gestart. Herlaad de pagina en probeer het opnieuw.',
  PERMISSION_BLOCKED:
    'Uw browser blokkeert meldingen. Sta meldingen toe in de browserinstellingen en herlaad de pagina.',
}

function statusText(
  status: ReturnType<typeof usePushSubscription>['status'],
  errorCode: PushErrorCode | null,
): string {
  switch (status) {
    case 'on':
      return 'Meldingen staan aan op dit apparaat.'
    case 'off':
      return 'Meldingen staan uit op dit apparaat.'
    case 'determining':
      return 'Meldingsstatus wordt bepaald…'
    case 'working':
      return 'Bezig met bijwerken…'
    case 'unsupported':
      return 'Deze browser ondersteunt geen meldingen. Gebruik Chrome, Edge of Firefox op de computer, of Chrome op Android.'
    case 'blocked':
      return 'Uw browser blokkeert meldingen. Sta meldingen toe in de browserinstellingen en herlaad de pagina.'
    case 'error':
      return (
        (errorCode ? ERROR_TEXTS[errorCode] : undefined) ??
        'Meldingen konden niet worden bijgewerkt. Controleer uw verbinding en probeer het opnieuw.'
      )
  }
}

export function PushNotificationControl({ userId }: { userId: string | undefined }) {
  const { status, errorCode, lastAction, enable, disable, retry } =
    usePushSubscription(userId)

  const isWorking = status === 'working'
  const canRetry = status === 'error' && errorCode !== 'NOT_CONFIGURED'

  return (
    <div className="mb-3 space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
        <BellRing className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{statusText(status, errorCode)}</span>
      </p>

      {status === 'off' && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => void enable()}
        >
          Meldingen aanzetten
        </Button>
      )}

      {status === 'on' && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => void disable()}
        >
          Meldingen uitzetten
        </Button>
      )}

      {isWorking && (
        <Button variant="outline" size="sm" className="w-full" disabled aria-busy="true">
          {lastAction === 'enable' ? 'Bezig met aanzetten…' : 'Bezig met uitzetten…'}
        </Button>
      )}

      {canRetry && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => void retry()}
        >
          Opnieuw proberen
        </Button>
      )}
    </div>
  )
}
