import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Loader2, Filter, Users } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PendampingDashboard() {
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
      
      // Extract unique ekskuls and classes for filters
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Monitoring Nilai Siswa</h2>
        <p className="text-slate-500 mt-1">Melihat data nilai seluruh siswa ekstrakurikuler.</p>
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
        
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <select 
            className="input-field pl-10 text-sm py-2 appearance-none"
            value={ekskulFilter}
            onChange={(e) => setEkskulFilter(e.target.value)}
          >
            <option value="All">Semua Ekskul</option>
            {ekskuls.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div className="relative">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <select 
            className="input-field pl-10 text-sm py-2 appearance-none"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="All">Semua Kelas</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        
        <div className="flex items-center justify-end px-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
          {filteredData.length} Hasil
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p>Memuat data...</p>
          </div>
        ) : filteredData.length > 0 ? (
          <table className="table-modern">
            <thead>
              <tr>
                <th className="w-16 text-center">No</th>
                <th>Nama Siswa</th>
                <th>Kelas</th>
                <th>Ekskul</th>
                <th className="text-center">Kehadiran</th>
                <th className="text-center">Praktik</th>
                <th className="text-center">Pengetahuan</th>
                <th className="text-center">Nilai Akhir</th>
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
                    <td>
                      <span className="text-xs font-medium text-slate-500">{item.extracurriculars?.name}</span>
                    </td>
                    <td className="text-center">{item.attendance ?? '-'}</td>
                    <td className="text-center">{item.practice ?? '-'}</td>
                    <td className="text-center">{item.knowledge ?? '-'}</td>
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
            <p>Tidak ada data siswa ditemukan.</p>
          </div>
        )}
      </div>
    </div>
  )
}
