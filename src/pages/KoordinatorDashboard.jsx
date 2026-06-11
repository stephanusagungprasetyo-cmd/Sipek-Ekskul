import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { Search, Loader2, Download, ArrowUpDown } from 'lucide-react'
import toast from 'react-hot-toast'

export default function KoordinatorDashboard() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClass, setSelectedClass] = useState('Semua Kelas')
  const [classes, setClasses] = useState([])
  const [sortConfig, setSortConfig] = useState({ key: 'class_name', direction: 'asc' })

  // Pagination states
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)

  // Fetch unique classes once on mount
  useEffect(() => {
    async function fetchClasses() {
      const { data, error } = await supabase
        .from('students')
        .select('class_name')
      if (!error && data) {
        const uniqueClasses = ['Semua Kelas', ...new Set(data.map(s => s.class_name).filter(Boolean))]
        setClasses(uniqueClasses.sort())
      }
    }
    fetchClasses()
  }, [])

  // Fetch paginated data
  useEffect(() => {
    let active = true

    async function fetchPageData() {
      setLoading(true)
      let query = supabase
        .from('students')
        .select(`
          *,
          wajib:extracurriculars!wajib_id(id, name),
          pilihan1:extracurriculars!pilihan_1_id(id, name),
          pilihan2:extracurriculars!pilihan_2_id(id, name),
          pilihan3:extracurriculars!pilihan_3_id(id, name),
          scores(*)
        `, { count: 'exact' })

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`)
      }
      if (selectedClass !== 'Semua Kelas') {
        query = query.eq('class_name', selectedClass)
      }

      // Apply sorting
      if (sortConfig.key === 'class_name') {
        query = query
          .order('class_name', { ascending: sortConfig.direction === 'asc' })
          .order('name', { ascending: true })
      } else {
        query = query.order('name', { ascending: sortConfig.direction === 'asc' })
      }

      // Calculate server-side range
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data: students, error, count } = await query

      if (!active) return

      if (error) {
        toast.error('Gagal mengambil data rekap')
      } else {
        setData(students || [])
        setTotalCount(count || 0)
      }
      setLoading(false)
    }

    // Debounce the search input slightly to prevent API spam while typing
    const delay = searchTerm ? 400 : 0
    const timeoutId = setTimeout(() => {
      fetchPageData()
    }, delay)

    return () => {
      active = false
      clearTimeout(timeoutId)
    }
  }, [page, pageSize, selectedClass, sortConfig, searchTerm])

  const getScoreForEkskul = (student, ekskulId) => {
    if (!ekskulId || !student.scores) return null
    return student.scores.find(s => s.extracurricular_id === ekskulId)
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

  const calculateAverage = (item) => {
    if (!item) return 0
    const attendanceFields = [...Array(12)].map((_, i) => item[`att_${i+1}`])
    const filledAttendance = attendanceFields.filter(v => v && v !== '')
    const presentCount = filledAttendance.filter(v => v === 'O' || v === 'I' || v === 'S').length
    const attScore = filledAttendance.length > 0 ? (presentCount / filledAttendance.length) * 100 : 0
    const practices = [item.prac_1, item.prac_2, item.prac_3, item.prac_4, item.prac_5].filter(v => v !== null && v !== '')
    const pAvg = practices.length > 0 ? practices.reduce((a, b) => a + parseFloat(b), 0) / practices.length : 0
    const knowledge = [item.know_1, item.know_2, item.know_3].filter(v => v !== null && v !== '')
    const kAvg = knowledge.length > 0 ? knowledge.reduce((a, b) => a + parseFloat(b), 0) / knowledge.length : 0
    
    let activeCategories = 0
    if (filledAttendance.length > 0) activeCategories++
    if (practices.length > 0) activeCategories++
    if (knowledge.length > 0) activeCategories++
    
    return activeCategories > 0 ? (attScore + pAvg + kAvg) / activeCategories : 0
  }

  const getGradeStr = (score) => {
    if (!score || !isScoreFilled(score)) return '-'
    const avg = calculateAverage(score)
    if (avg >= 86) return 'A'
    if (avg >= 71) return 'B'
    return 'C'
  }

  const requestSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
    setPage(1)
  }

  // Export fetches the full filtered dataset (across all pages)
  const exportToExcel = async () => {
    setLoading(true)
    let query = supabase
      .from('students')
      .select(`
        *,
        wajib:extracurriculars!wajib_id(id, name),
        pilihan1:extracurriculars!pilihan_1_id(id, name),
        pilihan2:extracurriculars!pilihan_2_id(id, name),
        pilihan3:extracurriculars!pilihan_3_id(id, name),
        scores(*)
      `)

    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`)
    }
    if (selectedClass !== 'Semua Kelas') {
      query = query.eq('class_name', selectedClass)
    }

    if (sortConfig.key === 'class_name') {
      query = query
        .order('class_name', { ascending: sortConfig.direction === 'asc' })
        .order('name', { ascending: true })
    } else {
      query = query.order('name', { ascending: sortConfig.direction === 'asc' })
    }

    const { data: students, error } = await query

    if (error) {
      toast.error('Gagal mengekspor data')
      setLoading(false)
      return
    }

    const reportData = (students || []).map((s, idx) => ({
      'No': idx + 1,
      'Nama Siswa': s.name,
      'Kelas': s.class_name,
      'Ekskul Wajib': s.wajib?.name || '-',
      'Nilai Wajib': getGradeStr(getScoreForEkskul(s, s.wajib?.id)),
      'Ekskul Pilihan 1': s.pilihan1?.name || '-',
      'Nilai Pilihan 1': getGradeStr(getScoreForEkskul(s, s.pilihan1?.id)),
      'Ekskul Pilihan 2': s.pilihan2?.name || '-',
      'Nilai Pilihan 2': getGradeStr(getScoreForEkskul(s, s.pilihan2?.id)),
      'Ekskul Pilihan 3': s.pilihan3?.name || '-',
      'Nilai Pilihan 3': getGradeStr(getScoreForEkskul(s, s.pilihan3?.id)),
    }))

    const ws = XLSX.utils.json_to_sheet(reportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Nilai")
    const fileName = `Rekap_Nilai_${selectedClass.replace(' ', '_')}_${new Date().toLocaleDateString()}.xlsx`
    XLSX.writeFile(wb, fileName)
    toast.success(`Berhasil mengekspor data ${selectedClass}`)
    setLoading(false)
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Rekapitulasi Nilai</h2>
          <p className="text-slate-500 mt-1">Laporan menyeluruh nilai wajib dan pilihan siswa.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Cari siswa..."
              className="input-field pl-12"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
            />
          </div>
          
          <select 
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 transition-all shadow-sm"
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value)
              setPage(1)
            }}
          >
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <button 
            onClick={exportToExcel}
            className="btn btn-primary flex items-center gap-2"
          >
            <Download size={18} />
            Ekspor Excel
          </button>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p>Menyusun laporan...</p>
          </div>
        ) : data.length > 0 ? (
          <table className="table-modern whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/50">
                <th rowSpan="2" className="text-center w-12">No</th>
                <th rowSpan="2" className="min-w-[200px] cursor-pointer" onClick={() => requestSort('name')}>
                  <div className="flex items-center gap-2">Nama Siswa <ArrowUpDown size={14} /></div>
                </th>
                <th rowSpan="2" className="text-center w-24 cursor-pointer" onClick={() => requestSort('class_name')}>
                  <div className="flex items-center gap-2">Kelas <ArrowUpDown size={14} /></div>
                </th>
                <th colSpan="2" className="text-center border-b border-slate-100 py-2 bg-indigo-50/30 text-indigo-700">Ekskul Wajib</th>
                <th colSpan="2" className="text-center border-b border-slate-100 py-2 bg-amber-50/30 text-amber-700">Pilihan 1</th>
                <th colSpan="2" className="text-center border-b border-slate-100 py-2 bg-teal-50/30 text-teal-700">Pilihan 2</th>
                <th colSpan="2" className="text-center border-b border-slate-100 py-2 bg-rose-50/30 text-rose-700">Pilihan 3</th>
              </tr>
              <tr className="bg-slate-50/50">
                <th className="text-xs text-slate-400">Nama</th><th className="text-xs text-slate-400 w-16">Nilai</th>
                <th className="text-xs text-slate-400">Nama</th><th className="text-xs text-slate-400 w-16">Nilai</th>
                <th className="text-xs text-slate-400">Nama</th><th className="text-xs text-slate-400 w-16">Nilai</th>
                <th className="text-xs text-slate-400">Nama</th><th className="text-xs text-slate-400 w-16">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {data.map((student, idx) => {
                const sWajib = getScoreForEkskul(student, student.wajib?.id)
                const sP1 = getScoreForEkskul(student, student.pilihan1?.id)
                const sP2 = getScoreForEkskul(student, student.pilihan2?.id)
                const sP3 = getScoreForEkskul(student, student.pilihan3?.id)

                return (
                  <tr key={student.id}>
                    <td className="text-center text-slate-400">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="font-bold text-slate-800">{student.name}</td>
                    <td className="text-center text-slate-500 font-medium">{student.class_name}</td>
                    
                    <td className="text-[11px] font-semibold text-slate-600">{student.wajib?.name || '-'}</td>
                    <td className="text-center font-black">
                      {getGradeStr(sWajib) !== '-' ? (
                        <span className={`text-${getGradeStr(sWajib) === 'A' ? 'green' : 'blue'}-600`}>{getGradeStr(sWajib)}</span>
                      ) : '-'}
                    </td>
                    
                    <td className="text-[11px] font-semibold text-slate-600">{student.pilihan1?.name || '-'}</td>
                    <td className="text-center font-black">
                      {getGradeStr(sP1) !== '-' ? (
                        <span className={`text-${getGradeStr(sP1) === 'A' ? 'green' : 'blue'}-600`}>{getGradeStr(sP1)}</span>
                      ) : '-'}
                    </td>
                    
                    <td className="text-[11px] font-semibold text-slate-600">{student.pilihan2?.name || '-'}</td>
                    <td className="text-center font-black">
                      {getGradeStr(sP2) !== '-' ? (
                        <span className={`text-${getGradeStr(sP2) === 'A' ? 'green' : 'blue'}-600`}>{getGradeStr(sP2)}</span>
                      ) : '-'}
                    </td>
                    
                    <td className="text-[11px] font-semibold text-slate-600">{student.pilihan3?.name || '-'}</td>
                    <td className="text-center font-black">
                      {getGradeStr(sP3) !== '-' ? (
                        <span className={`text-${getGradeStr(sP3) === 'A' ? 'green' : 'blue'}-600`}>{getGradeStr(sP3)}</span>
                      ) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-20 text-center text-slate-400">
            <p>Data rekapitulasi belum tersedia.</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && data.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-100 rounded-xl p-4 shadow-sm mt-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 transition-all shadow-sm cursor-pointer"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-xs text-slate-500 font-medium">siswa per halaman</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 font-medium">
              Halaman <strong className="text-slate-800 font-bold">{page}</strong> dari <strong className="text-slate-800 font-bold">{totalPages}</strong> ({totalCount} siswa)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Awal
              </button>
              <button
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Berikutnya
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Akhir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
