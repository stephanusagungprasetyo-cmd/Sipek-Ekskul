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
import logoKecil from '../../assets/Logo_BPK_PENABURlogokecil.png'

const NavItem = ({ to, icon: Icon, children, isCollapsed }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `
      flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
      ${isActive 
        ? 'bg-white text-primary-600 shadow-lg shadow-black/10 font-bold' 
        : 'text-white/80 hover:bg-white/10 hover:text-white'}
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
    <aside className="h-full bg-gradient-to-b from-primary-500 to-primary-600 border-r border-primary-600/20 flex flex-col relative">
      <button 
        onClick={toggleCollapse}
        className="absolute -right-3 top-20 w-6 h-6 bg-primary-600 border border-primary-700 text-blue-100 hover:text-white hover:bg-primary-700 rounded-full hidden lg:flex items-center justify-center shadow-md z-50 transition-all"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className={`p-6 mb-2 ${isCollapsed ? 'flex justify-center' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-sm border border-slate-100 p-1">
            <img src={logoKecil} alt="Logo BPK PENABUR" className="w-full h-full object-contain" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-black tracking-tighter text-white leading-none">SIP-EK</h1>
              <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold mt-1">SYSTEM</p>
            </div>
          )}
        </div>
      </div>
      
      <nav className="flex-1 px-3 space-y-1">
        <NavItem to="/" icon={LayoutDashboard} isCollapsed={isCollapsed}>Dashboard</NavItem>
        
        <div className={`my-4 border-t border-white/10 mx-2 ${isCollapsed ? 'hidden' : ''}`} />
        
        {profile?.role === 'master_data' && (
          <>
            <NavItem to="/master-data" icon={Database} isCollapsed={isCollapsed}>Master Data</NavItem>
            <NavItem to="/management-user" icon={Users} isCollapsed={isCollapsed}>Management User</NavItem>
          </>
        )}
        
        {profile?.role === 'pelatih' && (
          <NavItem to="/input-nilai" icon={PenTool} isCollapsed={isCollapsed}>Input Nilai</NavItem>
        )}
        
        {profile?.role === 'pendamping' && (
          <>
            <NavItem to="/pendamping" icon={Users} isCollapsed={isCollapsed}>Monitoring</NavItem>
            <NavItem to="/input-nilai" icon={PenTool} isCollapsed={isCollapsed}>Input Nilai</NavItem>
          </>
        )}
        
        {profile?.role === 'koordinator' && (
          <>
            <NavItem to="/koordinator-monitoring" icon={Users} isCollapsed={isCollapsed}>Monitoring</NavItem>
            <NavItem to="/koordinator" icon={FileText} isCollapsed={isCollapsed}>Rekap Nilai</NavItem>
          </>
        )}
      </nav>
      
      <div className="p-4 mt-auto">
        {isCollapsed ? (
          <button 
            onClick={logout}
            className="w-full h-12 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-red-200 rounded-xl transition-all"
            title="Keluar"
          >
            <LogOut size={20} />
          </button>
        ) : (
          <div className="bg-primary-600/30 rounded-2xl p-4 border border-white/5">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Versi 1.1.0</p>
            <button 
              onClick={logout}
              className="w-full py-2.5 bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-red-600/25 hover:text-red-200 hover:border-red-500/20 transition-all flex items-center justify-center gap-2"
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
