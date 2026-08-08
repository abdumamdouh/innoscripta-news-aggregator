import { Outlet } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="app-shell app-main motion-page flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
