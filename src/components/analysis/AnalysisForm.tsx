import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/hooks/useAuth'
import { useAssistantKnowledgeBases } from '@/hooks/queries'
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_FILE_SIZE_BYTES,
  isAllowedFile,
  isHttpsUrl,
} from '@/lib/analysis-schemas'
import type { AnalysisClientError } from '@/lib/analysis-client'
import type { AIAssistant } from '@/types/database.types'
import { Paperclip, Plus, Trash2, AlertCircle } from 'lucide-react'

export interface AnalysisFormValues {
  verzekeringsvraagstuk: string
  kennisbronnen: Array<{ id: string; name: string }>
  klantsituatie: string
  bestanden: File[]
  urls: string[]
  klantreferentie: string
}

export interface AnalysisFormProps {
  assistant: AIAssistant
  initial?: AnalysisFormValues | null
  isSubmitting: boolean
  submitError: AnalysisClientError | null
  onSubmit: (values: AnalysisFormValues) => void
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  return `${Math.round(bytes / 1024)} KB`
}

export function AnalysisForm({ assistant, initial, isSubmitting, submitError, onSubmit }: AnalysisFormProps) {
  const { profile } = useAuth()
  const { data: knowledgeBases } = useAssistantKnowledgeBases(assistant.id)
  const availableKBs = knowledgeBases ?? []

  const [verzekeringsvraagstuk, setVerzekeringsvraagstuk] = useState(initial?.verzekeringsvraagstuk ?? '')
  const [selectedKBIds, setSelectedKBIds] = useState<Set<string>>(
    new Set(initial?.kennisbronnen.map((kb) => kb.id) ?? []),
  )
  const [klantsituatie, setKlantsituatie] = useState(initial?.klantsituatie ?? '')
  const [bestanden, setBestanden] = useState<File[]>([])
  const [urls, setUrls] = useState<string[]>(initial?.urls ?? [])
  const [urlInput, setUrlInput] = useState('')
  const [klantreferentie, setKlantreferentie] = useState(initial?.klantreferentie ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (initial) {
      setVerzekeringsvraagstuk(initial.verzekeringsvraagstuk)
      setSelectedKBIds(new Set(initial.kennisbronnen.map((kb) => kb.id)))
      setKlantsituatie(initial.klantsituatie)
      setUrls(initial.urls)
      setKlantreferentie(initial.klantreferentie)
      setBestanden([])
    }
  }, [initial])

  const toggleKB = (id: string) => {
    setSelectedKBIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addUrl = () => {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    if (!isHttpsUrl(trimmed)) {
      setErrors((prev) => ({ ...prev, urls: 'URL\u2019s moeten beginnen met https:// ' }))
      return
    }
    setErrors((prev) => ({ ...prev, urls: '' }))
    setUrls((prev) => [...prev, trimmed])
    setUrlInput('')
  }

  const removeUrl = (index: number) => {
    setUrls((prev) => prev.filter((_, i) => i !== index))
  }

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const incoming = Array.from(files)
    const rejected: string[] = []
    for (const file of incoming) {
      if (!isAllowedFile(file)) {
        rejected.push(`Alleen ${ALLOWED_FILE_EXTENSIONS.join(', ')} toegestaan: ${file.name}`)
      }
    }
    if (rejected.length > 0) {
      const [firstRejected] = rejected
      setErrors((prev) => ({ ...prev, bestanden: firstRejected ?? 'Bestand niet toegestaan.' }))
      return
    }
    const totalSize = [...bestanden, ...incoming].reduce((sum, f) => sum + f.size, 0)
    if (totalSize > MAX_TOTAL_FILE_SIZE_BYTES) {
      setErrors((prev) => ({ ...prev, bestanden: 'De totale bestandsgrootte overschrijdt 25 MB.' }))
      return
    }
    setErrors((prev) => ({ ...prev, bestanden: '' }))
    setBestanden((prev) => [...prev, ...incoming])
  }

  const removeFile = (index: number) => {
    setBestanden((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!verzekeringsvraagstuk.trim()) {
      nextErrors.verzekeringsvraagstuk = 'Vul het verzekeringsvraagstuk in.'
    }
    if (selectedKBIds.size === 0) {
      nextErrors.kennisbronnen = 'Selecteer minimaal één kennisbron.'
    }
    if (!klantreferentie.trim()) {
      nextErrors.klantreferentie = 'Vul de klantreferentie in.'
    }
    const hasGroup = Boolean(klantsituatie.trim()) || bestanden.length > 0 || urls.length > 0
    if (!hasGroup) {
      nextErrors.group = 'Vul minimaal één van Klantsituatie, Bestanden of URL\u2019s in.'
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    onSubmit({
      verzekeringsvraagstuk: verzekeringsvraagstuk.trim(),
      kennisbronnen: availableKBs
        .filter((kb) => selectedKBIds.has(kb.id))
        .map((kb) => ({ id: kb.id, name: kb.name })),
      klantsituatie: klantsituatie.trim(),
      bestanden,
      urls,
      klantreferentie: klantreferentie.trim(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {errors.group && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errors.group}</span>
        </div>
      )}
      {submitError && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{submitError.message}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="verzekeringsvraagstuk">Verzekeringsvraagstuk</Label>
        <Textarea
          id="verzekeringsvraagstuk"
          value={verzekeringsvraagstuk}
          onChange={(e) => setVerzekeringsvraagstuk(e.target.value)}
          rows={4}
          aria-describedby={errors.verzekeringsvraagstuk ? 'verzekeringsvraagstuk-error' : undefined}
          aria-invalid={Boolean(errors.verzekeringsvraagstuk)}
          required
        />
        {errors.verzekeringsvraagstuk && (
          <p id="verzekeringsvraagstuk-error" role="alert" className="text-sm text-destructive">
            {errors.verzekeringsvraagstuk}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Kennisbronnen</Label>
        <p className="text-xs text-muted-foreground">De selectie bepaalt het verzekerings­type.</p>
        <div className="max-h-40 overflow-y-auto rounded-lg border" role="group" aria-label="Kennisbronnen">
          {availableKBs.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Geen kennisbronnen gekoppeld aan deze assistent.</p>
          ) : (
            availableKBs.map((kb) => (
              <label key={kb.id} className="flex cursor-pointer items-center gap-2 p-2 hover:bg-accent">
                <input
                  type="checkbox"
                  checked={selectedKBIds.has(kb.id)}
                  onChange={() => toggleKB(kb.id)}
                  className="rounded border-input"
                />
                <span className="text-sm">{kb.name}</span>
              </label>
            ))
          )}
        </div>
        {errors.kennisbronnen && (
          <p role="alert" className="text-sm text-destructive">{errors.kennisbronnen}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="klantsituatie">Klantsituatie</Label>
        <Textarea
          id="klantsituatie"
          value={klantsituatie}
          onChange={(e) => setKlantsituatie(e.target.value)}
          rows={4}
          placeholder="Optioneel — omschrijf de situatie van de opdrachtgever"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bestanden">Bestanden</Label>
        <p className="text-xs text-muted-foreground">
          Optioneel. pdf, docx of txt — maximaal {formatBytes(MAX_FILE_SIZE_BYTES)} per bestand,
          totaal {formatBytes(MAX_TOTAL_FILE_SIZE_BYTES)}.
        </p>
        <label htmlFor="bestanden" className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm hover:bg-accent">
          <Paperclip className="h-4 w-4" aria-hidden="true" />
          <span>Bestanden kiezen</span>
        </label>
        <input
          id="bestanden"
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          onChange={(e) => addFiles(e.target.files)}
          className="sr-only"
          aria-invalid={Boolean(errors.bestanden)}
        />
        {bestanden.length > 0 && (
          <ul className="space-y-1">
            {bestanden.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-sm">
                <span className="truncate">{file.name}</span>
                <button type="button" onClick={() => removeFile(index)} className="text-muted-foreground hover:text-destructive" aria-label={`Verwijder ${file.name}`}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {errors.bestanden && (
          <p role="alert" className="text-sm text-destructive">{errors.bestanden}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="url-input">URL&rsquo;s</Label>
        <p className="text-xs text-muted-foreground">Optioneel. Uitsluitend https-adressen.</p>
        <div className="flex gap-2">
          <Input
            id="url-input"
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://voorbeeld.nl/document"
            aria-describedby={errors.urls ? 'urls-error' : undefined}
            aria-invalid={Boolean(errors.urls)}
          />
          <Button type="button" variant="outline" onClick={addUrl}>
            <Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Toevoegen
          </Button>
        </div>
        {errors.urls && (
          <p id="urls-error" role="alert" className="text-sm text-destructive">{errors.urls}</p>
        )}
        {urls.length > 0 && (
          <ul className="space-y-1">
            {urls.map((url, index) => (
              <li key={`${url}-${index}`} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-sm">
                <span className="truncate">{url}</span>
                <button type="button" onClick={() => removeUrl(index)} className="text-muted-foreground hover:text-destructive" aria-label={`Verwijder ${url}`}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="klantreferentie">Klantreferentie</Label>
        <Input
          id="klantreferentie"
          value={klantreferentie}
          onChange={(e) => setKlantreferentie(e.target.value)}
          aria-describedby={errors.klantreferentie ? 'klantreferentie-error' : undefined}
          aria-invalid={Boolean(errors.klantreferentie)}
          required
        />
        {errors.klantreferentie && (
          <p id="klantreferentie-error" role="alert" className="text-sm text-destructive">
            {errors.klantreferentie}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="adviseur">Adviseur</Label>
        <Input
          id="adviseur"
          value={profile?.full_name ?? ''}
          readOnly
          aria-readonly="true"
          className="bg-muted/50"
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? <><Spinner className="h-4 w-4 mr-2" /> Analyse wordt gestart...</> : 'Start analyse'}
      </Button>
    </form>
  )
}