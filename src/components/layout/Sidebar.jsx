import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Database, 
  PenTool, 
  Users, 
  FileText,
  School
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const NavItem = ({ to, icon: Icon, children }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `
      flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
      ${isActive 
        ? 'bg-primary-500 text-white shadow-lg shadow-primary-200' 
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}
    `}
  >
    <Icon size={20} />
    <span className="font-medium">{children}</span>
  </NavLink>
)

export default function Sidebar() {
  const { profile } = useAuthStore()

  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col flex-shrink-0">
      <div className="p-8">
        <div className="flex items-center gap-3 text-primary-600 mb-2">
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
            <School size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">SIPEK</h1>
        </div>
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold px-1">
          Ekskul Management
        </p>
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        <NavItem to="/" icon={LayoutDashboard}>Dashboard</NavItem>
        
        {profile?.role === 'master_data' && (
          <NavItem to="/master-data" icon={Database}>Master Data</NavItem>
        )}
        
        {profile?.role === 'pelatih' && (
          <NavItem to="/pelatih" icon={PenTool}>Input Nilai</NavItem>
        )}
        
        {profile?.role === 'pendamping' && (
          <NavItem to="/pendamping" icon={Users}>Data Siswa</NavItem>
        )}
        
        {profile?.role === 'koordinator' && (
          <NavItem to="/koordinator" icon={FileText}>Rekap Nilai</NavItem>
        )}
      </nav>
      
      <div className="p-6 mt-auto">
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
          <p className="text-xs text-slate-400 mb-1">Versi Aplikasi</p>
          <p className="text-sm font-semibold text-slate-600">v1.0.0 Stable</p>
        </div>
      </div>
    </aside>
  )
}
