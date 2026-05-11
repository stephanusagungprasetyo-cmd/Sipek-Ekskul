import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LayoutDashboard, Users, Clock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PendampingDashboard() {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    setLoading(true)
    const { data: ekskuls, error: eError } = await supabase.from('extracurriculars').select('*').order('name')
    const { data: scores, error: sError } = await supabase.from('scores').select('extracurricular_id, average_score, att_1')

    if (eError || sError) {
      toast.error('Gagal memuat status monitoring')
      setLoading(false)
      return
    }

    const calculatedStats = ekskuls.map(ekskul => {
      const ekskulScores = scores.filter(s => s.extracurricular_id === ekskul.id)
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Monitoring Pengisian Nilai</h2>
        <p className="text-slate-500 mt-1">Pantau progres pengisian nilai oleh setiap pelatih ekskul.</p>
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
            <p>Menganalisis progres...</p>
          </div>
        ) : (
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
                <tr key={ekskul.id}>
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
        )}
      </div>
    </div>
  )
}
