import dynamic from "next/dynamic"

const DashboardPageClient = dynamic(() => import("@/components/saudacao/DashboardPageClient"), {
  ssr: false,
  loading: () => <div className="h-screen bg-background" />,
})

export default function DashboardPage() {
  return <DashboardPageClient />
}
