import { useState, useEffect } from 'react' // Updated dashboard logic
import { supabase } from '../lib/supabase'
import { LayoutDashboard, Users, Clock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PendampingDashboard() {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [ekskulList, setEkskulList] = useState([])
  const [selectedEkskulId, setSelectedEkskulId] = useState('all')
  const [studentDetails, setStudentDetails] = useState([])

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (selectedEkskulId !== 'all') {
      fetchStudentDetails(selectedEkskulId)
    }
  }, [selectedEkskulId])

  async function fetchInitialData() {
    setLoading(true)
    const { data: ekskuls, error: eError } = await supabase.from('extracurriculars').select('*').order('name')
    if (eError) {
      toast.error('Gagal memuat daftar ekskul')
      setLoading(false)
      return
    }
    setEkskulList(ekskuls)
    await fetchOverviewStats(ekskuls)
  }

  async function fetchOverviewStats(ekskuls) {
    // Batched fetching to bypass 1000 row limit
    let allScores = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('scores')
        .select('extracurricular_id, average_score, att_1')
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (error || !data || data.length < pageSize) hasMore = false
      if (data) allScores = [...allScores, ...data]
      page++
    }

    const calculatedStats = ekskuls.map(ekskul => {
      const ekskulScores = allScores.filter(s => s.extracurricular_id === ekskul.id)
      const totalStudents = ekskulScores.length
      const filledScores = ekskulScores.filter(s => s.att_1 || s.average_score > 0).length
      
      return {
        ...ekskul,
        totalStudents,
        filledScores,
        progress: totalStudents > 0 ? (filledScores / totalStudents) * 100 : 0
      }
    })

    setStats(calculatedStats)
    setLoading(false)
  }

  async function fetchStudentDetails(ekskulId) {
    setLoading(true)
    const { data, error } = await supabase
      .from('scores')
      .select(`
        *,
        student:students(id, name, class_name)
      `)
      .eq('extracurricular_id', ekskulId)
      .order('updated_at', { ascending: false })

    if (error) {
      toast.error('Gagal memuat detail siswa')
    } else {
      setStudentDetails(data || [])
    }
    setLoading(false)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Monitoring Pengisian Nilai</h2>
          <p className="text-slate-500 mt-1">Pantau progres pengisian nilai oleh setiap pelatih ekskul.</p>
        </div>

        <div className="w-full md:w-72">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Filter Ekstrakurikuler</label>
          <select 
            className="input-field bg-white shadow-sm"
            value={selectedEkskulId}
            onChange={(e) => setSelectedEkskulId(e.target.value)}
          >
            <option value="all">Semua Ekskul (Ringkasan)</option>
            {ekskulList.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-white border-slate-100 flex items-center gap-5">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
            <Users size={28} />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total Ekskul</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.length}</h3>
          </div>
        </div>
        
        <div className="card bg-white border-slate-100 flex items-center gap-5">
          <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center shadow-sm">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Selesai</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.filter(s => s.progress === 100 && s.totalStudents > 0).length}</h3>
          </div>
        </div>

        <div className="card bg-white border-slate-100 flex items-center gap-5">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-sm">
            <Clock size={28} />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Berjalan</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.filter(s => s.progress > 0 && s.progress < 100).length}</h3>
          </div>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p>Menganalisis data...</p>
          </div>
        ) : selectedEkskulId === 'all' ? (
          <table className="table-modern">
            <thead>
              <tr className="bg-slate-50/50">
                <th>Ekstrakurikuler</th>
                <th className="text-center w-32">Total Siswa</th>
                <th className="text-center w-32">Terisi</th>
                <th className="min-w-[200px]">Progres</th>
                <th className="text-center w-32">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((ekskul) => (
                <tr key={ekskul.id} className="cursor-pointer hover:bg-slate-50/50" onClick={() => setSelectedEkskulId(ekskul.id)}>
                  <td className="font-bold text-slate-700">{ekskul.name}</td>
                  <td className="text-center font-semibold text-slate-500">{ekskul.totalStudents}</td>
                  <td className="text-center font-semibold text-slate-500">{ekskul.filledScores}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${ekskul.progress === 100 ? 'bg-green-500' : 'bg-primary-500'}`}
                          style={{ width: `${ekskul.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-slate-400 w-8">{Math.round(ekskul.progress)}%</span>
                    </div>
                  </td>
                  <td className="text-center">
                    {ekskul.totalStudents === 0 ? (
                      <span className="text-[10px] font-bold text-slate-300 uppercase">Belum ada siswa</span>
                    ) : ekskul.progress === 100 ? (
                      <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                        <CheckCircle2 size={12} /> Lengkap
                      </span>
                    ) : ekskul.progress > 0 ? (
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                        <Clock size={12} /> Berjalan
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                        <AlertTriangle size={12} /> Belum diisi
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                Daftar Siswa: {ekskulList.find(e => e.id === selectedEkskulId)?.name}
              </h3>
              <span className="text-xs font-bold text-slate-400 uppercase">Total: {studentDetails.length} Siswa</span>
            </div>
            <table className="table-modern">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="w-16">No</th>
                  <th>Nama Siswa</th>
                  <th className="text-center w-32">Kelas</th>
                  <th className="text-center w-32">Status Nilai</th>
                  <th className="text-center w-40">Terakhir Update</th>
                </tr>
              </thead>
              <tbody>
                {studentDetails.map((item, idx) => {
                  const isFilled = item.att_1 || item.average_score > 0
                  return (
                    <tr key={item.id}>
                      <td className="text-slate-400 text-center">{idx + 1}</td>
                      <td className="font-bold text-slate-700">{item.student?.name}</td>
                      <td className="text-center text-slate-500 font-medium">{item.student?.class_name}</td>
                      <td className="text-center">
                        {isFilled ? (
                          <span className="px-2.5 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold uppercase tracking-wider">Lengkap</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-bold uppercase tracking-wider">Belum diisi</span>
                        )}
                      </td>
                      <td className="text-center text-xs text-slate-400">
                        {new Date(item.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
