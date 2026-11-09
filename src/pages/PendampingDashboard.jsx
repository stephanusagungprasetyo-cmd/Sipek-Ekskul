import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Search,
  Calendar,
  ArrowRight,
  PenTool,
  BarChart3,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ShieldCheck,
  Layers,
  X,
  ArrowUpDown
} from 'lucide-react'
import toast from 'react-hot-toast'

const getGrade = (score) => {
  if (!score || score <= 0) return '-'
  if (score >= 86) return 'A'
  if (score >= 71) return 'B'
  return 'C'
}

export default function PendampingDashboard() {
  const navigate = useNavigate()

  // Filter Utama: Tahun Ajaran & Semester
  const [selectedYear, setSelectedYear] = useState('2026/2027')
  const [selectedSemester, setSelectedSemester] = useState('1') // '1' atau '2'

  // Tab View Aktif: 'students' (Tabel Nilai Siswa) atau 'monitoring' (Progres Ekskul)
  const [activeTab, setActiveTab] = useState('students')

  // Data Ekstrakurikuler
  const [ekskulList, setEkskulList] = useState([])
  const [selectedEkskulFilter, setSelectedEkskulFilter] = useState('all')

  // Server-side Pagination State (Tabel Siswa - Pilihan: 10, 20, 50)
  const [studentsScores, setStudentsScores] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loadingTable, setLoadingTable] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'student.class_name', direction: 'asc' })

  // Monitoring Stats per Ekskul
  const [monitoringStats, setMonitoringStats] = useState([])
  const [loadingMonitoring, setLoadingMonitoring] = useState(true)

  // Overall Ringkasan Stats
  const [summaryStats, setSummaryStats] = useState({
    totalStudents: 0,
    filledCount: 0,
    pendingCount: 0,
    totalEkskuls: 0,
    loading: true
  })

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch initial extracurriculars
  const fetchEkskuls = useCallback(async () => {
    const { data } = await supabase.from('extracurriculars').select('*').order('name')
    setEkskulList(data || [])
  }, [])

  useEffect(() => {
    fetchEkskuls()
  }, [fetchEkskuls])

  // Fetch Ringkasan & Monitoring Stats saat Tahun Ajaran / Semester berubah
  const fetchOverviewData = useCallback(async () => {
    try {
      setSummaryStats(prev => ({ ...prev, loading: true }))
      setLoadingMonitoring(true)

      const { data: ekskuls } = await supabase.from('extracurriculars').select('*').order('name')
      if (!ekskuls) return

      // Batched fetch scores untuk tahun ajaran aktif
      let allScores = []
      let p = 0
      const batchSize = 1000
      let hasMore = true

      while (hasMore) {
        let query = supabase
          .from('scores')
          .select('extracurricular_id, semester, average_score, att_1, student:students!inner(academic_year)')
          .range(p * batchSize, (p + 1) * batchSize - 1)

        if (selectedYear === '2025/2026') {
          query = query.or('academic_year.eq.2025/2026,academic_year.is.null', { foreignTable: 'students' })
        } else {
          query = query.eq('student.academic_year', selectedYear)
        }

        let { data, error } = await query

        if (error) {
          let fbQuery = supabase
            .from('scores')
            .select('extracurricular_id, average_score, att_1, student:students!inner(academic_year)')
            .range(p * batchSize, (p + 1) * batchSize - 1)

          if (selectedYear === '2025/2026') {
            fbQuery = fbQuery.or('academic_year.eq.2025/2026,academic_year.is.null', { foreignTable: 'students' })
          } else {
            fbQuery = fbQuery.eq('student.academic_year', selectedYear)
          }

          const fbRes = await fbQuery
          data = fbRes.data
          error = fbRes.error
        }

        if (error || !data || data.length < batchSize) hasMore = false
        if (data) allScores = [...allScores, ...data]
        p++
      }

      // Filter scores sesuai semester yang dipilih
      const semesterFilteredScores = allScores.filter(s =>
        s.semester === undefined || s.semester === null || s.semester === Number(selectedSemester)
      )

      // Hitung agregasi per ekskul
      let totalFilled = 0
      let totalAll = semesterFilteredScores.length

      const calculated = ekskuls.map(e => {
        const scoresThisEkskul = semesterFilteredScores.filter(s => s.extracurricular_id === e.id)
        const total = scoresThisEkskul.length
        const filled = scoresThisEkskul.filter(s => s.att_1 || s.average_score > 0).length
        totalFilled += filled

        return {
          ...e,
          totalStudents: total,
          filledScores: filled,
          progress: total > 0 ? (filled / total) * 100 : 0
        }
      })

      setMonitoringStats(calculated)
      setSummaryStats({
        totalStudents: totalAll,
        filledCount: totalFilled,
        pendingCount: Math.max(0, totalAll - totalFilled),
        totalEkskuls: ekskuls.length,
        loading: false
      })
    } catch (err) {
      console.error(err)
    } finally {
      setSummaryStats(prev => ({ ...prev, loading: false }))
      setLoadingMonitoring(false)
    }
  }, [selectedYear])

  useEffect(() => {
    fetchOverviewData()
  }, [fetchOverviewData])

  // Fetch Tabel Siswa dengan Server-side Pagination
  const fetchStudentsScoresTable = useCallback(async () => {
    setLoadingTable(true)
    try {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from('scores')
        .select(`
          id,
          att_1, att_2, att_3, att_4, att_5, att_6,
          att_7, att_8, att_9, att_10, att_11, att_12,
          prac_1, prac_2, prac_3, prac_4, prac_5,
          know_1, know_2, know_3,
          average_score,
          updated_at,
          extracurricular_id,
          student:students!inner(
            id,
            name,
            gender,
            class_name,
            academic_year
          ),
          extracurricular:extracurriculars(
            id,
            name
          )
        `, { count: 'exact' })

      // Filter Tahun Ajaran pada relasi student
      if (selectedYear === '2025/2026') {
        query = query.or('academic_year.eq.2025/2026,academic_year.is.null', { foreignTable: 'students' })
      } else {
        query = query.eq('student.academic_year', selectedYear)
      }

      // Filter Semester jika kolom tersedia
      query = query.eq('semester', Number(selectedSemester))

      // Filter Ekstrakurikuler jika dipilih spesifik
      if (selectedEkskulFilter !== 'all') {
        query = query.eq('extracurricular_id', selectedEkskulFilter)
      }

      // Filter Pencarian Nama Siswa
      if (debouncedSearch.trim()) {
        query = query.ilike('student.name', `%${debouncedSearch.trim()}%`)
      }

      // Sorting
      if (sortConfig.key === 'student.class_name') {
        query = query
          .order('class_name', { foreignTable: 'students', ascending: sortConfig.direction === 'asc' })
          .order('name', { foreignTable: 'students', ascending: true })
      } else if (sortConfig.key === 'student.name') {
        query = query.order('name', { foreignTable: 'students', ascending: sortConfig.direction === 'asc' })
      } else {
        query = query.order('updated_at', { ascending: sortConfig.direction === 'asc' })
      }

      // Range Pagination
      query = query.range(from, to)

      let { data, count, error } = await query

      // Fallback jika skema database (semester) belum ada di remote database
      if (error) {
        let fallbackQuery = supabase
          .from('scores')
          .select(`
            id,
            att_1, att_2, att_3, att_4, att_5, att_6,
            att_7, att_8, att_9, att_10, att_11, att_12,
            prac_1, prac_2, prac_3, prac_4, prac_5,
            know_1, know_2, know_3,
            average_score,
            updated_at,
            extracurricular_id,
            student:students!inner(
              id,
              name,
              gender,
              class_name,
              academic_year
            ),
            extracurricular:extracurriculars(
              id,
              name
            )
          `, { count: 'exact' })

        if (selectedYear === '2025/2026') {
          fallbackQuery = fallbackQuery.or('academic_year.eq.2025/2026,academic_year.is.null', { foreignTable: 'students' })
        } else {
          fallbackQuery = fallbackQuery.eq('student.academic_year', selectedYear)
        }
        if (selectedEkskulFilter !== 'all') {
          fallbackQuery = fallbackQuery.eq('extracurricular_id', selectedEkskulFilter)
        }
        if (debouncedSearch.trim()) {
          fallbackQuery = fallbackQuery.ilike('student.name', `%${debouncedSearch.trim()}%`)
        }
        fallbackQuery = fallbackQuery.range(from, to)
        const res = await fallbackQuery
        data = res.data
        count = res.count
        error = res.error
      }

      if (error) throw error

      setStudentsScores(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      console.error(err)
      toast.error('Gagal mengambil data nilai: ' + err.message)
    } finally {
      setLoadingTable(false)
    }
  }, [selectedYear, selectedSemester, selectedEkskulFilter, page, pageSize, debouncedSearch, sortConfig])

  useEffect(() => {
    fetchStudentsScoresTable()
  }, [fetchStudentsScoresTable])

  // Supabase Realtime Listener (Debounced 1.5 detik)
  useEffect(() => {
    let timer = null
    const handleRealtimeChange = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        fetchOverviewData()
        fetchStudentsScoresTable()
      }, 1500)
    }

    const channel = supabase
      .channel('pendamping-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores' },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'extracurriculars' },
        () => {
          fetchEkskuls()
          handleRealtimeChange()
        }
      )
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [fetchOverviewData, fetchStudentsScoresTable, fetchEkskuls])

  const handleYearChange = (year) => {
    setSelectedYear(year)
    setPage(1)
  }

  const handleSemesterChange = (semester) => {
    setSelectedSemester(semester)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome Banner (Mobile Responsive) */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary-700 via-primary-600 to-blue-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-primary-900/10">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold mb-3 border border-white/15">
            <ShieldCheck size={14} className="text-blue-300" />
            <span>Role: Pendamping Ekstrakurikuler</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Dashboard Pendamping</h1>
          <p className="text-white/80 text-xs sm:text-sm mt-2 leading-relaxed">
            Selamat datang di panel kendali pendamping. Pantau progres kelengkapan nilai, rekapitulasi data siswa per tahun ajaran & semester, serta akses formulir penilaian dengan mudah.
          </p>
        </div>

        {/* Decorative background shapes */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-36 -top-16 w-40 h-40 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Control Bar: Tahun Ajaran Dropdown & Semester Filter */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Tahun Ajaran Dropdown (Revisi Poin 1) */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
            <Calendar size={14} className="text-primary-600" />
            Tahun Ajaran:
          </label>
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(e.target.value)}
            className="input-field py-1.5 px-3 text-xs font-bold text-slate-800 bg-slate-50 w-auto min-w-[140px]"
          >
            <option value="2026/2027">2026/2027</option>
            <option value="2025/2026">2025/2026</option>
            <option value="2027/2028">2027/2028</option>
          </select>
        </div>

        {/* Semester Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
            <Clock size={14} className="text-primary-600" />
            Semester:
          </span>
          <div className="inline-flex p-0.5 bg-slate-100 rounded-xl">
            <button
              onClick={() => handleSemesterChange('1')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedSemester === '1'
                  ? 'bg-primary-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Semester 1 (Ganjil)
            </button>
            <button
              onClick={() => handleSemesterChange('2')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedSemester === '2'
                  ? 'bg-primary-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Semester 2 (Genap)
            </button>
          </div>
        </div>
      </div>

      {/* Quick Statistics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Siswa Ekskul</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800 mt-1">
              {summaryStats.loading ? '...' : summaryStats.totalStudents}
            </p>
            <span className="text-[10px] sm:text-[11px] text-primary-600 font-semibold bg-primary-50 px-2 py-0.5 rounded-md mt-1.5 inline-block">
              T.A. {selectedYear}
            </span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center shrink-0">
            <GraduationCap size={22} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Nilai Lengkap</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
              {summaryStats.loading ? '...' : summaryStats.filledCount}
            </p>
            <span className="text-[10px] sm:text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md mt-1.5 inline-block">
              Sudah Diisi
            </span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Belum Selesai</p>
            <p className="text-xl sm:text-2xl font-black text-amber-600 mt-1">
              {summaryStats.loading ? '...' : summaryStats.pendingCount}
            </p>
            <span className="text-[10px] sm:text-[11px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-md mt-1.5 inline-block">
              Perlu Dilengkapi
            </span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Ekstrakurikuler</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800 mt-1">
              {summaryStats.loading ? '...' : summaryStats.totalEkskuls}
            </p>
            <span className="text-[10px] sm:text-[11px] text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-md mt-1.5 inline-block">
              Sem. {selectedSemester}
            </span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0">
            <Layers size={22} />
          </div>
        </div>
      </div>

      {/* Main Navigation Card Buttons (Mobile Friendly) */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight mb-3">Akses Cepat Pendamping</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Card Button 1: Input Nilai */}
          <div
            onClick={() => navigate('/input-nilai')}
            className="group bg-white hover:bg-gradient-to-br hover:from-white hover:to-primary-50/50 rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-primary-300 transition-all duration-300 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary-600 group-hover:text-white transition-all duration-300 shadow-sm">
                  <PenTool size={24} />
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 bg-primary-50 text-primary-700 rounded-full border border-primary-100">
                  Penilaian
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 group-hover:text-primary-600 transition-colors">
                Input Nilai Siswa
              </h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Akses formulir input absensi 12 pertemuan, 5 nilai praktik, dan 3 nilai pengetahuan secara langsung.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-primary-600 font-bold text-xs">
              <span>Buka Form Input Nilai</span>
              <div className="w-7 h-7 rounded-full bg-primary-50 group-hover:bg-primary-600 group-hover:text-white flex items-center justify-center transition-all duration-300 group-hover:translate-x-1">
                <ArrowRight size={14} />
              </div>
            </div>
          </div>

          {/* Card Button 2: Monitoring Progres Ekskul */}
          <div
            onClick={() => {
              setActiveTab('monitoring')
              const el = document.getElementById('pendamping-content')
              if (el) el.scrollIntoView({ behavior: 'smooth' })
            }}
            className={`group bg-white hover:bg-gradient-to-br hover:from-white hover:to-blue-50/50 rounded-3xl p-5 sm:p-6 border shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between ${activeTab === 'monitoring' ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200/80 hover:border-blue-300'
              }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm">
                  <BarChart3 size={24} />
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                  Monitoring
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                Monitoring Progres Ekskul
              </h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Pantau persentase keterisian dan kelengkapan nilai di 23 cabang ekskul untuk Tahun Ajaran {selectedYear}.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-blue-600 font-bold text-xs">
              <span>{activeTab === 'monitoring' ? 'Sedang Dibuka' : 'Lihat Progres Ekskul'}</span>
              <div className="w-7 h-7 rounded-full bg-blue-50 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-all duration-300 group-hover:translate-x-1">
                <ArrowRight size={14} />
              </div>
            </div>
          </div>

          {/* Card Button 3: Tabel Siswa & Nilai */}
          <div
            onClick={() => {
              setActiveTab('students')
              const el = document.getElementById('pendamping-content')
              if (el) el.scrollIntoView({ behavior: 'smooth' })
            }}
            className={`group bg-white hover:bg-gradient-to-br hover:from-white hover:to-emerald-50/50 rounded-3xl p-5 sm:p-6 border shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between ${activeTab === 'students' ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200/80 hover:border-emerald-300'
              }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-sm">
                  <GraduationCap size={24} />
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                  Data Siswa
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">
                Daftar Nilai Siswa
              </h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Tabel nilai siswa dengan server pagination, pencarian nama, filter per ekskul, dan predikat nilai.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-emerald-600 font-bold text-xs">
              <span>{activeTab === 'students' ? 'Sedang Dibuka' : 'Lihat Tabel Siswa'}</span>
              <div className="w-7 h-7 rounded-full bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center transition-all duration-300 group-hover:translate-x-1">
                <ArrowRight size={14} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Tab Selector & Tables */}
      <div id="pendamping-content" className="space-y-4">
        {/* Tab Toggle Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('students')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'students'
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
            >
              <Users size={16} />
              <span>Daftar Nilai Siswa</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'students' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {totalCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('monitoring')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'monitoring'
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
            >
              <BarChart3 size={16} />
              <span>Monitoring Progres Ekskul</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'monitoring' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {monitoringStats.length}
              </span>
            </button>
          </div>
        </div>

        {/* TAB 1: DAFTAR NILAI SISWA (SERVER-SIDE PAGINATION) */}
        {activeTab === 'students' && (
          <div className="space-y-4">
            {/* Table Control Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Filter Ekstrakurikuler */}
                <div className="w-full sm:w-60">
                  <select
                    value={selectedEkskulFilter}
                    onChange={(e) => {
                      setSelectedEkskulFilter(e.target.value)
                      setPage(1)
                    }}
                    className="input-field py-2 text-xs font-semibold"
                  >
                    <option value="all">Semua Ekstrakurikuler</option>
                    {ekskulList.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="text"
                    placeholder="Cari nama siswa..."
                    className="input-field pl-10 py-2 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Rows Per Page (10, 20, 50) */}
              <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
                <span>Tampilkan:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                  className="input-field py-1 px-2 text-xs w-16 font-bold"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              {loadingTable ? (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-primary-600" size={32} />
                  <p className="text-xs font-medium">Memuat data nilai siswa (T.A. {selectedYear} • Sem. {selectedSemester})...</p>
                </div>
              ) : studentsScores.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="table-modern w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100 font-bold text-slate-600">
                          <th className="w-10 text-center py-2 px-1">No</th>
                          <th
                            className="cursor-pointer hover:text-primary-600 transition-colors py-2 px-2.5"
                            onClick={() => {
                              setSortConfig({
                                key: 'student.name',
                                direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
                              })
                              setPage(1)
                            }}
                          >
                            <div className="flex items-center gap-1">
                              Nama Siswa <ArrowUpDown size={11} />
                            </div>
                          </th>
                          <th className="w-12 text-center py-2 px-1">JK</th>
                          <th
                            className="w-16 cursor-pointer hover:text-primary-600 transition-colors text-center py-2 px-1"
                            onClick={() => {
                              setSortConfig({
                                key: 'student.class_name',
                                direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
                              })
                              setPage(1)
                            }}
                          >
                            <div className="flex items-center justify-center gap-1">
                              Kelas <ArrowUpDown size={11} />
                            </div>
                          </th>
                          <th className="py-2 px-2">Ekstrakurikuler</th>
                          <th className="text-center w-20 py-2 px-1">Rerata</th>
                          <th className="text-center w-16 py-2 px-1">Predikat</th>
                          <th className="text-center w-24 py-2 px-1">Status</th>
                          <th className="text-center w-20 py-2 px-1">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {studentsScores.map((item, idx) => {
                          const avg = item.average_score || 0
                          const grade = getGrade(avg)
                          const isFilled = item.att_1 || avg > 0

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="text-center text-slate-400 font-medium py-2 px-1">
                                {(page - 1) * pageSize + idx + 1}
                              </td>
                              <td className="font-bold text-slate-800 py-2 px-2.5">
                                {item.student?.name}
                              </td>
                              <td className="text-center py-2 px-1">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.student?.gender === 'P' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'}`}>
                                  {item.student?.gender}
                                </span>
                              </td>
                              <td className="text-center font-bold text-slate-700 py-2 px-1">
                                {item.student?.class_name}
                              </td>
                              <td className="py-2 px-2">
                                <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded font-bold text-[10px] border border-primary-100">
                                  {item.extracurricular?.name || '-'}
                                </span>
                              </td>
                              <td className="text-center font-black text-slate-800 py-2 px-1">
                                {avg > 0 ? Number(avg).toFixed(1) : '-'}
                              </td>
                              <td className="text-center py-2 px-1">
                                {grade !== '-' ? (
                                  <span className={`px-2 py-0.5 rounded font-black text-[10px] ${grade === 'A' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                      grade === 'B' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                        'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}>
                                    {grade}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              <td className="text-center py-2 px-1">
                                {isFilled ? (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold text-[10px] inline-flex items-center gap-1 border border-emerald-100">
                                    <CheckCircle2 size={10} /> Lengkap
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-bold text-[10px] inline-flex items-center gap-1 border border-amber-100">
                                    <Clock size={10} /> Belum
                                  </span>
                                )}
                              </td>
                              <td className="text-center py-2 px-1">
                                <button
                                  onClick={() => navigate('/input-nilai')}
                                  className="btn bg-primary-50 hover:bg-primary-600 hover:text-white text-primary-700 py-1 px-2.5 text-[10px] font-bold rounded-lg transition-all"
                                >
                                  Nilai
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                    <div>
                      Menampilkan <strong className="text-slate-800">{(page - 1) * pageSize + 1}</strong> - <strong className="text-slate-800">{Math.min(page * pageSize, totalCount)}</strong> dari <strong className="text-slate-800">{totalCount}</strong> siswa (T.A. {selectedYear} • Sem. {selectedSemester})
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Halaman Pertama"
                      >
                        <ChevronsLeft size={16} />
                      </button>
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Halaman Sebelumnya"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <span className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
                        Halaman {page} dari {totalPages}
                      </span>

                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Halaman Selanjutnya"
                      >
                        <ChevronRight size={16} />
                      </button>
                      <button
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Halaman Terakhir"
                      >
                        <ChevronsRight size={16} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center">
                    <Users size={28} />
                  </div>
                  <p className="font-bold text-slate-700">Belum ada data siswa untuk Tahun Ajaran {selectedYear} (Semester {selectedSemester})</p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Gunakan filter Tahun Ajaran di atas untuk beralih ke tahun ajaran yang memiliki data, atau hubungi Administrator untuk sinkronisasi data siswa baru.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MONITORING PROGRES EKSKUL */}
        {activeTab === 'monitoring' && (
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            {loadingMonitoring ? (
              <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-blue-600" size={32} />
                <p className="text-xs font-medium">Menganalisis progres pengisian nilai ekskul...</p>
              </div>
            ) : monitoringStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table-modern w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 font-bold text-slate-600">
                      <th>Ekstrakurikuler</th>
                      <th className="text-center w-28">Total Siswa</th>
                      <th className="text-center w-28">Terisi</th>
                      <th className="min-w-[180px]">Progres Kelengkapan</th>
                      <th className="text-center w-32">Status</th>
                      <th className="text-center w-28">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monitoringStats.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="font-bold text-slate-800">
                          {item.name}
                        </td>
                        <td className="text-center font-semibold text-slate-600">
                          {item.totalStudents}
                        </td>
                        <td className="text-center font-bold text-slate-800">
                          {item.filledScores}
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-700 ${item.progress === 100 ? 'bg-emerald-500' :
                                    item.progress > 0 ? 'bg-primary-500' : 'bg-slate-200'
                                  }`}
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-slate-500 w-9 text-right">
                              {Math.round(item.progress)}%
                            </span>
                          </div>
                        </td>
                        <td className="text-center">
                          {item.totalStudents === 0 ? (
                            <span className="text-[10px] font-bold text-slate-300 uppercase">Belum ada siswa</span>
                          ) : item.progress === 100 ? (
                            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold text-[10px] inline-flex items-center gap-1 border border-emerald-100">
                              <CheckCircle2 size={11} /> Lengkap
                            </span>
                          ) : item.progress > 0 ? (
                            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full font-bold text-[10px] inline-flex items-center gap-1 border border-blue-100">
                              <Clock size={11} /> Berjalan
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-full font-bold text-[10px] inline-flex items-center gap-1 border border-amber-100">
                              <AlertTriangle size={11} /> Belum Diisi
                            </span>
                          )}
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() => {
                              setSelectedEkskulFilter(item.id)
                              setActiveTab('students')
                              setPage(1)
                            }}
                            className="btn bg-slate-100 hover:bg-primary-600 hover:text-white text-slate-700 py-1 px-3 text-[11px] font-bold rounded-lg transition-all"
                          >
                            Lihat Siswa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-16 text-center text-slate-400">
                Belum ada data ekstrakurikuler.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
