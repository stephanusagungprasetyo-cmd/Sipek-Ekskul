import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { 
  Search, 
  Loader2, 
  Download, 
  ArrowUpDown, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  BarChart3, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  Layers, 
  GraduationCap, 
  ShieldCheck, 
  ArrowRight,
  X,
  TrendingUp,
  AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

const calculateAverage = (item) => {
  if (!item) return 0
  const attendanceFields = [...Array(12)].map((_, i) => item[`att_${i+1}`])
  const filledAttendance = attendanceFields.filter(v => v && v !== '')
  const presentCount = filledAttendance.filter(v => v === 'O' || v === 'I' || v === 'S').length
  const attScore = filledAttendance.length > 0 ? (presentCount / filledAttendance.length) * 100 : 0
  
  const practices = [item.prac_1, item.prac_2, item.prac_3, item.prac_4, item.prac_5]
    .filter(v => v !== null && v !== undefined && v !== '' && !isNaN(v))
  const pAvg = practices.length > 0 ? practices.reduce((a, b) => a + parseFloat(b), 0) / practices.length : 0
  
  const knowledge = [item.know_1, item.know_2, item.know_3]
    .filter(v => v !== null && v !== undefined && v !== '' && !isNaN(v))
  const kAvg = knowledge.length > 0 ? knowledge.reduce((a, b) => a + parseFloat(b), 0) / knowledge.length : 0
  
  let activeCategories = 0
  if (filledAttendance.length > 0) activeCategories++
  if (practices.length > 0) activeCategories++
  if (knowledge.length > 0) activeCategories++
  
  return activeCategories > 0 ? (attScore + pAvg + kAvg) / activeCategories : 0
}

const isScoreFilled = (score) => {
  if (!score) return false
  for (let i = 1; i <= 12; i++) {
    if (score[`att_${i}`]) return true
  }
  for (let i = 1; i <= 5; i++) {
    if (score[`prac_${i}`] !== null && score[`prac_${i}`] !== undefined && score[`prac_${i}`] !== '') return true
  }
  for (let i = 1; i <= 3; i++) {
    if (score[`know_${i}`] !== null && score[`know_${i}`] !== undefined && score[`know_${i}`] !== '') return true
  }
  return false
}

const getGradeStr = (score) => {
  if (!score || !isScoreFilled(score)) return '-'
  const avg = calculateAverage(score)
  if (avg >= 86) return 'A'
  if (avg >= 71) return 'B'
  return 'C'
}

export default function KoordinatorDashboard() {
  // Filter Utama: Tahun Ajaran Dropdown & Semester (Revisi Poin 1)
  const [selectedYear, setSelectedYear] = useState('2026/2027')
  const [selectedSemester, setSelectedSemester] = useState('1')

  // Active View Tab: 'monitoring' (Monitoring Nilai) atau 'rekap' (Rekap Nilai Siswa)
  // Sesuai Revisi Poin 4: Menu Monitoring dibuat di Dashboard saja melalui Card Buttons
  const [activeView, setActiveView] = useState('monitoring')

  // Monitoring States
  const [monitoringStats, setMonitoringStats] = useState([])
  const [loadingMonitoring, setLoadingMonitoring] = useState(true)
  const [searchEkskul, setSearchEkskul] = useState('')

  // Overview Stats
  const [summaryStats, setSummaryStats] = useState({
    totalStudents: 0,
    totalEkskuls: 0,
    completedEkskuls: 0,
    avgProgress: 0,
    loading: true
  })

  // Rekap Nilai States (Server-side Pagination: 10, 20, 50 - Revisi Tambahan)
  const [studentsData, setStudentsData] = useState([])
  const [totalStudentsCount, setTotalStudentsCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loadingRekap, setLoadingRekap] = useState(true)
  const [selectedClass, setSelectedClass] = useState('Semua Kelas')
  const [classes, setClasses] = useState(['Semua Kelas'])
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'class_name', direction: 'asc' })
  const [isExporting, setIsExporting] = useState(false)

  // Debounce search input for Rekap
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch unique classes for selected academic year
  useEffect(() => {
    async function fetchClasses() {
      try {
        let query = supabase.from('students').select('class_name')
        if (selectedYear === '2025/2026') {
          query = query.or('academic_year.eq.2025/2026,academic_year.is.null')
        } else {
          query = query.eq('academic_year', selectedYear)
        }
        const { data, error } = await query
        if (!error && data) {
          const uniqueClasses = ['Semua Kelas', ...new Set(data.map(s => s.class_name).filter(Boolean))].sort()
          setClasses(uniqueClasses)
        }
      } catch (err) {
        console.error('Error fetching classes:', err)
      }
    }
    fetchClasses()
  }, [selectedYear])

  // Fetch Monitoring Progres per Ekskul & Summary Stats
  const fetchMonitoringData = useCallback(async () => {
    setLoadingMonitoring(true)
    setSummaryStats(prev => ({ ...prev, loading: true }))
    try {
      // 1. Ambil seluruh data ekstrakurikuler
      const { data: ekskuls, error: ekskulErr } = await supabase
        .from('extracurriculars')
        .select('*')
        .order('name')
      
      if (ekskulErr) throw ekskulErr
      if (!ekskuls) return

      // 2. Fetch scores untuk Tahun Ajaran aktif
      let allScores = []
      let p = 0
      const batchSize = 1000
      let hasMore = true

      while (hasMore) {
        let query = supabase
          .from('scores')
          .select('extracurricular_id, average_score, att_1, student:students!inner(academic_year)')
          .range(p * batchSize, (p + 1) * batchSize - 1)

        if (selectedYear === '2025/2026') {
          query = query.or('academic_year.eq.2025/2026,academic_year.is.null', { foreignTable: 'students' })
        } else {
          query = query.eq('student.academic_year', selectedYear)
        }

        const { data, error } = await query
        if (error || !data || data.length < batchSize) hasMore = false
        if (data) allScores = [...allScores, ...data]
        p++
      }

      // 3. Hitung progress per ekskul
      let completedCount = 0
      let totalFilledAll = 0

      const statsPerEkskul = ekskuls.map(e => {
        const scoresThisEkskul = allScores.filter(s => s.extracurricular_id === e.id)
        const total = scoresThisEkskul.length
        const filled = scoresThisEkskul.filter(s => s.att_1 || s.average_score > 0).length
        totalFilledAll += filled
        const progress = total > 0 ? (filled / total) * 100 : 0
        if (total > 0 && progress >= 100) completedCount++

        return {
          ...e,
          totalStudents: total,
          filledScores: filled,
          pendingScores: Math.max(0, total - filled),
          progress: progress
        }
      })

      // Hitung total siswa unik untuk Tahun Ajaran terpilih
      let countQuery = supabase.from('students').select('*', { count: 'exact', head: true })
      if (selectedYear === '2025/2026') {
        countQuery = countQuery.or('academic_year.eq.2025/2026,academic_year.is.null')
      } else {
        countQuery = countQuery.eq('academic_year', selectedYear)
      }
      const { count: studentTotal } = await countQuery

      const overallProgress = allScores.length > 0 ? (totalFilledAll / allScores.length) * 100 : 0

      setMonitoringStats(statsPerEkskul)
      setSummaryStats({
        totalStudents: studentTotal || 0,
        totalEkskuls: ekskuls.length,
        completedEkskuls: completedCount,
        avgProgress: Math.round(overallProgress),
        loading: false
      })
    } catch (err) {
      console.error('Error fetching monitoring data:', err)
      toast.error('Gagal memuat monitoring progres: ' + err.message)
    } finally {
      setLoadingMonitoring(false)
      setSummaryStats(prev => ({ ...prev, loading: false }))
    }
  }, [selectedYear])

  useEffect(() => {
    fetchMonitoringData()
  }, [fetchMonitoringData])

  // Fetch Rekap Nilai Siswa (Server-side Pagination: 10, 20, 50)
  const fetchRekapData = useCallback(async () => {
    setLoadingRekap(true)
    try {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from('students')
        .select(`
          id,
          name,
          gender,
          class_name,
          academic_year,
          wajib:extracurriculars!wajib_id(id, name),
          pilihan1:extracurriculars!pilihan_1_id(id, name),
          pilihan2:extracurriculars!pilihan_2_id(id, name),
          pilihan3:extracurriculars!pilihan_3_id(id, name),
          scores(*)
        `, { count: 'exact' })

      // Filter Tahun Ajaran
      if (selectedYear === '2025/2026') {
        query = query.or('academic_year.eq.2025/2026,academic_year.is.null')
      } else {
        query = query.eq('academic_year', selectedYear)
      }

      // Filter Kelas
      if (selectedClass !== 'Semua Kelas') {
        query = query.eq('class_name', selectedClass)
      }

      // Filter Search Nama Siswa
      if (debouncedSearch.trim()) {
        query = query.ilike('name', `%${debouncedSearch.trim()}%`)
      }

      // Sorting
      if (sortConfig.key === 'class_name') {
        query = query
          .order('class_name', { ascending: sortConfig.direction === 'asc' })
          .order('name', { ascending: true })
      } else {
        query = query.order('name', { ascending: sortConfig.direction === 'asc' })
      }

      // Range Pagination
      query = query.range(from, to)

      const { data, count, error } = await query

      if (error) throw error

      setStudentsData(data || [])
      setTotalStudentsCount(count || 0)
    } catch (err) {
      console.error('Error fetching rekap data:', err)
      toast.error('Gagal mengambil data rekap: ' + err.message)
    } finally {
      setLoadingRekap(false)
    }
  }, [selectedYear, selectedClass, debouncedSearch, page, pageSize, sortConfig])

  useEffect(() => {
    if (activeView === 'rekap') {
      fetchRekapData()
    }
  }, [fetchRekapData, activeView])

  const getScoreForEkskul = (student, ekskulId) => {
    if (!ekskulId || !student.scores) return null
    return student.scores.find(s => s.extracurricular_id === ekskulId)
  }

  // Export Rekap Nilai ke Excel
  const exportToExcel = async () => {
    setIsExporting(true)
    try {
      let query = supabase
        .from('students')
        .select(`
          name,
          gender,
          class_name,
          academic_year,
          wajib:extracurriculars!wajib_id(id, name),
          pilihan1:extracurriculars!pilihan_1_id(id, name),
          pilihan2:extracurriculars!pilihan_2_id(id, name),
          pilihan3:extracurriculars!pilihan_3_id(id, name),
          scores(*)
        `)

      if (selectedYear === '2025/2026') {
        query = query.or('academic_year.eq.2025/2026,academic_year.is.null')
      } else {
        query = query.eq('academic_year', selectedYear)
      }

      if (selectedClass !== 'Semua Kelas') {
        query = query.eq('class_name', selectedClass)
      }

      if (debouncedSearch.trim()) {
        query = query.ilike('name', `%${debouncedSearch.trim()}%`)
      }

      if (sortConfig.key === 'class_name') {
        query = query
          .order('class_name', { ascending: sortConfig.direction === 'asc' })
          .order('name', { ascending: true })
      } else {
        query = query.order('name', { ascending: sortConfig.direction === 'asc' })
      }

      const { data: allStudents, error } = await query

      if (error) throw error

      const reportRows = (allStudents || []).map((s, idx) => ({
        'No': idx + 1,
        'Nama Lengkap Siswa': s.name,
        'JK': s.gender || '-',
        'Kelas': s.class_name,
        'Tahun Ajaran': s.academic_year || selectedYear,
        'Ekskul Wajib': s.wajib?.name || '-',
        'Nilai Wajib': getGradeStr(getScoreForEkskul(s, s.wajib?.id)),
        'Ekskul Pilihan 1': s.pilihan1?.name || '-',
        'Nilai Pilihan 1': getGradeStr(getScoreForEkskul(s, s.pilihan1?.id)),
        'Ekskul Pilihan 2': s.pilihan2?.name || '-',
        'Nilai Pilihan 2': getGradeStr(getScoreForEkskul(s, s.pilihan2?.id)),
        'Ekskul Pilihan 3': s.pilihan3?.name || '-',
        'Nilai Pilihan 3': getGradeStr(getScoreForEkskul(s, s.pilihan3?.id)),
      }))

      const ws = XLSX.utils.json_to_sheet(reportRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Nilai Siswa")
      
      const safeYear = selectedYear.replace('/', '-')
      const safeClass = selectedClass.replace(' ', '_')
      const fileName = `Rekap_Nilai_${safeClass}_TA_${safeYear}_Sem_${selectedSemester}.xlsx`
      
      XLSX.writeFile(wb, fileName)
      toast.success(`Berhasil mengekspor ${reportRows.length} data siswa`)
    } catch (err) {
      console.error('Error exporting rekap:', err)
      toast.error('Gagal mengekspor data: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const requestSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
    setPage(1)
  }

  const handleYearChange = (year) => {
    setSelectedYear(year)
    setPage(1)
  }

  const handleSemesterChange = (semester) => {
    setSelectedSemester(semester)
    setPage(1)
  }

  const filteredMonitoringStats = monitoringStats.filter(e => 
    e.name.toLowerCase().includes(searchEkskul.toLowerCase())
  )

  const totalPages = Math.ceil(totalStudentsCount / pageSize) || 1

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary-700 via-primary-600 to-indigo-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-primary-900/10">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold mb-3 border border-white/15">
            <ShieldCheck size={14} className="text-blue-300" />
            <span>Role: Koordinator Ekstrakurikuler</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Dashboard Koordinator</h1>
          <p className="text-white/80 text-xs sm:text-sm mt-1.5 leading-relaxed">
            Pusat kendali dan evaluasi seluruh ekstrakurikuler. Pantau kelengkapan nilai dari 23 ekskul serta cetak rekapitulasi nilai siswa secara terpadu.
          </p>
        </div>

        {/* Decorative elements */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-40 -top-20 w-44 h-44 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Filter Utama: Dropdown Tahun Ajaran & Semester Filter (Revisi Poin 1) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Dropdown Tahun Ajaran */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Calendar size={16} className="text-primary-600 shrink-0" />
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0">
              Tahun Ajaran:
            </label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
            >
              <option value="2026/2027">2026/2027 (Baru)</option>
              <option value="2025/2026">2025/2026 (Lama)</option>
              <option value="2027/2028">2027/2028</option>
            </select>
          </div>

          {/* Filter Semester */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => handleSemesterChange('1')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedSemester === '1'
                  ? 'bg-primary-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semester 1 (Ganjil)
            </button>
            <button
              onClick={() => handleSemesterChange('2')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedSemester === '2'
                  ? 'bg-primary-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semester 2 (Genap)
            </button>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Status Sistem: Aktif • T.A. {selectedYear}</span>
        </div>
      </div>

      {/* Quick Statistics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Siswa Aktif</p>
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
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Ekskul Lengkap</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
              {summaryStats.loading ? '...' : summaryStats.completedEkskuls}
              <span className="text-xs font-bold text-slate-400 ml-1">/ {summaryStats.totalEkskuls}</span>
            </p>
            <span className="text-[10px] sm:text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md mt-1.5 inline-block">
              100% Dinilai
            </span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Rata-rata Progres</p>
            <p className="text-xl sm:text-2xl font-black text-blue-600 mt-1">
              {summaryStats.loading ? '...' : `${summaryStats.avgProgress}%`}
            </p>
            <span className="text-[10px] sm:text-[11px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-md mt-1.5 inline-block">
              Seluruh Ekskul
            </span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
            <TrendingUp size={22} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Ekskul</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800 mt-1">
              {summaryStats.loading ? '...' : summaryStats.totalEkskuls}
            </p>
            <span className="text-[10px] sm:text-[11px] text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-md mt-1.5 inline-block">
              Wajib & Pilihan
            </span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0">
            <Layers size={22} />
          </div>
        </div>
      </div>

      {/* Main Navigation Card Buttons (Revisi Poin 4: Menu Monitoring & Rekap di Dashboard) */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight mb-3">
          Akses Cepat Menu Koordinator
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Card Button 1: Monitoring Nilai */}
          <div 
            onClick={() => {
              setActiveView('monitoring')
              const el = document.getElementById('koordinator-content-area')
              if (el) el.scrollIntoView({ behavior: 'smooth' })
            }}
            className={`group bg-white rounded-3xl p-5 sm:p-6 border shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between ${
              activeView === 'monitoring' 
                ? 'border-primary-500 ring-2 ring-primary-100 bg-gradient-to-br from-white via-primary-50/20 to-blue-50/30' 
                : 'border-slate-200/80 hover:border-primary-300 hover:bg-slate-50/40'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm ${
                  activeView === 'monitoring'
                    ? 'bg-primary-600 text-white scale-105'
                    : 'bg-primary-50 text-primary-600 group-hover:scale-110 group-hover:bg-primary-600 group-hover:text-white'
                }`}>
                  <BarChart3 size={24} />
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  activeView === 'monitoring'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-primary-50 text-primary-700 border-primary-100'
                }`}>
                  {activeView === 'monitoring' ? 'Tampilan Aktif' : 'Monitoring'}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-slate-800 group-hover:text-primary-600 transition-colors">
                Monitoring Nilai Ekskul
              </h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Pantau status pengisian nilai presensi, praktik, dan pengetahuan dari 23 ekstrakurikuler secara real-time.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-primary-600 font-bold text-xs">
              <span>{activeView === 'monitoring' ? 'Sedang Ditampilkan' : 'Klik untuk Buka Monitoring'}</span>
              <div className="w-7 h-7 rounded-full bg-primary-50 group-hover:bg-primary-600 group-hover:text-white flex items-center justify-center transition-all duration-300 group-hover:translate-x-1">
                <ArrowRight size={14} />
              </div>
            </div>
          </div>

          {/* Card Button 2: Rekap Nilai Siswa */}
          <div 
            onClick={() => {
              setActiveView('rekap')
              const el = document.getElementById('koordinator-content-area')
              if (el) el.scrollIntoView({ behavior: 'smooth' })
            }}
            className={`group bg-white rounded-3xl p-5 sm:p-6 border shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between ${
              activeView === 'rekap' 
                ? 'border-indigo-500 ring-2 ring-indigo-100 bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/30' 
                : 'border-slate-200/80 hover:border-indigo-300 hover:bg-slate-50/40'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm ${
                  activeView === 'rekap'
                    ? 'bg-indigo-600 text-white scale-105'
                    : 'bg-indigo-50 text-indigo-600 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white'
                }`}>
                  <FileSpreadsheet size={24} />
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  activeView === 'rekap'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                }`}>
                  {activeView === 'rekap' ? 'Tampilan Aktif' : 'Rekapitulasi'}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                Rekap Nilai Siswa
              </h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Akses laporan lengkap nilai ekskul wajib dan pilihan siswa per kelas, dilengkapi fitur filter dan ekspor Excel.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-indigo-600 font-bold text-xs">
              <span>{activeView === 'rekap' ? 'Sedang Ditampilkan' : 'Klik untuk Buka Rekap'}</span>
              <div className="w-7 h-7 rounded-full bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-all duration-300 group-hover:translate-x-1">
                <ArrowRight size={14} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area (Anchor for smooth scroll) */}
      <div id="koordinator-content-area" className="pt-2">
        {/* VIEW 1: MONITORING PROGRES EKSKUL */}
        {activeView === 'monitoring' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">Progres Penilaian Ekstrakurikuler</h3>
                <p className="text-xs text-slate-500">
                  Daftar 23 ekstrakurikuler beserta persentase kelengkapan penilaian siswa (T.A. {selectedYear} • Sem. {selectedSemester}).
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Cari ekstrakurikuler..."
                  className="input-field pl-10 py-1.5 text-xs w-full"
                  value={searchEkskul}
                  onChange={(e) => setSearchEkskul(e.target.value)}
                />
                {searchEkskul && (
                  <button 
                    onClick={() => setSearchEkskul('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {loadingMonitoring ? (
              <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3 bg-white rounded-2xl border border-slate-200/80">
                <Loader2 className="animate-spin text-primary-600" size={32} />
                <p className="text-xs font-medium">Memuat progres ekstrakurikuler...</p>
              </div>
            ) : filteredMonitoringStats.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMonitoringStats.map((item) => {
                  const percent = Math.round(item.progress)
                  const isComplete = percent >= 100 && item.totalStudents > 0
                  const isStarted = percent > 0 && !isComplete

                  return (
                    <div 
                      key={item.id}
                      className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h4 className="text-sm font-bold text-slate-800 truncate" title={item.name}>
                            {item.name}
                          </h4>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                            isComplete 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : isStarted 
                              ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {isComplete ? 'Selesai' : isStarted ? 'Sedang Berjalan' : 'Belum Diisi'}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-500 font-semibold">Progres Penilaian</span>
                            <span className="font-black text-slate-800">{percent}%</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${
                                isComplete 
                                  ? 'bg-emerald-500' 
                                  : percent > 50 
                                  ? 'bg-blue-500' 
                                  : percent > 0 
                                  ? 'bg-amber-500' 
                                  : 'bg-slate-300'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 text-center text-xs">
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold">Total Siswa</p>
                          <p className="font-bold text-slate-800 mt-0.5">{item.totalStudents}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-emerald-600 font-semibold">Dinilai</p>
                          <p className="font-bold text-emerald-700 mt-0.5">{item.filledScores}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-amber-600 font-semibold">Belum</p>
                          <p className="font-bold text-amber-700 mt-0.5">{item.pendingScores}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80">
                <p className="text-sm font-bold text-slate-600">Ekstrakurikuler tidak ditemukan</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: REKAPITULASI NILAI SISWA (SERVER-SIDE PAGINATION: 10, 20, 50) */}
        {activeView === 'rekap' && (
          <div className="space-y-4">
            {/* Control Bar: Class Filter, Search, Rows per page & Export */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Filter Kelas */}
                <select
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value)
                    setPage(1)
                  }}
                  className="input-field py-1.5 px-3 text-xs font-bold text-slate-800 bg-slate-50 w-auto min-w-[130px]"
                >
                  {classes.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {/* Search Input */}
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Cari nama siswa..."
                    className="input-field pl-9 py-1.5 text-xs w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
                {/* Rows per page (10, 20, 50 - Revisi Tambahan) */}
                <div className="flex items-center gap-1.5 text-slate-500">
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
                  <span>baris</span>
                </div>

                {/* Ekspor Excel */}
                <button
                  onClick={exportToExcel}
                  disabled={isExporting}
                  className="btn bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-xl disabled:opacity-50"
                >
                  {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>{isExporting ? 'Mengekspor...' : 'Ekspor Excel'}</span>
                </button>
              </div>
            </div>

            {/* Compact Rekap Table (Ringkas tanpa scroll horizontal berlebih) */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              {loadingRekap ? (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-primary-600" size={32} />
                  <p className="text-xs font-medium">Memuat data rekapitulasi nilai...</p>
                </div>
              ) : studentsData.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="table-modern w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100 font-bold text-slate-600">
                          <th className="w-10 text-center py-2 px-1">No</th>
                          <th 
                            className="cursor-pointer hover:text-primary-600 transition-colors py-2 px-2.5 min-w-[150px]"
                            onClick={() => requestSort('name')}
                          >
                            <div className="flex items-center gap-1">Nama Siswa <ArrowUpDown size={11} /></div>
                          </th>
                          <th 
                            className="w-16 text-center cursor-pointer hover:text-primary-600 transition-colors py-2 px-1"
                            onClick={() => requestSort('class_name')}
                          >
                            <div className="flex items-center justify-center gap-1">Kelas <ArrowUpDown size={11} /></div>
                          </th>
                          <th className="py-2 px-2 text-indigo-700 bg-indigo-50/40">Ekskul Wajib</th>
                          <th className="py-2 px-2 text-amber-700 bg-amber-50/40">Pilihan 1</th>
                          <th className="py-2 px-2 text-teal-700 bg-teal-50/40">Pilihan 2</th>
                          <th className="py-2 px-2 text-rose-700 bg-rose-50/40">Pilihan 3</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {studentsData.map((student, idx) => {
                          const sWajib = getScoreForEkskul(student, student.wajib?.id)
                          const sP1 = getScoreForEkskul(student, student.pilihan1?.id)
                          const sP2 = getScoreForEkskul(student, student.pilihan2?.id)
                          const sP3 = getScoreForEkskul(student, student.pilihan3?.id)

                          const gWajib = getGradeStr(sWajib)
                          const gP1 = getGradeStr(sP1)
                          const gP2 = getGradeStr(sP2)
                          const gP3 = getGradeStr(sP3)

                          return (
                            <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="text-center text-slate-400 font-medium py-2 px-1">
                                {(page - 1) * pageSize + idx + 1}
                              </td>
                              <td className="font-bold text-slate-800 py-2 px-2.5 truncate max-w-[170px]" title={student.name}>
                                {student.name}
                              </td>
                              <td className="text-center font-bold text-slate-600 py-2 px-1">
                                {student.class_name}
                              </td>

                              {/* Wajib */}
                              <td className="py-2 px-2">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="truncate max-w-[120px] text-slate-700 font-medium" title={student.wajib?.name}>
                                    {student.wajib?.name || '-'}
                                  </span>
                                  {gWajib !== '-' ? (
                                    <span className={`w-5 h-5 rounded flex items-center justify-center font-black text-[10px] shrink-0 ${
                                      gWajib === 'A' ? 'bg-emerald-100 text-emerald-700' :
                                      gWajib === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                                    }`}>
                                      {gWajib}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 text-[11px]">-</span>
                                  )}
                                </div>
                              </td>

                              {/* Pilihan 1 */}
                              <td className="py-2 px-2">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="truncate max-w-[120px] text-slate-700 font-medium" title={student.pilihan1?.name}>
                                    {student.pilihan1?.name || '-'}
                                  </span>
                                  {gP1 !== '-' ? (
                                    <span className={`w-5 h-5 rounded flex items-center justify-center font-black text-[10px] shrink-0 ${
                                      gP1 === 'A' ? 'bg-emerald-100 text-emerald-700' :
                                      gP1 === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                                    }`}>
                                      {gP1}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 text-[11px]">-</span>
                                  )}
                                </div>
                              </td>

                              {/* Pilihan 2 */}
                              <td className="py-2 px-2">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="truncate max-w-[120px] text-slate-700 font-medium" title={student.pilihan2?.name}>
                                    {student.pilihan2?.name || '-'}
                                  </span>
                                  {gP2 !== '-' ? (
                                    <span className={`w-5 h-5 rounded flex items-center justify-center font-black text-[10px] shrink-0 ${
                                      gP2 === 'A' ? 'bg-emerald-100 text-emerald-700' :
                                      gP2 === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                                    }`}>
                                      {gP2}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 text-[11px]">-</span>
                                  )}
                                </div>
                              </td>

                              {/* Pilihan 3 */}
                              <td className="py-2 px-2">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="truncate max-w-[120px] text-slate-700 font-medium" title={student.pilihan3?.name}>
                                    {student.pilihan3?.name || '-'}
                                  </span>
                                  {gP3 !== '-' ? (
                                    <span className={`w-5 h-5 rounded flex items-center justify-center font-black text-[10px] shrink-0 ${
                                      gP3 === 'A' ? 'bg-emerald-100 text-emerald-700' :
                                      gP3 === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                                    }`}>
                                      {gP3}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 text-[11px]">-</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Server-side Pagination Controls */}
                  <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                    <div>
                      Menampilkan <strong className="text-slate-800">{(page - 1) * pageSize + 1}</strong> - <strong className="text-slate-800">{Math.min(page * pageSize, totalStudentsCount)}</strong> dari <strong className="text-slate-800">{totalStudentsCount}</strong> siswa ({selectedClass} • T.A. {selectedYear})
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Halaman Pertama"
                      >
                        <ChevronsLeft size={15} />
                      </button>
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Halaman Sebelumnya"
                      >
                        <ChevronLeft size={15} />
                      </button>

                      <div className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
                        {page} / {totalPages}
                      </div>

                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Halaman Berikutnya"
                      >
                        <ChevronRight size={15} />
                      </button>
                      <button
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Halaman Terakhir"
                      >
                        <ChevronsRight size={15} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-16 text-center text-slate-400">
                  <p className="text-sm font-bold text-slate-600">Data rekapitulasi belum tersedia</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Pastikan siswa telah terdaftar pada Tahun Ajaran {selectedYear} di menu Management Data Siswa.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
