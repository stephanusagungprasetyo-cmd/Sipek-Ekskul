import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { 
  Search, 
  Loader2, 
  Calendar, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  X, 
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  Info,
  Lock,
  Unlock,
  AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

const ATTENDANCE_VALUES = ['', 'O', 'I', 'A', 'S']

const calculateAverage = (item) => {
  if (!item) return 0
  const attendanceFields = [...Array(12)].map((_, i) => item[`att_${i + 1}`])
  const filledAttendance = attendanceFields.filter(v => v && v !== '')
  // HANYA 'O' (Hadir) yang dihitung hadir fisik (1 poin). 'I', 'S', 'A' bernilai 0 poin kehadiran
  const presentCount = filledAttendance.filter(v => v?.toUpperCase() === 'O').length
  const attScore = filledAttendance.length > 0 ? (presentCount / filledAttendance.length) * 100 : 0

  const practices = [item.prac_1, item.prac_2, item.prac_3, item.prac_4, item.prac_5]
    .filter(v => v !== null && v !== undefined && v !== '' && !isNaN(v))
  const pAvg = practices.length > 0 ? practices.reduce((a, b) => a + Math.min(100, Math.max(0, parseFloat(b))), 0) / practices.length : 0

  const knowledge = [item.know_1, item.know_2, item.know_3]
    .filter(v => v !== null && v !== undefined && v !== '' && !isNaN(v))
  const kAvg = knowledge.length > 0 ? knowledge.reduce((a, b) => a + Math.min(100, Math.max(0, parseFloat(b))), 0) / knowledge.length : 0

  let activeCategories = 0
  if (filledAttendance.length > 0) activeCategories++
  if (practices.length > 0) activeCategories++
  if (knowledge.length > 0) activeCategories++

  return activeCategories > 0 ? (attScore + pAvg + kAvg) / activeCategories : 0
}

const getGrade = (score) => {
  if (!score || score <= 0) return '-'
  if (score >= 86) return 'A'
  if (score >= 71) return 'B'
  return 'C'
}

export default function PelatihDashboard() {
  const { profile } = useAuthStore()

  // Filter Utama: Tahun Ajaran & Semester
  const [selectedYear, setSelectedYear] = useState('2026/2027')
  const [selectedSemester, setSelectedSemester] = useState('1') // '1' atau '2'
  const [isSemester1Locked, setIsSemester1Locked] = useState(false)

  // Ekstrakurikuler & View Mode
  const [selectedEkskul, setSelectedEkskul] = useState(profile?.extracurricular_id || '')
  const [ekskuls, setEkskuls] = useState([])
  const [viewMode, setViewMode] = useState('attendance') // 'attendance' | 'practice' | 'knowledge'

  // Server-Side Pagination States (Pilihan: 10, 20, 50 - Default: 20)
  const [data, setData] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)

  // Search & Sorting States
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'class_name', direction: 'asc' })

  // Saving indicator
  const [savingId, setSavingId] = useState(null)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch lock status dari system_settings
  const fetchLockStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'semester_lock')
        .maybeSingle()
      if (!error && data?.value) {
        setIsSemester1Locked(Boolean(data.value.semester_1_locked))
      }
    } catch (e) {
      // Graceful fallback jika tabel belum ada
    }
  }, [])

  useEffect(() => {
    fetchLockStatus()
  }, [fetchLockStatus])

  // Fetch list of extracurriculars on mount
  const fetchEkskuls = useCallback(async () => {
    const { data, error } = await supabase.from('extracurriculars').select('*').order('name')
    if (!error && data) {
      setEkskuls(data)
      setSelectedEkskul(prev => prev || (data.length > 0 ? data[0].id : ''))
    }
  }, [])

  useEffect(() => {
    fetchEkskuls()
  }, [fetchEkskuls])

  // Fetch paginated scores data based on selectedEkskul, selectedYear, selectedSemester, and pagination
  const fetchData = useCallback(async () => {
    if (!selectedEkskul) {
      setData([])
      setTotalCount(0)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      // Coba query dengan filter semester
      let query = supabase
        .from('scores')
        .select(`
          id,
          student_id,
          extracurricular_id,
          semester,
          is_locked,
          att_1, att_2, att_3, att_4, att_5, att_6,
          att_7, att_8, att_9, att_10, att_11, att_12,
          prac_1, prac_2, prac_3, prac_4, prac_5,
          know_1, know_2, know_3,
          average_score,
          updated_at,
          students!inner (
            id,
            name,
            gender,
            class_name,
            academic_year,
            wajib_id,
            pilihan_1_id,
            pilihan_2_id,
            pilihan_3_id,
            sem2_pilihan_1_id,
            sem2_pilihan_2_id,
            sem2_pilihan_3_id
          )
        `, { count: 'exact' })
        .eq('extracurricular_id', selectedEkskul)
        .eq('semester', Number(selectedSemester))

      // Proteksi Ganda: Siswa harus terdaftar di ekskul ini (dukungan ganti ekskul semester 2)
      if (selectedSemester === '2') {
        query = query.or(`wajib_id.eq.${selectedEkskul},sem2_pilihan_1_id.eq.${selectedEkskul},sem2_pilihan_2_id.eq.${selectedEkskul},sem2_pilihan_3_id.eq.${selectedEkskul},pilihan_1_id.eq.${selectedEkskul},pilihan_2_id.eq.${selectedEkskul},pilihan_3_id.eq.${selectedEkskul}`, { foreignTable: 'students' })
      } else {
        query = query.or(`wajib_id.eq.${selectedEkskul},pilihan_1_id.eq.${selectedEkskul},pilihan_2_id.eq.${selectedEkskul},pilihan_3_id.eq.${selectedEkskul}`, { foreignTable: 'students' })
      }

      // Filter Tahun Ajaran pada tabel students
      if (selectedYear === '2025/2026') {
        query = query.or('academic_year.eq.2025/2026,academic_year.is.null', { foreignTable: 'students' })
      } else {
        query = query.eq('students.academic_year', selectedYear)
      }

      // Filter Pencarian (Nama atau Kelas)
      if (debouncedSearch.trim()) {
        query = query.or(`name.ilike.%${debouncedSearch.trim()}%,class_name.ilike.%${debouncedSearch.trim()}%`, { foreignTable: 'students' })
      }

      // Sorting
      if (sortConfig.key === 'name') {
        query = query.order('name', { foreignTable: 'students', ascending: sortConfig.direction === 'asc' })
      } else {
        query = query
          .order('class_name', { foreignTable: 'students', ascending: sortConfig.direction === 'asc' })
          .order('name', { foreignTable: 'students', ascending: true })
      }

      // Server-side Range
      query = query.range(from, to)

      let { data: scoresData, count, error } = await query

      // Fallback jika kolom semester belum dijalankan di database
      if (error && error.message && error.message.includes('semester')) {
        let fallbackQuery = supabase
          .from('scores')
          .select(`
            id,
            student_id,
            extracurricular_id,
            att_1, att_2, att_3, att_4, att_5, att_6,
            att_7, att_8, att_9, att_10, att_11, att_12,
            prac_1, prac_2, prac_3, prac_4, prac_5,
            know_1, know_2, know_3,
            average_score,
            updated_at,
            students!inner (
              id,
              name,
              gender,
              class_name,
              academic_year
            )
          `, { count: 'exact' })
          .eq('extracurricular_id', selectedEkskul)

        if (selectedYear === '2025/2026') {
          fallbackQuery = fallbackQuery.or('academic_year.eq.2025/2026,academic_year.is.null', { foreignTable: 'students' })
        } else {
          fallbackQuery = fallbackQuery.eq('students.academic_year', selectedYear)
        }

        if (debouncedSearch.trim()) {
          fallbackQuery = fallbackQuery.or(`name.ilike.%${debouncedSearch.trim()}%,class_name.ilike.%${debouncedSearch.trim()}%`, { foreignTable: 'students' })
        }

        fallbackQuery = fallbackQuery.range(from, to)
        const res = await fallbackQuery
        scoresData = res.data
        count = res.count
        error = res.error
      }

      if (error) throw error

      setData(scoresData || [])
      setTotalCount(count || 0)
    } catch (err) {
      console.error('Error fetching scores:', err)
      toast.error('Gagal mengambil data nilai: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedEkskul, selectedYear, selectedSemester, page, pageSize, debouncedSearch, sortConfig])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Supabase Realtime Listener untuk perubahan data siswa dari Admin & system_settings
  useEffect(() => {
    const channel = supabase
      .channel('pelatih-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => {
          fetchData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'extracurriculars' },
        () => {
          fetchEkskuls()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_settings' },
        () => {
          fetchLockStatus()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData, fetchEkskuls, fetchLockStatus])

  // Status apakah penilaian saat ini terkunci
  const isLocked = selectedSemester === '1' && isSemester1Locked

  // Handle local state updates with input clamping (0 - 100)
  const handleLocalChange = (id, field, value) => {
    if (isLocked) {
      toast.error('Nilai Semester 1 telah dikunci dan tidak dapat diubah.')
      return
    }

    let displayValue = value
    if (field.startsWith('prac_') || field.startsWith('know_')) {
      if (value !== '' && value !== null && value !== undefined) {
        const num = parseFloat(value)
        if (!isNaN(num)) {
          if (num > 100) displayValue = 100
          if (num < 0) displayValue = 0
        }
      }
    }
    setData(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: displayValue }
      }
      return item
    }))
  }

  // Handle saving score/attendance to database with automatic average recalculation & clamping
  const handleSaveToDb = async (id, field, value) => {
    if (isLocked) return

    const currentItem = data.find(item => item.id === id)
    if (!currentItem) return

    setSavingId(id)
    
    let cleanValue = (value === '' || value === undefined || value === null) ? null : value
    if ((field.startsWith('prac_') || field.startsWith('know_')) && cleanValue !== null) {
      const parsed = parseFloat(cleanValue)
      cleanValue = isNaN(parsed) ? null : Math.min(100, Math.max(0, parsed))
    }

    const tempItem = { ...currentItem, [field]: cleanValue }
    const avg = calculateAverage(tempItem)

    const { error } = await supabase.from('scores').update({
      [field]: cleanValue,
      average_score: avg,
      updated_at: new Date().toISOString()
    }).eq('id', id)

    setSavingId(null)
    if (error) {
      toast.error('Gagal menyimpan nilai')
    } else {
      setData(prev => prev.map(item => {
        if (item.id === id) {
          return { ...item, [field]: cleanValue, average_score: avg }
        }
        return item
      }))
    }
  }

  // Cycle Attendance: '' -> 'O' (Hadir) -> 'I' (Izin) -> 'A' (Alpa) -> 'S' (Sakit) -> ''
  const cycleAttendance = (id, field, current) => {
    if (isLocked) {
      toast.error('Nilai Semester 1 telah dikunci dan tidak dapat diubah.')
      return
    }
    const nextIdx = (ATTENDANCE_VALUES.indexOf(current || '') + 1) % ATTENDANCE_VALUES.length
    const nextVal = ATTENDANCE_VALUES[nextIdx]
    handleLocalChange(id, field, nextVal)
    handleSaveToDb(id, field, nextVal)
  }

  const handleYearChange = (year) => {
    setSelectedYear(year)
    setPage(1)
  }

  const handleSemesterChange = (semester) => {
    setSelectedSemester(semester)
    setPage(1)
  }

  const handleEkskulChange = (ekskulId) => {
    setSelectedEkskul(ekskulId)
    setPage(1)
  }

  const requestSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
    setPage(1)
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="space-y-4">
      {/* Header & Main Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
            {profile?.role === 'pendamping' ? 'Input Nilai (Pendamping)' : 'Panel Pelatih'}
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Kelola presensi dan penilaian siswa per semester. Master data siswa dikelola terpusat oleh Admin.
          </p>
        </div>

        {/* Filter Dropdowns: Tahun Ajaran, Semester, & Ekstrakurikuler */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Dropdown Tahun Ajaran */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 shadow-sm">
            <Calendar size={14} className="text-primary-600 shrink-0" />
            <span className="text-xs font-bold text-slate-600">T.A:</span>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
            >
              <option value="2026/2027">2026/2027</option>
              <option value="2025/2026">2025/2026</option>
              <option value="2027/2028">2027/2028</option>
            </select>
          </div>

          {/* Toggle Semester */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => handleSemesterChange('1')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedSemester === '1'
                  ? 'bg-primary-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Sem. 1</span>
              {isSemester1Locked && <Lock size={12} className={selectedSemester === '1' ? 'text-white' : 'text-amber-600'} />}
            </button>
            <button
              onClick={() => handleSemesterChange('2')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedSemester === '2'
                  ? 'bg-primary-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sem. 2
            </button>
          </div>

          {/* Dropdown Ekstrakurikuler */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 shadow-sm">
            <Layers size={14} className="text-primary-600 shrink-0" />
            <select
              value={selectedEkskul}
              onChange={(e) => handleEkskulChange(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer max-w-[170px] sm:max-w-[210px] truncate"
            >
              <option value="">-- Pilih Ekstrakurikuler --</option>
              {ekskuls.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          {/* View Mode Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setViewMode('attendance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'attendance'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Presensi (12)
            </button>
            <button
              onClick={() => setViewMode('practice')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'practice'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Praktik (5)
            </button>
            <button
              onClick={() => setViewMode('knowledge')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'knowledge'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pengetahuan (3)
            </button>
          </div>
        </div>
      </div>

      {/* Lock Notice Banner if Semester 1 is Locked */}
      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-amber-900 text-xs font-semibold flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Lock size={16} />
            </div>
            <div>
              <p className="font-bold text-amber-950">Nilai Semester 1 (Ganjil) Telah Dikunci</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Nilai dan presensi Semester 1 telah dikunci oleh Koordinator/Admin untuk keperluan pencetakan rapor. Mode Hanya Lihat (Read-Only).
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-amber-200/80 text-amber-950 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0">
            Terkunci
          </span>
        </div>
      )}

      {/* Control Bar: Search & Page Size (Server-side Pagination Options: 10, 20, 50) */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Cari siswa atau kelas..."
            className="input-field pl-10 py-1.5 text-xs w-full"
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

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
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
            <span>siswa/hlm</span>
          </div>

          <div className="hidden sm:block text-[11px] font-semibold text-slate-400">
            Total: <strong className="text-slate-700">{totalCount}</strong> siswa (Sem. {selectedSemester})
          </div>
        </div>
      </div>

      {/* Compact Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-primary-600" size={32} />
            <p className="text-xs font-medium">Memuat data nilai (Sem. {selectedSemester})...</p>
          </div>
        ) : !selectedEkskul ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <Layers size={36} className="text-slate-300" />
            <p className="text-sm font-bold text-slate-600">Silakan pilih ekstrakurikuler terlebih dahulu</p>
            <p className="text-xs text-slate-400">Pilih ekskul pada menu dropdown di atas untuk mulai menginput nilai.</p>
          </div>
        ) : data.length > 0 ? (
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

                    {/* Presensi (Pertemuan 1 - 12): Compact Chips */}
                    {viewMode === 'attendance' && [...Array(12)].map((_, i) => (
                      <th key={i} className="w-8 min-w-[34px] text-center p-0.5 text-[11px] font-bold text-slate-500">
                        {i + 1}
                      </th>
                    ))}

                    {/* Praktik (P-1 - P-5): Compact Input Fields */}
                    {viewMode === 'practice' && [...Array(5)].map((_, i) => (
                      <th key={i} className="w-16 min-w-[65px] text-center p-1 text-[11px] font-bold text-slate-500">
                        P-{i + 1}
                      </th>
                    ))}

                    {/* Pengetahuan (U-1 - U-3): Compact Input Fields */}
                    {viewMode === 'knowledge' && [...Array(3)].map((_, i) => (
                      <th key={i} className="w-16 min-w-[65px] text-center p-1 text-[11px] font-bold text-slate-500">
                        U-{i + 1}
                      </th>
                    ))}

                    <th className="w-14 text-center py-2 px-1 font-bold">Rerata</th>
                    <th className="w-12 text-center py-2 px-1 font-bold">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((item, idx) => {
                    const avg = calculateAverage(item)
                    const grade = getGrade(avg)

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="text-center text-slate-400 font-medium py-1.5 px-1">
                          {(page - 1) * pageSize + idx + 1}
                        </td>
                        <td className="font-bold text-slate-800 py-1.5 px-2.5 truncate max-w-[170px]" title={item.students?.name}>
                          {item.students?.name || '-'}
                        </td>
                        <td className="text-center font-bold text-slate-600 py-1.5 px-1">
                          {item.students?.class_name || '-'}
                        </td>

                        {/* View 1: Presensi 1 - 12 */}
                        {viewMode === 'attendance' && [...Array(12)].map((_, i) => {
                          const field = `att_${i + 1}`
                          const val = item[field]
                          return (
                            <td key={i} className="p-0.5 text-center">
                              <button
                                onClick={() => cycleAttendance(item.id, field, val)}
                                disabled={isLocked}
                                title={isLocked ? 'Nilai terkunci' : `P-${i+1}: ${val || 'Kosong'} (Klik ganti)`}
                                className={`w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-black mx-auto transition-all ${
                                  isLocked ? 'cursor-not-allowed opacity-80' : ''
                                } ${
                                  !val ? 'bg-slate-100 text-slate-300 hover:bg-slate-200' : ''
                                } ${val === 'O' ? 'bg-emerald-500 text-white shadow-sm' : ''} ${
                                  val === 'I' ? 'bg-blue-500 text-white shadow-sm' : ''
                                } ${val === 'S' ? 'bg-amber-500 text-white shadow-sm' : ''} ${
                                  val === 'A' ? 'bg-rose-500 text-white shadow-sm' : ''
                                }`}
                              >
                                {val || '-'}
                              </button>
                            </td>
                          )
                        })}

                        {/* View 2: Nilai Praktik 1 - 5 */}
                        {viewMode === 'practice' && [...Array(5)].map((_, i) => (
                          <td key={i} className="p-1 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="-"
                              disabled={isLocked}
                              readOnly={isLocked}
                              className={`w-14 h-7 text-center text-xs font-bold rounded-md outline-none transition-all ${
                                isLocked 
                                  ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed' 
                                  : 'bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500'
                              }`}
                              value={item[`prac_${i+1}`] ?? ''}
                              onChange={(e) => handleLocalChange(item.id, `prac_${i+1}`, e.target.value)}
                              onBlur={(e) => handleSaveToDb(item.id, `prac_${i+1}`, e.target.value)}
                            />
                          </td>
                        ))}

                        {/* View 3: Nilai Pengetahuan 1 - 3 */}
                        {viewMode === 'knowledge' && [...Array(3)].map((_, i) => (
                          <td key={i} className="p-1 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="-"
                              disabled={isLocked}
                              readOnly={isLocked}
                              className={`w-14 h-7 text-center text-xs font-bold rounded-md outline-none transition-all ${
                                isLocked 
                                  ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed' 
                                  : 'bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500'
                              }`}
                              value={item[`know_${i+1}`] ?? ''}
                              onChange={(e) => handleLocalChange(item.id, `know_${i+1}`, e.target.value)}
                              onBlur={(e) => handleSaveToDb(item.id, `know_${i+1}`, e.target.value)}
                            />
                          </td>
                        ))}

                        {/* Rerata */}
                        <td className="text-center font-bold text-slate-700 py-1.5 px-1">
                          {avg > 0 ? Math.round(avg) : '-'}
                        </td>

                        {/* Grade */}
                        <td className="text-center py-1.5 px-1">
                          {grade !== '-' ? (
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-black text-[11px] ${
                              grade === 'A' ? 'bg-emerald-100 text-emerald-700' :
                              grade === 'B' ? 'bg-blue-100 text-blue-700' :
                              'bg-rose-100 text-rose-700'
                            }`}>
                              {grade}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
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
                Menampilkan <strong className="text-slate-800">{(page - 1) * pageSize + 1}</strong> - <strong className="text-slate-800">{Math.min(page * pageSize, totalCount)}</strong> dari <strong className="text-slate-800">{totalCount}</strong> siswa (T.A. {selectedYear} • Sem. {selectedSemester})
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
            <Info size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-600">Belum ada siswa terdaftar di ekstrakurikuler ini pada Semester {selectedSemester}</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Daftar siswa dikelola terpusat oleh Admin pada menu Management Data Siswa. Siswa akan muncul otomatis setelah dialokasikan oleh Admin.
            </p>
          </div>
        )}
      </div>

      {/* Legend & Petunjuk Pengisian */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-700">Keterangan Presensi:</span>
          <span className="inline-flex items-center gap-1 font-semibold"><span className="w-5 h-5 rounded bg-emerald-500 text-white font-black flex items-center justify-center text-[10px]">O</span> Hadir</span>
          <span className="inline-flex items-center gap-1 font-semibold"><span className="w-5 h-5 rounded bg-blue-500 text-white font-black flex items-center justify-center text-[10px]">I</span> Izin</span>
          <span className="inline-flex items-center gap-1 font-semibold"><span className="w-5 h-5 rounded bg-amber-500 text-white font-black flex items-center justify-center text-[10px]">S</span> Sakit</span>
          <span className="inline-flex items-center gap-1 font-semibold"><span className="w-5 h-5 rounded bg-rose-500 text-white font-black flex items-center justify-center text-[10px]">A</span> Alpa</span>
        </div>
        <div className="text-[11px] text-slate-500 italic">
          *Hanya kode Hadir (O) yang dihitung 100% kehadiran fisik. Nilai dan rerata tersimpan otomatis.
        </div>
      </div>
    </div>
  )
}
