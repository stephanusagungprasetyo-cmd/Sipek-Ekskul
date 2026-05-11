import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import { 
  Search, 
  Loader2, 
  Filter, 
  Download, 
  TrendingUp, 
  Users, 
  Award,
  PieChart
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function KoordinatorDashboard() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [ekskulFilter, setEkskulFilter] = useState('All')
  const [classFilter, setClassFilter] = useState('All')
  const [ekskuls, setEkskuls] = useState([])
  const [classes, setClasses] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: scoresData, error } = await supabase
      .from('scores')
      .select('*, students(*), extracurriculars(*)')
    
    if (error) {
      toast.error('Gagal mengambil data')
    } else {
      setData(scoresData)
      const uniqueEkskuls = [...new Set(scoresData.map(item => item.extracurriculars?.name))].filter(Boolean)
      const uniqueClasses = [...new Set(scoresData.map(item => item.students?.class_name))].filter(Boolean).sort()
      setEkskuls(uniqueEkskuls)
      setClasses(uniqueClasses)
    }
    setLoading(false)
  }

  const filteredData = data.filter(item => {
    const matchesSearch = item.students?.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesEkskul = ekskulFilter === 'All' || item.extracurriculars?.name === ekskulFilter
    const matchesClass = classFilter === 'All' || item.students?.class_name === classFilter
    return matchesSearch && matchesEkskul && matchesClass
  })

  // Statistics
  const totalSiswa = filteredData.length
  const avgNilai = totalSiswa > 0 
    ? Math.round(filteredData.reduce((acc, item) => acc + (item.final_score || 0), 0) / totalSiswa)
    : 0
    
  const distribution = filteredData.reduce((acc, item) => {
    const isComplete = item.attendance !== null && item.practice !== null && item.knowledge !== null
    let grade = 'C'
    if (isComplete) {
      if (item.final_score >= 86) grade = 'A'
      else if (item.final_score >= 51) grade = 'B'
    }
    acc[grade] = (acc[grade] || 0) + 1
    return acc
  }, { A: 0, B: 0, C: 0 })

  const exportToExcel = () => {
    if (filteredData.length === 0) return
    
    const exportData = filteredData.map((item, idx) => {
      const isComplete = item.attendance !== null && item.practice !== null && item.knowledge !== null
      let grade = 'C'
      if (isComplete) {
        if (item.final_score >= 86) grade = 'A'
        else if (item.final_score >= 51) grade = 'B'
      }
      
      return {
        'No': idx + 1,
        'Nama Siswa': item.students?.name,
        'JK': item.students?.gender,
        'Kelas': item.students?.class_name,
        'Ekstrakurikuler': item.extracurriculars?.name,
        'Kehadiran': item.attendance,
        'Praktik': item.practice,
        'Pengetahuan': item.knowledge,
        'Nilai Akhir': isComplete ? Math.round(item.final_score) : '-',
        'Nilai Huruf': grade
      }
    })

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Nilai")
    XLSX.writeFile(wb, `Rekap_Nilai_Ekskul_${new Date().toLocaleDateString()}.xlsx`)
    toast.success('File Excel berhasil diunduh')
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Rekapitulasi Nilai</h2>
          <p className="text-slate-500 mt-1">Laporan statistik dan ekspor data nilai rapor ekstrakurikuler.</p>
        </div>
        
        <button 
          onClick={exportToExcel}
          className="btn btn-primary flex items-center gap-2 px-6 shadow-xl shadow-primary-200"
        >
          <Download size={18} />
          Export Excel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card border-l-4 border-l-blue-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Siswa</p>
              <p className="text-2xl font-bold text-slate-800">{totalSiswa}</p>
            </div>
          </div>
        </div>
        
        <div className="card border-l-4 border-l-primary-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rata-rata Nilai</p>
              <p className="text-2xl font-bold text-slate-800">{avgNilai}</p>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-l-green-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
              <Award size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nilai A & B</p>
              <p className="text-2xl font-bold text-slate-800">{distribution.A + distribution.B}</p>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-l-orange-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center">
              <PieChart size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nilai C</p>
              <p className="text-2xl font-bold text-slate-800">{distribution.C}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Cari nama..."
            className="input-field pl-10 text-sm py-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="input-field text-sm py-2"
          value={ekskulFilter}
          onChange={(e) => setEkskulFilter(e.target.value)}
        >
          <option value="All">Semua Ekskul</option>
          {ekskuls.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select 
          className="input-field text-sm py-2"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="All">Semua Kelas</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p>Memuat data rekap...</p>
          </div>
        ) : filteredData.length > 0 ? (
          <table className="table-modern">
            <thead>
              <tr>
                <th className="w-16 text-center">No</th>
                <th>Nama Siswa</th>
                <th>Kelas</th>
                <th>Ekskul</th>
                <th className="text-center">Akhir</th>
                <th className="text-center">Huruf</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, idx) => {
                const isComplete = item.attendance !== null && item.practice !== null && item.knowledge !== null
                const final = isComplete ? Math.round(item.final_score) : '-'
                let grade = 'C'
                if (isComplete) {
                  if (item.final_score >= 86) grade = 'A'
                  else if (item.final_score >= 51) grade = 'B'
                }
                return (
                  <tr key={item.id}>
                    <td className="text-center text-slate-400">{idx + 1}</td>
                    <td className="font-semibold text-slate-800">{item.students?.name}</td>
                    <td>{item.students?.class_name}</td>
                    <td><span className="text-xs text-slate-500">{item.extracurriculars?.name}</span></td>
                    <td className="text-center font-bold text-slate-700">{final}</td>
                    <td className="text-center">
                      <span className={`
                        inline-flex items-center justify-center w-7 h-7 rounded-lg font-bold text-[10px]
                        ${grade === 'A' ? 'bg-green-100 text-green-700' : ''}
                        ${grade === 'B' ? 'bg-blue-100 text-blue-700' : ''}
                        ${grade === 'C' ? 'bg-red-100 text-red-700' : ''}
                      `}>
                        {grade}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-20 text-center text-slate-400">
            <p>Data tidak ditemukan.</p>
          </div>
        )}
      </div>
    </div>
  )
}
