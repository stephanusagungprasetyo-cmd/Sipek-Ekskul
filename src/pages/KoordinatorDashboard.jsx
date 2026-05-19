import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { Search, Loader2, Download, Printer, Filter, Star, ArrowUpDown } from 'lucide-react'
import toast from 'react-hot-toast'

export default function KoordinatorDashboard() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClass, setSelectedClass] = useState('Semua Kelas')
  const [classes, setClasses] = useState([])
  const [sortConfig, setSortConfig] = useState({ key: 'class_name', direction: 'asc' })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: students, error } = await supabase
      .from('students')
      .select(`
        *,
        wajib:extracurriculars!wajib_id(id, name),
        pilihan1:extracurriculars!pilihan_1_id(id, name),
        pilihan2:extracurriculars!pilihan_2_id(id, name),
        pilihan3:extracurriculars!pilihan_3_id(id, name),
        scores(*)
      `)

    if (error) {
      toast.error('Gagal mengambil data rekap')
    } else {
      setData(students || [])
      const uniqueClasses = ['Semua Kelas', ...new Set((students || []).map(s => s.class_name))]
      setClasses(uniqueClasses.sort())
    }
    setLoading(false)
  }

  const getScoreForEkskul = (student, ekskulId) => {
    if (!ekskulId || !student.scores) return null
    return student.scores.find(s => s.extracurricular_id === ekskulId)
  }

  const getGradeStr = (score) => {
    if (!score) return '-'
    const avg = score.average_score || 0
    if (avg >= 86) return 'A'
    if (avg >= 71) return 'B'
    return 'C'
  }

  const requestSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const filteredData = data.filter(student => {
    const matchSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchClass = selectedClass === 'Semua Kelas' || student.class_name === selectedClass
    return matchSearch && matchClass
  }).sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1
    
    // Secondary sort by name
    if (sortConfig.key === 'class_name') {
      return a.name.localeCompare(b.name)
    }
    return 0
  })

  const exportToExcel = () => {
    const reportData = filteredData
      .sort((a, b) => {
        // Always sort by class then name for export
        const classComp = a.class_name.localeCompare(b.class_name)
        if (classComp !== 0) return classComp
        return a.name.localeCompare(b.name)
      })
      .map((s, idx) => ({
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
  }

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
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 transition-all shadow-sm"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
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
        ) : filteredData.length > 0 ? (
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
              {filteredData.map((student, idx) => {
                const sWajib = getScoreForEkskul(student, student.wajib?.id)
                const sP1 = getScoreForEkskul(student, student.pilihan1?.id)
                const sP2 = getScoreForEkskul(student, student.pilihan2?.id)
                const sP3 = getScoreForEkskul(student, student.pilihan3?.id)

                return (
                  <tr key={student.id}>
                    <td className="text-center text-slate-400">{idx + 1}</td>
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
    </div>
  )
}
