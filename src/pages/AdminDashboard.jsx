import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  Database, 
  Users, 
  Trash2, 
  AlertTriangle, 
  ArrowRight, 
  GraduationCap, 
  Calendar, 
  ShieldCheck, 
  Loader2, 
  X, 
  Layers
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [selectedYear, setSelectedYear] = useState('2026/2027')
  const [selectedYearCount, setSelectedYearCount] = useState(0)
  const [stats, setStats] = useState({
    students2026: 0,
    students2025: 0,
    totalUsers: 0,
    totalEkskuls: 0,
    loading: true
  })

  // State untuk Hapus Siswa per Tahun Ajaran
  const [selectedYearToDelete, setSelectedYearToDelete] = useState('2025/2026')
  const [yearCount, setYearCount] = useState(0)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  // Supabase Realtime Listener untuk pembaruan statistik otomatis
  useEffect(() => {
    let timer = null
    const handleRealtimeChange = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        fetchDashboardStats()
        fetchYearStudentCount(selectedYearToDelete)
      }, 1500)
    }

    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        handleRealtimeChange
      )
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [selectedYearToDelete])

  useEffect(() => {
    fetchYearStudentCount(selectedYearToDelete)
  }, [selectedYearToDelete])

  useEffect(() => {
    async function fetchSelectedYearStudents() {
      try {
        let query = supabase.from('students').select('*', { count: 'exact', head: true })
        if (selectedYear === '2025/2026') {
          query = query.or('academic_year.eq.2025/2026,academic_year.is.null')
        } else {
          query = query.eq('academic_year', selectedYear)
        }
        const { count } = await query
        setSelectedYearCount(count || 0)
      } catch (err) {
        console.error(err)
      }
    }
    fetchSelectedYearStudents()
  }, [selectedYear])

  async function fetchDashboardStats() {
    try {
      setStats(prev => ({ ...prev, loading: true }))

      // 1. Hitung siswa 2026/2027
      const { count: count2026 } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('academic_year', '2026/2027')

      // 2. Hitung siswa 2025/2026 (termasuk yang belum memiliki nilai academic_year / null)
      const { count: count2025 } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .or('academic_year.eq.2025/2026,academic_year.is.null')

      // 3. Hitung total user
      const { count: countUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      // 4. Hitung total ekskul
      const { count: countEkskuls } = await supabase
        .from('extracurriculars')
        .select('*', { count: 'exact', head: true })

      setStats({
        students2026: count2026 || 0,
        students2025: count2025 || 0,
        totalUsers: countUsers || 0,
        totalEkskuls: countEkskuls || 0,
        loading: false
      })
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setStats(prev => ({ ...prev, loading: false }))
    }
  }

  async function fetchYearStudentCount(year) {
    try {
      let query = supabase.from('students').select('*', { count: 'exact', head: true })
      if (year === '2025/2026') {
        query = query.or('academic_year.eq.2025/2026,academic_year.is.null')
      } else {
        query = query.eq('academic_year', year)
      }
      const { count } = await query
      setYearCount(count || 0)
    } catch (err) {
      console.error('Error fetching year count:', err)
    }
  }

  const handleDeleteByYear = async (e) => {
    e.preventDefault()
    if (confirmInput !== 'HAPUS') {
      toast.error('Ketik kata "HAPUS" untuk konfirmasi pembatalan/penghapusan.')
      return
    }

    setIsDeleting(true)
    toast.loading(`Menghapus data siswa T.A. ${selectedYearToDelete}...`, { id: 'delete-year' })

    try {
      let deleteQuery = supabase.from('students').delete()
      if (selectedYearToDelete === '2025/2026') {
        deleteQuery = deleteQuery.or('academic_year.eq.2025/2026,academic_year.is.null')
      } else {
        deleteQuery = deleteQuery.eq('academic_year', selectedYearToDelete)
      }

      const { error } = await deleteQuery

      if (error) throw error

      toast.success(`Data siswa T.A. ${selectedYearToDelete} berhasil dihapus!`, { id: 'delete-year' })
      setShowDeleteModal(false)
      setConfirmInput('')
      fetchDashboardStats()
      fetchYearStudentCount(selectedYearToDelete)
    } catch (err) {
      console.error(err)
      toast.error(`Gagal menghapus data: ${err.message}`, { id: 'delete-year' })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary-700 via-primary-600 to-blue-800 rounded-3xl p-8 text-white shadow-xl shadow-primary-900/10">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold mb-4 border border-white/15">
            <ShieldCheck size={14} className="text-blue-300" />
            <span>Role: Administrator Utama</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Dashboard Administrator</h1>
          <p className="text-white/80 text-sm mt-2 leading-relaxed">
            Selamat datang di panel kendali SIP-EK. Kelola basis data siswa per tahun ajaran, manajemen pengguna, serta pemeliharaan data ekstrakurikuler secara terpusat.
          </p>
        </div>

        {/* Background decorative circles */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-40 -top-20 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Filter Bar: Tahun Ajaran Dropdown (Revisi Poin 1) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-primary-600 shrink-0" />
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0">
            Tahun Ajaran Aktif:
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="input-field py-1.5 px-3 text-xs font-bold text-slate-800 bg-slate-50 w-auto min-w-[140px]"
          >
            <option value="2026/2027">2026/2027</option>
            <option value="2025/2026">2025/2026</option>
            <option value="2027/2028">2027/2028</option>
          </select>
        </div>

        <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Terpilih: T.A. {selectedYear} ({selectedYearCount} siswa terdaftar)</span>
        </div>
      </div>

      {/* Quick Statistics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Siswa T.A. 2026/2027</p>
            <p className="text-2xl font-black text-slate-800 mt-1">
              {stats.loading ? '...' : stats.students2026}
            </p>
            <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md mt-2 inline-block">
              Tahun Ajaran Baru
            </span>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <GraduationCap size={24} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Siswa T.A. 2025/2026</p>
            <p className="text-2xl font-black text-slate-800 mt-1">
              {stats.loading ? '...' : stats.students2025}
            </p>
            <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md mt-2 inline-block">
              Data Arsip
            </span>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Calendar size={24} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total User Sistem</p>
            <p className="text-2xl font-black text-slate-800 mt-1">
              {stats.loading ? '...' : stats.totalUsers}
            </p>
            <span className="text-[11px] text-primary-600 font-medium bg-primary-50 px-2 py-0.5 rounded-md mt-2 inline-block">
              Pelatih, Koordinator, Pendamping
            </span>
          </div>
          <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ekstrakurikuler</p>
            <p className="text-2xl font-black text-slate-800 mt-1">
              {stats.loading ? '...' : stats.totalEkskuls}
            </p>
            <span className="text-[11px] text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded-md mt-2 inline-block">
              Wajib & Pilihan
            </span>
          </div>
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
            <Layers size={24} />
          </div>
        </div>
      </div>

      {/* Main Navigation Card Buttons */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-4">Akses Cepat Menu</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card Button 1: Manajemen Data Siswa */}
          <div 
            onClick={() => navigate('/master-data')}
            className="group relative bg-white hover:bg-gradient-to-br hover:from-white hover:to-blue-50/50 rounded-3xl p-7 border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-primary-300 transition-all duration-300 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary-600 group-hover:text-white transition-all duration-300 shadow-sm">
                  <Database size={28} />
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-primary-50 text-primary-700 rounded-full border border-primary-100">
                  Data Master
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-800 group-hover:text-primary-600 transition-colors">
                Management Data Siswa
              </h3>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Akses tabel siswa Tahun Ajaran 2026/2027 dengan server pagination, unggah file Excel data siswa baru, dan pemetaan pilihan ekskul.
              </p>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-primary-600 font-bold text-sm">
              <span>Buka Data Siswa</span>
              <div className="w-8 h-8 rounded-full bg-primary-50 group-hover:bg-primary-600 group-hover:text-white flex items-center justify-center transition-all duration-300 group-hover:translate-x-1">
                <ArrowRight size={16} />
              </div>
            </div>
          </div>

          {/* Card Button 2: Management User */}
          <div 
            onClick={() => navigate('/management-user')}
            className="group relative bg-white hover:bg-gradient-to-br hover:from-white hover:to-blue-50/50 rounded-3xl p-7 border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm">
                  <Users size={28} />
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                  User & Role
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                Management User
              </h3>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Kelola hak akses akun login untuk Koordinator, Pelatih, dan Pendamping, tambah user baru, serta ganti kata sandi.
              </p>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-blue-600 font-bold text-sm">
              <span>Buka Management User</span>
              <div className="w-8 h-8 rounded-full bg-blue-50 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-all duration-300 group-hover:translate-x-1">
                <ArrowRight size={16} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone: Hapus Data Siswa per Tahun Ajaran */}
      <div className="bg-white rounded-3xl border border-red-100 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 bg-gradient-to-r from-red-50/60 to-white border-b border-red-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Pembersihan / Hapus Data Siswa per Tahun Ajaran</h3>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">
                Fitur ini digunakan saat pergantian periode sekolah untuk menghapus siswa pada tahun ajaran tertentu beserta seluruh riwayat nilainya.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-2 space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Pilih Tahun Ajaran yang Ingin Dihapus
              </label>
              <div className="flex flex-wrap gap-3">
                <select 
                  value={selectedYearToDelete} 
                  onChange={(e) => setSelectedYearToDelete(e.target.value)}
                  className="input-field py-2.5 max-w-xs font-semibold text-slate-800"
                >
                  <option value="2025/2026">Tahun Ajaran 2025/2026 (Data Lama)</option>
                  <option value="2026/2027">Tahun Ajaran 2026/2027 (Data Baru)</option>
                  <option value="2027/2028">Tahun Ajaran 2027/2028</option>
                </select>

                <div className="flex items-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 font-medium">
                  Terdata saat ini: <strong className="ml-1 text-slate-900 font-bold">{yearCount} Siswa</strong>
                </div>
              </div>
            </div>

            <div className="sm:col-span-1 flex justify-start sm:justify-end">
              <button 
                onClick={() => {
                  setConfirmInput('')
                  setShowDeleteModal(true)
                }}
                disabled={yearCount === 0}
                className="btn bg-red-600 hover:bg-red-700 text-white py-2.5 px-5 flex items-center gap-2 text-sm shadow-md shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 size={16} />
                Hapus Data Siswa T.A. {selectedYearToDelete}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-red-100 relative">
            <button 
              onClick={() => setShowDeleteModal(false)}
              className="absolute right-5 top-5 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>

            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-5">
              <AlertTriangle size={28} />
            </div>

            <h3 className="text-xl font-bold text-slate-900">Konfirmasi Penghapusan Masal</h3>
            <p className="text-slate-600 text-xs sm:text-sm mt-2 leading-relaxed">
              Anda akan menghapus seluruh data sebanyak <strong>{yearCount} siswa</strong> pada <strong>Tahun Ajaran {selectedYearToDelete}</strong>. Seluruh riwayat nilai siswa tersebut juga akan terhapus permanen dari sistem.
            </p>

            <div className="my-5 p-3.5 bg-red-50 rounded-xl border border-red-100 text-xs text-red-700 font-medium">
              Tindakan ini tidak dapat dibatalkan. Ketik <strong>HAPUS</strong> di bawah untuk mengonfirmasi:
            </div>

            <form onSubmit={handleDeleteByYear} className="space-y-4">
              <input 
                type="text" 
                placeholder="Ketik HAPUS" 
                value={confirmInput} 
                onChange={(e) => setConfirmInput(e.target.value)}
                className="input-field text-center font-bold tracking-widest text-red-600 border-red-200 uppercase focus:border-red-500"
                required
              />

              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 btn btn-secondary py-2.5 text-xs font-semibold"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={confirmInput !== 'HAPUS' || isDeleting}
                  className="flex-1 btn bg-red-600 hover:bg-red-700 text-white py-2.5 text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Menghapus...
                    </>
                  ) : (
                    'Ya, Hapus Permanen'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
