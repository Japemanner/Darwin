import { z } from 'zod'

export const BronRefIdSchema = z.string().regex(/^[KRA][0-9]+$/)
// K = kennisbron-document, R = regelgeving, A = artikel/bijlage

export const BronRefSchema = z.object({
  id: BronRefIdSchema,
  document: z.string().min(1),
  locatie: z.string().min(1),
  passage: z.string().min(1),
})

export const OptieSchema = z.object({
  titel: z.string().min(1),
  voor: z.array(z.string().min(1)),
  tegen: z.array(z.string().min(1)),
})

export const AnalysisResultSchema = z.object({
  risicos: z.array(z.string().min(1)),
  dekking: z.string().min(1),
  restgat: z.string().min(1),
  draagkracht: z.string().min(1),
  opties: z.array(OptieSchema),
  lacunes: z.array(z.string().min(1)),
  intern_signalen: z.array(z.string().min(1)),
  bronnen: z.array(BronRefSchema),
})

export const RunStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed'])

export const RunErrorSchema = z.object({
  run_id: z.string().uuid(),
  status: z.literal('error'),
  code: z.string().min(1),
  message: z.string().min(1),
})

export const AnalysisRunSchema = z.object({
  id: z.string().uuid(),
  assistant_id: z.string().uuid(),
  advisor_id: z.string().uuid(),
  client_reference: z.string().min(1),
  status: RunStatusSchema,
  started_at: z.string().datetime(),
  finished_at: z.string().datetime().nullable().optional(),
  error_code: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  expires_at: z.string().datetime(),
  result: AnalysisResultSchema.nullable().optional(),
  intern_markdown: z.string().nullable().optional(),
  dossier_docx_url: z.string().nullable().optional(),
})

export const RecentRunSchema = z.object({
  id: z.string().uuid(),
  assistant_id: z.string().uuid(),
  client_reference: z.string().min(1),
  status: RunStatusSchema,
  started_at: z.string().datetime(),
  finished_at: z.string().datetime().nullable().optional(),
  error_code: z.string().nullable().optional(),
})

export type BronRef = z.infer<typeof BronRefSchema>
export type Optie = z.infer<typeof OptieSchema>
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>
export type RunStatus = z.infer<typeof RunStatusSchema>
export type AnalysisRun = z.infer<typeof AnalysisRunSchema>
export type RecentRun = z.infer<typeof RecentRunSchema>

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
export const MAX_TOTAL_FILE_SIZE_BYTES = 25 * 1024 * 1024
export const ALLOWED_FILE_EXTENSIONS = ['pdf', 'docx', 'txt']

export function isAllowedFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return (ALLOWED_FILE_EXTENSIONS as string[]).includes(ext)
}

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}