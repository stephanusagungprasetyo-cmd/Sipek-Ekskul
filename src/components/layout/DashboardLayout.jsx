import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import Sidebar from './Sidebar'
import { LogOut, User } from 'lucide-react'

export default function DashboardLayout() {
  const { profile, logout } = useAuthStore()

  if (!profile) return <Navigate to="/login" />

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="text-sm font-medium">Dashboard / {profile.role.replace('_', ' ').toUpperCase()}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
              <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-white">
                <User size={14} />
              </div>
              <span className="text-xs font-semibold text-slate-600 capitalize">{profile.username}</span>
            </div>
            
            <button 
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
