import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Database, 
  PenTool, 
  Users, 
  FileText,
  School,
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const NavItem = ({ to, icon: Icon, children, isCollapsed }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `
      flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
      ${isActive 
        ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' 
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}
      ${isCollapsed ? 'justify-center px-2' : ''}
    `}
    title={isCollapsed ? children : ''}
  >
    {({ isActive }) => (
      <>
        <Icon size={20} className={`${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform`} />
        {!isCollapsed && <span className="font-semibold text-sm tracking-wide">{children}</span>}
      </>
    )}
  </NavLink>
)

export default function Sidebar({ isCollapsed, toggleCollapse }) {
  const { profile, logout } = useAuthStore()

  return (
    <aside className="h-full bg-white border-r border-slate-100 flex flex-col relative">
      <button 
        onClick={toggleCollapse}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-100 rounded-full hidden lg:flex items-center justify-center text-slate-400 hover:text-primary-600 hover:border-primary-100 shadow-sm z-50 transition-all"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className={`p-6 mb-2 ${isCollapsed ? 'flex justify-center' : ''}`}>
        <div className="flex items-center gap-3 text-primary-600">
          <div className="w-10 h-10 bg-primary-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary-100 shrink-0">
            <School size={24} />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-black tracking-tighter text-slate-800 leading-none">SIPEK</h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">SYSTEM</p>
            </div>
          )}
        </div>
      </div>
      
      <nav className="flex-1 px-3 space-y-1">
        <NavItem to="/" icon={LayoutDashboard} isCollapsed={isCollapsed}>Dashboard</NavItem>
        
        <div className={`my-4 border-t border-slate-50 mx-2 ${isCollapsed ? 'hidden' : ''}`} />
        
        {profile?.role === 'master_data' && (
          <>
            <NavItem to="/master-data" icon={Database} isCollapsed={isCollapsed}>Master Data</NavItem>
            <NavItem to="/management-user" icon={Users} isCollapsed={isCollapsed}>Management User</NavItem>
          </>
        )}
        
        {profile?.role === 'pelatih' && (
          <NavItem to="/pelatih" icon={PenTool} isCollapsed={isCollapsed}>Input Nilai</NavItem>
        )}
        
        {profile?.role === 'pendamping' && (
          <NavItem to="/pendamping" icon={Users} isCollapsed={isCollapsed}>Monitoring</NavItem>
        )}
        
        {profile?.role === 'koordinator' && (
          <NavItem to="/koordinator" icon={FileText} isCollapsed={isCollapsed}>Rekap Nilai</NavItem>
        )}
      </nav>
      
      <div className="p-4 mt-auto">
        {isCollapsed ? (
          <button 
            onClick={logout}
            className="w-full h-12 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
            title="Keluar"
          >
            <LogOut size={20} />
          </button>
        ) : (
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Versi 1.1.0</p>
            <button 
              onClick={logout}
              className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={16} />
              Keluar
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
