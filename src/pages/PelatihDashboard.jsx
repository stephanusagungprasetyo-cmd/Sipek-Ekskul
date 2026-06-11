import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Search, Loader2, Save, Filter, Plus, X, UserPlus, CheckCircle2, ArrowUpDown } from 'lucide-react'
import toast from 'react-hot-toast'

const ATTENDANCE_VALUES = ['', 'O', 'I', 'A', 'S']

const calculateAverage = (item) => {
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
  const [viewMode, setViewMode] = useState('attendance')
  const [sortConfig, setSortConfig] = useState({ key: 'class_name', direction: 'asc' })
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [newStudent, setNewStudent] = useState({ name: '', gender: 'L', class_name: '' })

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

  const handleLocalChange = (id, field, value) => {
    setData(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  }

  const handleSaveToDb = async (id, field, value) => {
    const currentItem = data.find(item => item.id === id);
    if (!currentItem) return;
    
    const tempItem = { ...currentItem, [field]: value };
    const avg = calculateAverage(tempItem);

    const dbValue = (value === '' || value === undefined || value === null) ? null : value;
    const { error } = await supabase.from('scores').update({ 
      [field]: dbValue, 
      average_score: avg 
    }).eq('id', id);
    
    if (error) toast.error('Gagal menyimpan');
  }

  const cycleAttendance = (id, field, current) => {
    const nextIdx = (ATTENDANCE_VALUES.indexOf(current || '') + 1) % ATTENDANCE_VALUES.length
    const nextVal = ATTENDANCE_VALUES[nextIdx]
    handleLocalChange(id, field, nextVal)
    handleSaveToDb(id, field, nextVal)
  }

  const handleAddStudent = async (e) => {
    e.preventDefault()
    if (!selectedEkskul) return toast.error('Pilih Ekskul terlebih dahulu')
    setLoading(true)
    try {
      const WAJIB_LIST = ['pramuka', 'pmr', 'dewan galang', 'paskibra']
      const ekskul = ekskuls.find(e => e.id === selectedEkskul)
      const ekskulName = ekskul ? ekskul.name : ''
      const isWajib = WAJIB_LIST.includes(ekskulName.toLowerCase())

      let { data: student } = await supabase.from('students').select('*').ilike('name', newStudent.name).single()
      
      if (!student) {
        const { data: created, error: sErr } = await supabase.from('students').insert({
          name: newStudent.name,
          gender: newStudent.gender,
          class_name: newStudent.class_name,
          [isWajib ? 'wajib_id' : 'pilihan_1_id']: selectedEkskul
        }).select('*').single()
        if (sErr) throw sErr
        student = created
      } else {
        // Cek apakah siswa sudah terasosiasi dengan ekskul ini di tabel students
        const isAlreadyAssigned = 
          student.wajib_id === selectedEkskul ||
          student.pilihan_1_id === selectedEkskul ||
          student.pilihan_2_id === selectedEkskul ||
          student.pilihan_3_id === selectedEkskul

        if (!isAlreadyAssigned) {
          let updatePayload = {}
          if (isWajib) {
            updatePayload.wajib_id = selectedEkskul
          } else if (!student.pilihan_1_id) {
            updatePayload.pilihan_1_id = selectedEkskul
          } else if (!student.pilihan_2_id) {
            updatePayload.pilihan_2_id = selectedEkskul
          } else if (!student.pilihan_3_id) {
            updatePayload.pilihan_3_id = selectedEkskul
          }
          
          if (Object.keys(updatePayload).length > 0) {
            const { error: uErr } = await supabase.from('students').update(updatePayload).eq('id', student.id)
            if (uErr) throw uErr
          }
        }
      }

      // Pastikan data scores tidak ganda
      const { data: existingScore } = await supabase
        .from('scores')
        .select('id')
        .eq('student_id', student.id)
        .eq('extracurricular_id', selectedEkskul)
        .maybeSingle()

      if (!existingScore) {
        const { error: scoreErr } = await supabase
          .from('scores')
          .insert({ student_id: student.id, extracurricular_id: selectedEkskul })
        if (scoreErr) throw scoreErr
      }

      toast.success('Siswa berhasil ditambahkan')
      setShowAddModal(false)
      setNewStudent({ name: '', gender: 'L', class_name: '' })
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Gagal menambah siswa')
    } finally { setLoading(false) }
  }

  const requestSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const filteredData = data.filter(item => 
    item.students?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.students?.class_name.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    const valA = sortConfig.key === 'name' ? a.students.name : a.students.class_name
    const valB = sortConfig.key === 'name' ? b.students.name : b.students.class_name
    
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
    
    // Secondary Sort by Name
    if (sortConfig.key === 'class_name') {
      return a.students.name.localeCompare(b.students.name)
    }
    return 0
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">
              {profile?.role === 'pendamping' ? 'Input Nilai (Pendamping)' : 'Panel Pelatih'}
            </h2>
            <div className="flex items-center gap-3">
              <select className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 shadow-sm" value={selectedEkskul} onChange={(e) => setSelectedEkskul(e.target.value)}>
                <option value="">Pilih Ekstrakurikuler</option>
                {ekskuls.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <select className="bg-primary-600 text-white border-0 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-300 shadow-lg shadow-primary-100" value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
                <option value="attendance">Kategori: Presensi</option>
                <option value="practice">Kategori: Nilai Praktik</option>
                <option value="knowledge">Kategori: Nilai Pengetahuan</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Cari siswa..." className="input-field pl-12" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn btn-secondary flex items-center gap-2 border-dashed border-slate-300 text-slate-600">
            <UserPlus size={18} /> Tambah Siswa
          </button>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p>Memuat data...</p>
          </div>
        ) : filteredData.length > 0 ? (
          <table className="table-modern whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="w-16 text-center">No</th>
                <th className="min-w-[180px] cursor-pointer" onClick={() => requestSort('name')}>
                  <div className="flex items-center gap-2">Nama Siswa <ArrowUpDown size={14} /></div>
                </th>
                <th className="w-24 text-center cursor-pointer" onClick={() => requestSort('class_name')}>
                  <div className="flex items-center gap-2">Kelas <ArrowUpDown size={14} /></div>
                </th>
                {viewMode === 'attendance' && [...Array(12)].map((_, i) => <th key={i} className="w-16 min-w-[64px] text-center px-1">{i+1}</th>)}
                {viewMode === 'practice' && [...Array(5)].map((_, i) => <th key={i} className="w-28 min-w-[110px] text-center px-1">P-{i+1}</th>)}
                {viewMode === 'knowledge' && [...Array(3)].map((_, i) => <th key={i} className="w-28 min-w-[110px] text-center px-1">U-{i+1}</th>)}
                <th className="w-20 text-center">Rerata</th>
                <th className="w-16 text-center">Grade</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, idx) => {
                const avg = calculateAverage(item)
                const grade = getGrade(avg)
                return (
                  <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="text-center text-slate-400">{idx + 1}</td>
                    <td className="font-bold text-slate-800">{item.students?.name}</td>
                    <td className="text-center text-slate-500 font-medium">{item.students?.class_name}</td>
                    {viewMode === 'attendance' && [...Array(12)].map((_, i) => {
                      const field = `att_${i+1}`
                      const val = item[field]
                      return (
                        <td key={i} className="p-1 text-center">
                          <div className="flex justify-center">
                            <button onClick={() => cycleAttendance(item.id, field, val)} className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black transition-all ${!val ? 'bg-slate-100 text-slate-300' : ''} ${val === 'O' ? 'bg-green-500 text-white' : ''} ${val === 'I' ? 'bg-blue-500 text-white' : ''} ${val === 'S' ? 'bg-amber-500 text-white' : ''} ${val === 'A' ? 'bg-red-500 text-white' : ''}`}>{val || '-'}</button>
                          </div>
                        </td>
                      )
                    })}
                    {viewMode === 'practice' && [...Array(5)].map((_, i) => (
                      <td key={i} className="p-1">
                        <input 
                          type="number" 
                          className="w-full h-11 bg-slate-50 border-0 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all outline-none" 
                          value={item[`prac_${i+1}`] === null || item[`prac_${i+1}`] === undefined ? '' : item[`prac_${i+1}`]} 
                          onChange={(e) => handleLocalChange(item.id, `prac_${i+1}`, e.target.value)}
                          onBlur={(e) => handleSaveToDb(item.id, `prac_${i+1}`, e.target.value)}
                        />
                      </td>
                    ))}
                    {viewMode === 'knowledge' && [...Array(3)].map((_, i) => (
                      <td key={i} className="p-1">
                        <input 
                          type="number" 
                          className="w-full h-11 bg-slate-50 border-0 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all outline-none" 
                          value={item[`know_${i+1}`] === null || item[`know_${i+1}`] === undefined ? '' : item[`know_${i+1}`]} 
                          onChange={(e) => handleLocalChange(item.id, `know_${i+1}`, e.target.value)}
                          onBlur={(e) => handleSaveToDb(item.id, `know_${i+1}`, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="text-center font-bold text-slate-700">{Math.round(avg)}</td>
                    <td className="text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-xs ${grade === 'A' ? 'bg-green-100 text-green-700' : grade === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{grade}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-20 text-center text-slate-400 font-medium">
            {!selectedEkskul 
              ? 'Silakan pilih ekstrakurikuler terlebih dahulu untuk mulai menginput nilai.' 
              : 'Belum ada siswa yang terdaftar di ekstrakurikuler ini.'}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">Tambah Siswa Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddStudent} className="p-8 space-y-5">
              <div><label className="block text-sm font-bold text-slate-700 mb-2">Nama Lengkap</label><input type="text" className="input-field" placeholder="Nama siswa..." required value={newStudent.name} onChange={(e) => setNewStudent({...newStudent, name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold text-slate-700 mb-2">Jenis Kelamin</label><select className="input-field" value={newStudent.gender} onChange={(e) => setNewStudent({...newStudent, gender: e.target.value})}><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></div>
                <div><label className="block text-sm font-bold text-slate-700 mb-2">Kelas</label><input type="text" className="input-field" placeholder="Contoh: 7A" required value={newStudent.class_name} onChange={(e) => setNewStudent({...newStudent, class_name: e.target.value})} /></div>
              </div>
              <div className="pt-4"><button type="submit" disabled={loading} className="w-full btn btn-primary py-3.5 flex items-center justify-center gap-2">{loading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />} Daftarkan Siswa</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
