import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Search, Loader2, Save, Filter, ChevronRight, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const ATTENDANCE_VALUES = ['', 'O', 'I', 'A', 'S']

const calculateAverage = (item) => {
  // Attendance calculation: O=100, I=100, A=0, S=100 (or similar)
  // But usually attendance is just count of O. 
  // Let's use a simpler logic: Average of Practice and Knowledge, weighted by attendance ratio.
  // Or just average of all valid practice and knowledge scores.
  
  const practices = [item.prac_1, item.prac_2, item.prac_3, item.prac_4, item.prac_5].filter(v => v !== null && v !== '')
  const knowledge = [item.know_1, item.know_2, item.know_3].filter(v => v !== null && v !== '')
  
  if (practices.length === 0 && knowledge.length === 0) return 0
  
  const pAvg = practices.length > 0 ? practices.reduce((a, b) => a + parseFloat(b), 0) / practices.length : 0
  const kAvg = knowledge.length > 0 ? knowledge.reduce((a, b) => a + parseFloat(b), 0) / knowledge.length : 0
  
  if (practices.length > 0 && knowledge.length > 0) return (pAvg + kAvg) / 2
  return pAvg || kAvg
}

const getGrade = (score) => {
  if (score >= 86) return 'A'
  if (score >= 71) return 'B'
  return 'C'
}

export default function PelatihDashboard() {
  const { profile } = useAuthStore()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEkskul, setSelectedEkskul] = useState(profile?.extracurricular_id || '')
  const [ekskuls, setEkskuls] = useState([])

  useEffect(() => {
    async function fetchEkskuls() {
      const { data } = await supabase.from('extracurriculars').select('*').order('name')
      setEkskuls(data || [])
    }
    fetchEkskuls()
  }, [])

  const fetchData = useCallback(async () => {
    if (!selectedEkskul) {
      setLoading(false)
      return
    }

    setLoading(true)
    const { data: scoresData, error } = await supabase
      .from('scores')
      .select('*, students(*)')
      .eq('extracurricular_id', selectedEkskul)
    
    if (error) {
      toast.error('Gagal mengambil data nilai')
    } else {
      setData(scoresData || [])
    }
    setLoading(false)
  }, [selectedEkskul])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleUpdate = async (id, field, value) => {
    // Optimistic
    setData(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item))

    const { error } = await supabase.from('scores').update({ [field]: value }).eq('id', id)
    if (error) toast.error('Gagal menyimpan')
  }

  const cycleAttendance = (id, field, current) => {
    const nextIdx = (ATTENDANCE_VALUES.indexOf(current || '') + 1) % ATTENDANCE_VALUES.length
    handleUpdate(id, field, ATTENDANCE_VALUES[nextIdx])
  }

  const filteredData = data.filter(item => 
    item.students?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.students?.class_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Panel Pelatih</h2>
            <p className="text-slate-500 mt-1">Kelola presensi dan nilai anggota ekstrakurikuler.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Filter size={18} className="text-slate-400" />
            <select 
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 transition-all shadow-sm"
              value={selectedEkskul}
              onChange={(e) => setSelectedEkskul(e.target.value)}
            >
              <option value="">Pilih Ekstrakurikuler</option>
              {ekskuls.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Cari nama siswa..."
            className="input-field pl-12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container overflow-x-auto">
        {loading ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p>Memuat data...</p>
          </div>
        ) : filteredData.length > 0 ? (
          <table className="table-modern whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/50">
                <th rowSpan="2" className="text-center">Siswa</th>
                <th colSpan="12" className="text-center border-b border-slate-100 py-2">Kehadiran (1-12)</th>
                <th colSpan="5" className="text-center border-b border-slate-100 py-2">Praktik (1-5)</th>
                <th colSpan="3" className="text-center border-b border-slate-100 py-2">Pengetahuan (1-3)</th>
                <th rowSpan="2" className="text-center">Nilai</th>
              </tr>
              <tr className="bg-slate-50/50">
                {[...Array(12)].map((_, i) => <th key={i} className="w-8 text-center px-1 text-[10px]">{i+1}</th>)}
                {[...Array(5)].map((_, i) => <th key={i} className="w-12 text-center px-1 text-[10px]">{i+1}</th>)}
                {[...Array(3)].map((_, i) => <th key={i} className="w-12 text-center px-1 text-[10px]">{i+1}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => {
                const avg = calculateAverage(item)
                const grade = getGrade(avg)
                
                return (
                  <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                      <p className="font-bold text-slate-800">{item.students?.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-tighter font-bold">{item.students?.class_name}</p>
                    </td>
                    
                    {/* Attendance */}
                    {[...Array(12)].map((_, i) => {
                      const field = `att_${i+1}`
                      const val = item[field]
                      return (
                        <td key={i} className="p-1">
                          <button
                            onClick={() => cycleAttendance(item.id, field, val)}
                            className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold transition-all
                              ${!val ? 'bg-slate-100 text-slate-300' : ''}
                              ${val === 'O' ? 'bg-green-500 text-white shadow-sm shadow-green-200' : ''}
                              ${val === 'I' ? 'bg-blue-500 text-white shadow-sm shadow-blue-200' : ''}
                              ${val === 'S' ? 'bg-amber-500 text-white shadow-sm shadow-amber-200' : ''}
                              ${val === 'A' ? 'bg-red-500 text-white shadow-sm shadow-red-200' : ''}
                            `}
                          >
                            {val || '-'}
                          </button>
                        </td>
                      )
                    })}

                    {/* Practice */}
                    {[...Array(5)].map((_, i) => {
                      const field = `prac_${i+1}`
                      return (
                        <td key={i} className="p-1">
                          <input
                            type="number"
                            className="w-10 h-7 bg-slate-50 border-0 rounded-md text-center text-[10px] font-bold outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                            value={item[field] || ''}
                            onChange={(e) => handleUpdate(item.id, field, e.target.value)}
                          />
                        </td>
                      )
                    })}

                    {/* Knowledge */}
                    {[...Array(3)].map((_, i) => {
                      const field = `know_${i+1}`
                      return (
                        <td key={i} className="p-1">
                          <input
                            type="number"
                            className="w-10 h-7 bg-slate-50 border-0 rounded-md text-center text-[10px] font-bold outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                            value={item[field] || ''}
                            onChange={(e) => handleUpdate(item.id, field, e.target.value)}
                          />
                        </td>
                      )
                    })}

                    <td className="text-center p-2">
                      <div className={`
                        inline-flex flex-col items-center justify-center min-w-[40px] p-1 rounded-xl
                        ${grade === 'A' ? 'bg-green-50 text-green-700' : grade === 'B' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}
                      `}>
                        <span className="text-xs font-black">{grade}</span>
                        <span className="text-[8px] font-bold opacity-50">{Math.round(avg)}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-20 text-center text-slate-400">
            <p>Pilih ekstrakurikuler atau cari siswa untuk memulai penilaian.</p>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-wrap gap-6 items-center shadow-sm">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">Legenda Presensi:</p>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-green-500 rounded-md text-white text-[10px] flex items-center justify-center font-bold">O</div>
          <span className="text-xs text-slate-600 font-medium">Hadir</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-blue-500 rounded-md text-white text-[10px] flex items-center justify-center font-bold">I</div>
          <span className="text-xs text-slate-600 font-medium">Izin</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-amber-500 rounded-md text-white text-[10px] flex items-center justify-center font-bold">S</div>
          <span className="text-xs text-slate-600 font-medium">Sakit</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-red-500 rounded-md text-white text-[10px] flex items-center justify-center font-bold">A</div>
          <span className="text-xs text-slate-600 font-medium">Alfa</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400 italic">
          <Save size={14} />
          <span>Perubahan tersimpan otomatis.</span>
        </div>
      </div>
    </div>
  )
}
