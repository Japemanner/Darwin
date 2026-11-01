import { useAuth } from '@/hooks/useAuth'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import TeamManager from '@/components/team/TeamManager'

function TeamPage() {
  const { profile } = useAuth()

  if (!profile || profile.role !== 'admin' || !profile.organization_id) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Geen toegang</CardTitle>
          <CardDescription>
            Alleen een beheerder van uw organisatie kan het team bekijken en wijzigen.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-muted-foreground">Beheer teamleden en uitnodigingen.</p>
      </div>

      <TeamManager organizationId={profile.organization_id} />
    </div>
  )
}

export default TeamPage
