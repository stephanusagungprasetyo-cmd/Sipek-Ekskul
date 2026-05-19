import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  UserPlus, 
  Trash2, 
  Edit3, 
  Search, 
  X, 
  Save, 
  Loader2, 
  Key, 
  Shield, 
  UserCheck,
  AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function ManagementUser() {
  const [profiles, setProfiles] = useState([])
  const [ekskuls, setEkskuls] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('pelatih')
  const [ekskulId, setEkskulId] = useState('')
  
  // Edit form state
  const [editingProfile, setEditingProfile] = useState(null)
  const [editPassword, setEditPassword] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editEkskulId, setEditEkskulId] = useState('')

  useEffect(() => {
    fetchProfiles()
    fetchEkskuls()
  }, [])

  async function fetchEkskuls() {
    const { data } = await supabase.from('extracurriculars').select('*').order('name')
    setEkskuls(data || [])
  }

  async function fetchProfiles() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*, extracurriculars(id, name)')
      .order('created_at', { ascending: false })
    
    if (error) {
      toast.error('Gagal mengambil data user')
    } else {
      setProfiles(data || [])
    }
    setLoading(false)
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    if (!username || !password) return
    
    setIsSubmitting(true)
    toast.loading('Sedang mendaftarkan user...', { id: 'auth-action' })

    try {
      // Call SQL RPC function to create user & profile inside database transaction
      const { data: newUserId, error: signUpError } = await supabase.rpc('create_user', {
        new_username: username.toLowerCase(),
        new_password: password,
        new_role: role
      })

      if (signUpError) {
        throw new Error(signUpError.message || 'Gagal membuat user. Pastikan Anda telah menjalankan query dari "supabase_update.sql" di SQL Editor Supabase.')
      }

      if (!newUserId) {
        throw new Error('Gagal mendapatkan ID user baru dari server.')
      }

      toast.success('User berhasil dibuat!', { id: 'auth-action' })
      setShowAddModal(false)
      // Reset form
      setUsername('')
      setPassword('')
      setRole('pelatih')
      setEkskulId('')
      fetchProfiles()

    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Gagal membuat user', { id: 'auth-action' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditClick = (profile) => {
    setEditingProfile(profile)
    setEditRole(profile.role)
    setEditEkskulId(profile.extracurricular_id || '')
    setEditPassword('')
    setShowEditModal(true)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingProfile) return

    setIsSubmitting(true)
    toast.loading('Memperbarui user...', { id: 'auth-action' })

    try {
      // 1. Update password via RPC if specified
      if (editPassword) {
        const { error: pwdError } = await supabase.rpc('update_user_password', {
          user_id: editingProfile.id,
          new_password: editPassword
        })
        if (pwdError) {
          throw new Error('Gagal memperbarui password. Pastikan script SQL "supabase_update.sql" sudah dijalankan di Supabase.')
        }
      }

      // 2. Update profile (role only)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: editRole
        })
        .eq('id', editingProfile.id)

      if (profileError) throw profileError

      toast.success('User berhasil diperbarui!', { id: 'auth-action' })
      setShowEditModal(false)
      fetchProfiles()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Gagal memperbarui user', { id: 'auth-action' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async (profileId, name) => {
    if (name === 'admin') {
      toast.error('User admin utama tidak dapat dihapus!')
      return
    }

    if (!window.confirm(`Apakah Anda yakin ingin menghapus user "${name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return
    }

    toast.loading('Menghapus user...', { id: 'auth-action' })
    
    try {
      const { error } = await supabase.rpc('delete_user_by_id', { user_id: profileId })
      if (error) {
        throw new Error('Gagal menghapus user. Pastikan script SQL "supabase_update.sql" sudah dijalankan di Supabase.')
      }

      toast.success('User berhasil dihapus!', { id: 'auth-action' })
      fetchProfiles()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Gagal menghapus user', { id: 'auth-action' })
    }
  }

  const filteredProfiles = profiles.filter(p => 
    p.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.extracurriculars?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Management User</h2>
          <p className="text-slate-500 mt-1">Kelola akun login untuk Pendamping, Koordinator, dan Pelatih.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Cari user, role, atau ekskul..."
              className="input-field pl-12"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button 
            onClick={() => setShowAddModal(true)} 
            className="btn btn-primary flex items-center gap-2"
          >
            <UserPlus size={18} />
            Tambah User Baru
          </button>
        </div>
      </div>

      {/* SQL Warning Alert */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3 text-amber-800 text-sm">
        <AlertTriangle className="shrink-0 text-amber-500" size={20} />
        <div>
          <span className="font-bold">Penting:</span> Untuk mengaktifkan fungsi hapus user dan reset password, harap pastikan Anda telah menjalankan query dari file <span className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-xs">supabase_update.sql</span> di SQL Editor Supabase Anda.
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p>Memuat data user...</p>
          </div>
        ) : filteredProfiles.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-modern whitespace-nowrap">
              <thead>
                <tr>
                  <th className="w-16">No</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th className="w-24 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="text-slate-400">{idx + 1}</td>
                    <td className="font-bold text-slate-800">{p.username}</td>
                    <td className="text-slate-500 font-medium">
                      {p.username === 'admin' ? `${p.username}@sipek.local` : `${p.username}@sipek.com`}
                    </td>
                    <td>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        p.role === 'master_data' ? 'bg-purple-100 text-purple-700' :
                        p.role === 'koordinator' ? 'bg-blue-100 text-blue-700' :
                        p.role === 'pelatih' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {p.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-2">
                        {p.username !== 'admin' ? (
                          <>
                            <button 
                              onClick={() => handleEditClick(p)} 
                              className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                              title="Edit User"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(p.id, p.username)} 
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Hapus User"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-300 italic flex items-center gap-1">
                            <Shield size={12} /> Utama
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-20 text-center text-slate-400">Belum ada data user.</div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <UserCheck size={20} className="text-primary-600" />
                Tambah User Baru
              </h3>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Username</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Contoh: budi, siska"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))} 
                  required 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Password</label>
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Role</label>
                <select 
                  className="input-field" 
                  value={role} 
                  onChange={(e) => {
                    setRole(e.target.value)
                    setEkskulId('')
                  }}
                >
                  <option value="pelatih">Pelatih</option>
                  <option value="pendamping">Pendamping</option>
                  <option value="koordinator">Koordinator</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 btn btn-secondary py-3.5"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-1/2 btn btn-primary py-3.5 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingProfile && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Edit3 size={20} className="text-primary-600" />
                Edit User: {editingProfile.username}
              </h3>
              <button 
                onClick={() => setShowEditModal(false)} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Key size={14} className="text-slate-400" />
                  Reset Password (Opsional)
                </label>
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder="Kosongkan jika tidak diganti"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Role</label>
                <select 
                  className="input-field" 
                  value={editRole} 
                  onChange={(e) => {
                    setEditRole(e.target.value)
                    setEditEkskulId('')
                  }}
                >
                  <option value="pelatih">Pelatih</option>
                  <option value="pendamping">Pendamping</option>
                  <option value="koordinator">Koordinator</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)}
                  className="w-1/2 btn btn-secondary py-3.5"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-1/2 btn btn-primary py-3.5 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
