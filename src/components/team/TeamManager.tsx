import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import {
  useBlockMember,
  useInviteMember,
  useResendInvite,
  useRevokeInvite,
  useSetMemberRole,
  useTeamMembers,
  useUnblockMember,
} from '@/hooks/queries'
import { ROLE_LABELS, statusLabel } from '@/lib/labels'
import type { TeamMember, TeamRole } from '@/lib/team-admin-client'
import {
  AlertCircle,
  Ban,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'

const ROLE_OPTIONS = [
  { value: 'member', label: ROLE_LABELS.member },
  { value: 'admin', label: ROLE_LABELS.admin },
]

type ConfirmAction =
  | { kind: 'block'; member: TeamMember }
  | { kind: 'revoke'; member: TeamMember }
  | null

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Onbekende fout. Probeer het opnieuw.'
}

function TeamManager({ organizationId }: { organizationId: string }) {
  const { toast } = useToast()
  const { data: members, isPending, isError, refetch } = useTeamMembers(organizationId)

  const inviteMutation = useInviteMember(organizationId)
  const resendMutation = useResendInvite(organizationId)
  const revokeMutation = useRevokeInvite(organizationId)
  const setRoleMutation = useSetMemberRole(organizationId)
  const blockMutation = useBlockMember(organizationId)
  const unblockMutation = useUnblockMember(organizationId)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('member')
  const [inviteError, setInviteError] = useState<string | null>(null)

  const [roleOverrides, setRoleOverrides] = useState<Record<string, TeamRole>>({})
  const [roleSaving, setRoleSaving] = useState<Record<string, boolean>>({})
  const [confirm, setConfirm] = useState<ConfirmAction>(null)

  const actionPending =
    resendMutation.isPending ||
    revokeMutation.isPending ||
    blockMutation.isPending ||
    unblockMutation.isPending

  const activeAdminIds = (members ?? [])
    .filter((member) => member.role === 'admin' && member.status === 'active')
    .map((member) => member.id)

  const isLastActiveAdmin = (member: TeamMember) =>
    member.role === 'admin' &&
    member.status === 'active' &&
    activeAdminIds.length === 1 &&
    activeAdminIds[0] === member.id

  const openInvite = () => {
    setFullName('')
    setEmail('')
    setRole('member')
    setInviteError(null)
    setInviteOpen(true)
  }

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault()
    setInviteError(null)

    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim()
    if (
      trimmedName.length < 1 ||
      trimmedName.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
    ) {
      setInviteError('Vul een naam van 1 tot 100 tekens en een geldig e-mailadres in.')
      return
    }

    try {
      await inviteMutation.mutateAsync({
        full_name: trimmedName,
        email: trimmedEmail,
        role,
      })
      toast({
        title: 'Uitnodiging verzonden',
        description: `De uitnodiging is naar ${trimmedEmail} gestuurd.`,
      })
      setInviteOpen(false)
    } catch (err) {
      const message = errorMessage(err)
      setInviteError(message)
      toast({ title: 'Fout bij uitnodigen', description: message, variant: 'destructive' })
    }
  }

  const handleRoleChange = async (member: TeamMember, nextRole: string) => {
    if (nextRole !== 'admin' && nextRole !== 'member') return
    if (nextRole === member.role || roleSaving[member.id]) return

    setRoleOverrides((prev) => ({ ...prev, [member.id]: nextRole }))
    setRoleSaving((prev) => ({ ...prev, [member.id]: true }))

    try {
      await setRoleMutation.mutateAsync({ userId: member.id, role: nextRole })
      toast({ title: 'Rol gewijzigd', description: `De rol van ${member.full_name} is bijgewerkt.` })
    } catch (err) {
      const message = errorMessage(err)
      toast({ title: 'Fout bij rol wijzigen', description: message, variant: 'destructive' })
    } finally {
      setRoleOverrides((prev) => {
        const copy = { ...prev }
        delete copy[member.id]
        return copy
      })
      setRoleSaving((prev) => {
        const copy = { ...prev }
        delete copy[member.id]
        return copy
      })
    }
  }

  const handleResend = async (member: TeamMember) => {
    try {
      await resendMutation.mutateAsync(member.id)
      toast({ title: 'Uitnodiging opnieuw verstuurd', description: `De uitnodiging is opnieuw naar ${member.email} gestuurd.` })
    } catch (err) {
      const message = errorMessage(err)
      toast({ title: 'Fout bij opnieuw versturen', description: message, variant: 'destructive' })
    }
  }

  const handleConfirm = async () => {
    if (!confirm) return
    const member = confirm.member
    const kind = confirm.kind

    try {
      if (kind === 'block') {
        await blockMutation.mutateAsync(member.id)
        toast({ title: 'Teamlid geblokkeerd', description: `${member.full_name} kan niet meer inloggen.` })
      } else {
        await revokeMutation.mutateAsync(member.id)
        toast({ title: 'Uitnodiging ingetrokken', description: `De uitnodiging voor ${member.email} is ingetrokken.` })
      }
      setConfirm(null)
    } catch (err) {
      const message = errorMessage(err)
      toast({
        title: kind === 'block' ? 'Fout bij blokkeren' : 'Fout bij intrekken',
        description: message,
        variant: 'destructive',
      })
      setConfirm(null)
    }
  }

  const handleUnblock = async (member: TeamMember) => {
    try {
      await unblockMutation.mutateAsync(member.id)
      toast({ title: 'Teamlid gedeblokkeerd', description: `${member.full_name} kan weer inloggen.` })
    } catch (err) {
      const message = errorMessage(err)
      toast({ title: 'Fout bij deblokkeren', description: message, variant: 'destructive' })
    }
  }

  if (isPending) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
          <p className="font-medium">Het team kon niet worden geladen.</p>
          <p className="text-sm text-muted-foreground">Probeer het opnieuw of neem contact op met de beheerder.</p>
          <Button variant="outline" onClick={() => void refetch()}>Opnieuw proberen</Button>
        </CardContent>
      </Card>
    )
  }

  if ((members ?? []).length === 0) {
    return (
      <>
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="Nog geen teamleden"
          description="Nodig een collega uit om samen te werken."
          action={{ label: 'Nodig een teamlid uit', onClick: openInvite }}
        />
        <InviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          fullName={fullName}
          setFullName={setFullName}
          email={email}
          setEmail={setEmail}
          role={role}
          setRole={setRole}
          error={inviteError}
          isSending={inviteMutation.isPending}
          onSubmit={handleInvite}
        />
      </>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Teamleden ({(members ?? []).length})</h2>
        <Button onClick={openInvite}>
          <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" />
          Nodig uit
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naam</TableHead>
                <TableHead>E-mailadres</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Toegevoegd</TableHead>
                <TableHead className="w-[120px]"><span className="sr-only">Acties</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(members ?? []).map((member) => {
                const roleValue = roleOverrides[member.id] ?? member.role
                const roleDisabled =
                  member.is_self ||
                  member.is_protected ||
                  isLastActiveAdmin(member) ||
                  roleSaving[member.id] === true
                const showActions =
                  !member.is_self &&
                  !member.is_protected &&
                  !isLastActiveAdmin(member)
                const statusVariant =
                  member.status === 'active'
                    ? 'default'
                    : member.status === 'blocked'
                      ? 'destructive'
                      : 'secondary'

                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar fallback={member.full_name} size="sm" />
                        <span className="font-medium">{member.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="break-all">{member.email}</span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={roleValue}
                        onValueChange={(next) => void handleRoleChange(member, next)}
                        options={ROLE_OPTIONS}
                        disabled={roleDisabled}
                        ariaLabel={`Rol van ${member.full_name}`}
                        className="w-36"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant}>{statusLabel(member.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(member.created_at).toLocaleDateString('nl-NL')}
                    </TableCell>
                    <TableCell>
                      {showActions && (
                        <div className="flex items-center gap-1">
                          {member.status === 'invited' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void handleResend(member)}
                                disabled={actionPending}
                                aria-label={`Uitnodiging opnieuw versturen voor ${member.full_name}`}
                                title="Uitnodiging opnieuw versturen"
                              >
                                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setConfirm({ kind: 'revoke', member })}
                                disabled={actionPending}
                                aria-label={`Uitnodiging intrekken voor ${member.full_name}`}
                                title="Uitnodiging intrekken"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </>
                          )}
                          {member.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setConfirm({ kind: 'block', member })}
                              disabled={actionPending}
                              aria-label={`${member.full_name} blokkeren`}
                              title="Blokkeren"
                            >
                              <Ban className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                          {member.status === 'blocked' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void handleUnblock(member)}
                              disabled={actionPending}
                              aria-label={`${member.full_name} deblokkeren`}
                              title="Deblokkeren"
                            >
                              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        fullName={fullName}
        setFullName={setFullName}
        email={email}
        setEmail={setEmail}
        role={role}
        setRole={setRole}
        error={inviteError}
        isSending={inviteMutation.isPending}
        onSubmit={handleInvite}
      />

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => { if (!open) setConfirm(null) }}
        ariaLabel={confirm?.kind === 'block' ? 'Teamlid blokkeren' : 'Uitnodiging intrekken'}
      >
        <DialogHeader>
          <DialogTitle>
            {confirm?.kind === 'block' ? 'Teamlid blokkeren' : 'Uitnodiging intrekken'}
          </DialogTitle>
          <DialogDescription>
            {confirm?.kind === 'block'
              ? `${confirm.member.full_name} blokkeren? ${confirm.member.full_name} kan direct niet meer inloggen. Gesprekken en kennisbronnen blijven bewaard.`
              : confirm
                ? `Uitnodiging voor ${confirm.member.email} intrekken? De link in de mail werkt daarna niet meer.`
                : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirm(null)}>Annuleren</Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={blockMutation.isPending || revokeMutation.isPending}
          >
            {confirm?.kind === 'block' ? 'Blokkeren' : 'Intrekken'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fullName: string
  setFullName: (value: string) => void
  email: string
  setEmail: (value: string) => void
  role: TeamRole
  setRole: (value: TeamRole) => void
  error: string | null
  isSending: boolean
  onSubmit: (event: React.FormEvent) => void
}

function InviteDialog({
  open,
  onOpenChange,
  fullName,
  setFullName,
  email,
  setEmail,
  role,
  setRole,
  error,
  isSending,
  onSubmit,
}: InviteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} ariaLabel="Teamlid uitnodigen">
      <form onSubmit={onSubmit}>
        <DialogHeader>
          <DialogTitle>Teamlid uitnodigen</DialogTitle>
          <DialogDescription>
            De collega ontvangt een e-mail van Darwin met een koppeling om een wachtwoord te kiezen.
          </DialogDescription>
        </DialogHeader>
        <DialogContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-invite-name">Naam</Label>
            <Input
              id="team-invite-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Bijv. Jan de Vries"
              maxLength={100}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-invite-email">E-mailadres</Label>
            <Input
              id="team-invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="collega@organisatie.nl"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-invite-role">Rol</Label>
            <Select
              id="team-invite-role"
              value={role}
              onValueChange={(value) => {
                if (value === 'admin' || value === 'member') setRole(value)
              }}
              options={ROLE_OPTIONS}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button type="submit" disabled={isSending}>
            {isSending ? 'Versturen...' : 'Uitnodigen'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

export default TeamManager
