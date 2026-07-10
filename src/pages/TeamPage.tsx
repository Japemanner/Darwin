import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select } from '@/components/ui/select'
import { useTeamMembers, useInvitations, useRevokeInvitation } from '@/hooks/queries'
import type { Invitation } from '@/types/database.types'
import { Users, UserPlus, Mail, Trash2 } from 'lucide-react'

const ROLE_OPTIONS = [
  { value: 'member', label: 'Lid' },
  { value: 'admin', label: 'Admin' },
]

function TeamPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const { data: members, isPending: membersLoading } = useTeamMembers(profile?.organization_id)
  const { data: invitations, isPending: invLoading } = useInvitations(profile?.organization_id)
  const revokeMutation = useRevokeInvitation(profile?.organization_id ?? '')
  const [inviteOpen, setInviteOpen] = useState(false)

  const isLoading = membersLoading || invLoading

  const handleRevokeInvite = async (invitation: Invitation) => {
    try {
      await revokeMutation.mutateAsync(invitation.id)
      toast({ title: 'Uitnodiging ingetrokken' })
    } catch (err) {
      toast({ title: 'Fout', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
    }
  }

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div><Skeleton className="h-8 w-32" /><Skeleton className="h-4 w-48 mt-2" /></div>
        </div>
        <Card><CardHeader><Skeleton className="h-6 w-24" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-muted-foreground">Beheer teamleden en uitnodigingen</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Nodig uit
        </Button>
      </div>

      {(members ?? []).length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="Nog geen teamleden"
          description="Nodig collega's uit om samen te werken"
          action={{ label: 'Nodig een lid uit', onClick: () => setInviteOpen(true) }}
        />
      ) : (
        <Card>
          <CardHeader><CardTitle>Leden ({(members ?? []).length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Toegevoegd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(members ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar fallback={m.full_name} size="sm" />
                        <span className="font-medium">{m.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.role === 'admin' ? 'default' : 'secondary'}>
                        {m.role === 'admin' ? 'Admin' : 'Lid'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString('nl-NL')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {(invitations ?? []).length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Openstaande uitnodigingen ({(invitations ?? []).length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Verzonden</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invitations ?? []).map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{inv.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={inv.role === 'admin' ? 'default' : 'secondary'}>
                        {inv.role === 'admin' ? 'Admin' : 'Lid'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(inv.created_at).toLocaleDateString('nl-NL')}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleRevokeInvite(inv)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <InviteModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        organizationId={profile?.organization_id ?? ''}
      />
    </div>
  )
}

function InviteModal({
  open,
  onOpenChange,
  organizationId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
}) {
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [isSending, setIsSending] = useState(false)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSending(true)
    try {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: { email, organization_id: organizationId, role },
      })
      if (error) throw error
      toast({ title: 'Uitnodiging verzonden', description: `Uitnodiging gestuurd naar ${email}` })
      onOpenChange(false)
      setEmail('')
      setRole('member')
    } catch (err) {
      toast({ title: 'Fout bij uitnodigen', description: err instanceof Error ? err.message : 'Onbekende fout', variant: 'destructive' })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={handleInvite}>
        <DialogHeader><DialogTitle>Teamlid uitnodigen</DialogTitle></DialogHeader>
        <DialogContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">E-mailadres</Label>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="collega@organisatie.nl" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-role">Rol</Label>
            <Select value={role} onValueChange={setRole} options={ROLE_OPTIONS} />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button type="submit" disabled={isSending}>{isSending ? 'Versturen...' : 'Uitnodigen'}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

export default TeamPage