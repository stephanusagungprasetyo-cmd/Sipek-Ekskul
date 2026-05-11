import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Search, Loader2, Save, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

const calculateGrade = (scores) => {
  const { attendance, practice, knowledge } = scores
  if (attendance === null || practice === null || knowledge === null || 
      attendance === '' || practice === '' || knowledge === '') return 'C'
  
  const avg = (parseFloat(attendance) + parseFloat(practice) + parseFloat(knowledge)) / 3
  if (avg >= 86) return 'A'
  if (avg >= 51) return 'B'
  return 'C'
}

const formatScore = (val) => {
  if (val === null || val === '') return ''
  return Math.round(parseFloat(val))
}

export default function PelatihDashboard() {
  const { profile } = useAuthStore()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchData = useCallback(async () => {
    if (!profile?.extracurricular_id) {
      setLoading(false)
      return
    }

    setLoading(true)
    const { data: scoresData, error } = await supabase
      .from('scores')
      .select('*, students(*)')
      .eq('extracurricular_id', profile.extracurricular_id)
    
    if (error) {
      toast.error('Gagal mengambil data nilai')
    } else {
      setData(scoresData)
    }
    setLoading(false)
  }, [profile])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleScoreChange = async (scoreId, field, value) => {
    // Optimistic update
    const numericValue = value === '' ? null : parseFloat(value)
    
    setData(prev => prev.map(item => 
      item.id === scoreId ? { ...item, [field]: numericValue } : item
    ))

    // Realtime save
    const { error } = await supabase
      .from('scores')
      .update({ [field]: numericValue })
      .eq('id', scoreId)
    
    if (error) {
      toast.error('Gagal menyimpan nilai')
    }
  }

  const filteredData = data.filter(item => 
    item.students?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.students?.class_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-primary-100 text-primary-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {profile?.extracurriculars?.name || 'Umum'}
            </span>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Input Nilai Ekskul</h2>
          <p className="text-slate-500 mt-1">Masukkan nilai kehadiran, praktik, dan pengetahuan siswa.</p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Cari nama atau kelas..."
            className="input-field pl-12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p>Memuat data nilai...</p>
          </div>
        ) : filteredData.length > 0 ? (
          <table className="table-modern">
            <thead>
              <tr>
                <th className="w-16 text-center">No</th>
                <th className="min-w-[200px]">Nama Siswa</th>
                <th className="w-24 text-center">Kelas</th>
                <th className="w-32 text-center">Kehadiran</th>
                <th className="w-32 text-center">Praktik</th>
                <th className="w-32 text-center">Pengetahuan</th>
                <th className="w-28 text-center">Rata-rata</th>
                <th className="w-20 text-center">Huruf</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, idx) => {
                const final = item.attendance !== null && item.practice !== null && item.knowledge !== null
                  ? Math.round((item.attendance + item.practice + item.knowledge) / 3)
                  : '-'
                const grade = calculateGrade(item)
                
                return (
                  <tr key={item.id}>
                    <td className="text-center text-slate-400">{idx + 1}</td>
                    <td className="font-semibold text-slate-800">{item.students?.name}</td>
                    <td className="text-center">{item.students?.class_name}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-full text-center py-2 bg-slate-50 border-0 rounded-lg focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none"
                        value={item.attendance === null ? '' : item.attendance}
                        onChange={(e) => handleScoreChange(item.id, 'attendance', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-full text-center py-2 bg-slate-50 border-0 rounded-lg focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none"
                        value={item.practice === null ? '' : item.practice}
                        onChange={(e) => handleScoreChange(item.id, 'practice', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-full text-center py-2 bg-slate-50 border-0 rounded-lg focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none"
                        value={item.knowledge === null ? '' : item.knowledge}
                        onChange={(e) => handleScoreChange(item.id, 'knowledge', e.target.value)}
                      />
                    </td>
                    <td className="text-center font-bold text-slate-700">
                      {final}
                    </td>
                    <td className="text-center">
                      <span className={`
                        inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-xs
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
      
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span>Perubahan disimpan secara otomatis ke database.</span>
      </div>
    </div>
  )
}
