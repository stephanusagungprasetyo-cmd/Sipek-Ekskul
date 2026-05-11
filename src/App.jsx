import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import DashboardLayout from './components/layout/DashboardLayout'

// Pages
import Login from './pages/Login'
import MasterData from './pages/MasterData'
import PelatihDashboard from './pages/PelatihDashboard'
import PendampingDashboard from './pages/PendampingDashboard'
import KoordinatorDashboard from './pages/KoordinatorDashboard'

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuthStore()

  if (loading) return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>
  if (!user) return <Navigate to="/login" />
  
  if (allowedRoles && !allowedRoles.includes(profile?.role)) {
    return <Navigate to="/" />
  }

  return children
}

const HomeRedirect = () => {
  const { profile } = useAuthStore()
  
  if (!profile) return <Navigate to="/login" />
  
  switch (profile.role) {
    case 'master_data': return <Navigate to="/master-data" />
    case 'pelatih': return <Navigate to="/pelatih" />
    case 'pendamping': return <Navigate to="/pendamping" />
    case 'koordinator': return <Navigate to="/koordinator" />
    default: return <Navigate to="/login" />
  }
}

function App() {
  const { refreshSession } = useAuthStore()

  useEffect(() => {
    refreshSession()
  }, [])

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<HomeRedirect />} />
          
          <Route path="/master-data" element={
            <ProtectedRoute allowedRoles={['master_data']}>
              <MasterData />
            </ProtectedRoute>
          } />
          
          <Route path="/pelatih" element={
            <ProtectedRoute allowedRoles={['pelatih']}>
              <PelatihDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/pendamping" element={
            <ProtectedRoute allowedRoles={['pendamping']}>
              <PendampingDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/koordinator" element={
            <ProtectedRoute allowedRoles={['koordinator']}>
              <KoordinatorDashboard />
            </ProtectedRoute>
          } />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
