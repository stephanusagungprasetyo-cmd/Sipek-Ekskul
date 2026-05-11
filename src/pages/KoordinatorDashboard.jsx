import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Loader2, Download, Printer, Filter, Star } from 'lucide-react'
import toast from 'react-hot-toast'

export default function KoordinatorDashboard() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    // Fetch students with their 3 possible ekskuls
    const { data: students, error } = await supabase
      .from('students')
      .select(`
        *,
        wajib:extracurriculars!wajib_id(id, name),
        pilihan1:extracurriculars!pilihan_1_id(id, name),
        pilihan2:extracurriculars!pilihan_2_id(id, name),
        scores(*)
      `)
      .order('class_name', { ascending: true })

    if (error) {
      toast.error('Gagal mengambil data rekap')
    } else {
      setData(students || [])
    }
    setLoading(false)
  }

  const getScoreForEkskul = (student, ekskulId) => {
    if (!ekskulId || !student.scores) return null
    return student.scores.find(s => s.extracurricular_id === ekskulId)
  }

  const renderScore = (score) => {
    if (!score) return '-'
    // We'll show the average_score or just the grade
    const avg = score.average_score || 0
    if (avg >= 86) return <span className="text-green-600 font-bold">A</span>
    if (avg >= 71) return <span className="text-blue-600 font-bold">B</span>
    return <span className="text-slate-400">C</span>
  }

  const filteredData = data.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.class_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Rekapitulasi Nilai</h2>
          <p className="text-slate-500 mt-1">Laporan menyeluruh nilai wajib dan pilihan siswa.</p>
        </div>

        <div className="flex gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Cari siswa..."
              className="input-field pl-12"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary flex items-center gap-2">
            <Printer size={18} />
            Cetak
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card border-0 bg-indigo-600 text-white shadow-xl shadow-indigo-100">
          <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest">Ekskul Wajib</p>
          <div className="flex items-end justify-between mt-2">
            <h3 className="text-3xl font-bold">Pramuka+</h3>
            <Star className="text-indigo-400 opacity-50" size={24} />
          </div>
        </div>
        <div className="card border-slate-100 bg-white">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Total Siswa</p>
          <h3 className="text-3xl font-bold text-slate-800 mt-1">{data.length}</h3>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p>Menyusun laporan...</p>
          </div>
        ) : filteredData.length > 0 ? (
          <table className="table-modern">
            <thead>
              <tr className="bg-slate-50/50">
                <th rowSpan="2" className="text-center w-12">No</th>
                <th rowSpan="2" className="min-w-[200px]">Nama Siswa</th>
                <th rowSpan="2" className="text-center w-24">Kelas</th>
                <th colSpan="2" className="text-center border-b border-slate-100 py-2 bg-indigo-50/30 text-indigo-700">Ekskul Wajib</th>
                <th colSpan="2" className="text-center border-b border-slate-100 py-2 bg-amber-50/30 text-amber-700">Pilihan 1</th>
                <th colSpan="2" className="text-center border-b border-slate-100 py-2 bg-teal-50/30 text-teal-700">Pilihan 2</th>
              </tr>
              <tr className="bg-slate-50/50">
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

                return (
                  <tr key={student.id}>
                    <td className="text-center text-slate-400">{idx + 1}</td>
                    <td className="font-bold text-slate-800">{student.name}</td>
                    <td className="text-center text-slate-500 font-medium">{student.class_name}</td>
                    
                    {/* Wajib */}
                    <td className="text-[11px] font-semibold text-slate-600">{student.wajib?.name || '-'}</td>
                    <td className="text-center font-black">{renderScore(sWajib)}</td>
                    
                    {/* P1 */}
                    <td className="text-[11px] font-semibold text-slate-600">{student.pilihan1?.name || '-'}</td>
                    <td className="text-center font-black">{renderScore(sP1)}</td>
                    
                    {/* P2 */}
                    <td className="text-[11px] font-semibold text-slate-600">{student.pilihan2?.name || '-'}</td>
                    <td className="text-center font-black">{renderScore(sP2)}</td>
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
