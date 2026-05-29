import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Bot, BookOpen, Users, ClipboardList } from 'lucide-react'

interface Stats {
  assistants: number
  knowledgeBases: number
  teamMembers: number
}

function DashboardPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!profile?.organization_id) return

    async function loadStats() {
      const orgId = profile!.organization_id
      const [assistantsRes, kbRes, membersRes] = await Promise.all([
        supabase.from('ai_assistants').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('knowledge_bases').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
      ])

      setStats({
        assistants: assistantsRes.count ?? 0,
        knowledgeBases: kbRes.count ?? 0,
        teamMembers: membersRes.count ?? 0,
      })
      setIsLoading(false)
    }

    loadStats()
  }, [profile])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Welkom terug, {profile?.full_name?.split(' ')[0] ?? 'gebruiker'}</h1>
      <p className="text-muted-foreground mb-8">Hier is een overzicht van je omgeving</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-12" />
                </CardContent>
              </Card>
            ))
          : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Assistenten</CardTitle>
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats?.assistants}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Kennisbronnen</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats?.knowledgeBases}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Teamleden</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats?.teamMembers}</p>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Taken</CardTitle>
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Binnenkort beschikbaar</p>
                </CardContent>
              </Card>
            </>
          )}
      </div>
    </div>
  )
}

export default DashboardPage
