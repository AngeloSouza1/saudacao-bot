import DashboardPageClient from "@/components/saudacao/DashboardPageClient"
import { LoginPage } from "@/components/saudacao/LoginPage"
import { getPanelSession } from "@/lib/panel-auth"

export default async function DashboardPage() {
  const session = await getPanelSession()
  if (!session.authenticated) {
    return <LoginPage />
  }
  return <DashboardPageClient panelSession={session} />
}
