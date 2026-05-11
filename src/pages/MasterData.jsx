import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Trash2, 
  Database, 
  Edit3, 
  Search, 
  X, 
  Save,
  ArrowUpDown
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function MasterData() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'class_name', direction: 'asc' })
  
  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [ekskuls, setEkskuls] = useState([])

  useEffect(() => {
    fetchStudents()
    fetchEkskuls()
  }, [])

  async function fetchEkskuls() {
    const { data } = await supabase.from('extracurriculars').select('*').order('name')
    setEkskuls(data || [])
  }

  async function fetchStudents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        wajib:extracurriculars!wajib_id(id, name),
        pilihan1:extracurriculars!pilihan_1_id(id, name),
        pilihan2:extracurriculars!pilihan_2_id(id, name)
      `)
    
    if (error) {
      toast.error('Gagal mengambil data siswa')
    } else {
      setStudents(data || [])
    }
    setLoading(false)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIsUploading(true)
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws)
        if (data.length === 0) throw new Error('File Excel kosong')
        toast.loading('Memproses data...', { id: 'uploading' })
        const WAJIB_LIST = ['pramuka', 'pmr', 'dewan galang', 'paskibra']

        for (const row of data) {
          const name = (row['Nama Siswa'] || row['Nama'] || '').toString().trim()
          const gender = (row['JK'] || '').toString().trim().toUpperCase()
          const className = (row['Kelas'] || '').toString().trim()
          const ekskulName = (row['Ekskul'] || '').toString().trim()
          if (!name || !ekskulName) continue

          const { data: eksData } = await supabase.from('extracurriculars').select('id').ilike('name', ekskulName).single()
          if (!eksData) continue
          
          const { data: exist } = await supabase.from('students').select('*').ilike('name', name).single()
          const isWajib = WAJIB_LIST.includes(ekskulName.toLowerCase())

          if (exist) {
            let updatePayload = {}
            if (isWajib) updatePayload.wajib_id = eksData.id
            else if (!exist.pilihan_1_id) updatePayload.pilihan_1_id = eksData.id
            else updatePayload.pilihan_2_id = eksData.id
            await supabase.from('students').update(updatePayload).eq('id', exist.id)
            await supabase.from('scores').upsert({ student_id: exist.id, extracurricular_id: eksData.id }, { onConflict: 'student_id,extracurricular_id' })
          } else {
            const { data: created } = await supabase.from('students').insert({
              name, gender: gender === 'P' ? 'P' : 'L', class_name: className,
              [isWajib ? 'wajib_id' : 'pilihan_1_id']: eksData.id
            }).select('id').single()
            if (created) await supabase.from('scores').insert({ student_id: created.id, extracurricular_id: eksData.id })
          }
        }
        toast.success('Sinkronisasi selesai', { id: 'uploading' })
        fetchStudents()
      } catch (err) {
        toast.error('Error: ' + err.message, { id: 'uploading' })
      } finally { setIsUploading(false) }
    }
    reader.readAsBinaryString(file)
  }

  const handleEdit = (student) => {
    setEditingStudent({
      ...student,
      wajib_id: student.wajib_id || '',
      pilihan_1_id: student.pilihan_1_id || '',
      pilihan_2_id: student.pilihan_2_id || ''
    })
    setShowModal(true)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase
      .from('students')
      .update({
        name: editingStudent.name,
        gender: editingStudent.gender,
        class_name: editingStudent.class_name,
        wajib_id: editingStudent.wajib_id || null,
        pilihan_1_id: editingStudent.pilihan_1_id || null,
        pilihan_2_id: editingStudent.pilihan_2_id || null
      })
      .eq('id', editingStudent.id)

    if (error) {
      toast.error('Gagal memperbarui data')
    } else {
      // Ensure scores exist for the selected ekskuls
      const ids = [editingStudent.wajib_id, editingStudent.pilihan_1_id, editingStudent.pilihan_2_id].filter(Boolean)
      for (const eid of ids) {
        await supabase.from('scores').upsert({ student_id: editingStudent.id, extracurricular_id: eid }, { onConflict: 'student_id,extracurricular_id' })
      }
      toast.success('Data berhasil diperbarui')
      setShowModal(false)
      fetchStudents()
    }
    setLoading(false)
  }

  const deleteStudent = async (id) => {
    if (!window.confirm('Hapus siswa ini?')) return
    const { error } = await supabase.from('students').delete().eq('id', id)
    if (error) toast.error('Gagal menghapus')
    else { toast.success('Berhasil dihapus'); fetchStudents() }
  }

  const requestSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const sortedStudents = [...students].filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.class_name.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    // Primary Sort
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1
    
    // Secondary Sort (always by name ASC if sorting by class)
    if (sortConfig.key === 'class_name') {
      return a.name.localeCompare(b.name)
    }
    
    return 0
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Master Data Siswa</h2>
          <p className="text-slate-500 mt-1">Kelola, edit, dan unggah basis data siswa.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Cari nama atau kelas..."
              className="input-field pl-12"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <label className="btn btn-primary cursor-pointer flex items-center gap-2">
            {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
            <span className="hidden sm:inline">{isUploading ? 'Mengunggah...' : 'Upload Excel'}</span>
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p>Memuat data...</p>
          </div>
        ) : sortedStudents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-modern whitespace-nowrap">
              <thead>
                <tr>
                  <th className="w-16">No</th>
                  <th className="cursor-pointer hover:text-primary-600 transition-colors" onClick={() => requestSort('name')}>
                    <div className="flex items-center gap-2">Nama Siswa <ArrowUpDown size={14} /></div>
                  </th>
                  <th className="w-20">JK</th>
                  <th className="w-32 cursor-pointer hover:text-primary-600 transition-colors" onClick={() => requestSort('class_name')}>
                    <div className="flex items-center gap-2">Kelas <ArrowUpDown size={14} /></div>
                  </th>
                  <th>Wajib</th>
                  <th>Pilihan 1</th>
                  <th>Pilihan 2</th>
                  <th className="w-24 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student, idx) => (
                  <tr key={student.id} className="hover:bg-slate-50/50">
                    <td className="text-slate-400">{idx + 1}</td>
                    <td className="font-bold text-slate-800">{student.name}</td>
                    <td className="text-slate-500 font-medium">{student.gender}</td>
                    <td className="text-slate-500 font-medium">{student.class_name}</td>
                    <td><EkskulBadge name={student.wajib?.name} color="indigo" /></td>
                    <td><EkskulBadge name={student.pilihan1?.name} color="amber" /></td>
                    <td><EkskulBadge name={student.pilihan2?.name} color="teal" /></td>
                    <td>
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(student)} className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"><Edit3 size={16} /></button>
                        <button onClick={() => deleteStudent(student.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-20 text-center text-slate-400">Belum ada data.</div>
        )}
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">Edit Data Siswa</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nama Lengkap</label>
                  <input type="text" className="input-field" value={editingStudent.name} onChange={(e) => setEditingStudent({...editingStudent, name: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Jenis Kelamin</label>
                  <select className="input-field" value={editingStudent.gender} onChange={(e) => setEditingStudent({...editingStudent, gender: e.target.value})}>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Kelas</label>
                  <input type="text" className="input-field" value={editingStudent.class_name} onChange={(e) => setEditingStudent({...editingStudent, class_name: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Ekskul Wajib</label>
                  <EkskulSelect value={editingStudent.wajib_id} ekskuls={ekskuls} onChange={(val) => setEditingStudent({...editingStudent, wajib_id: val})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Ekskul Pilihan 1</label>
                  <EkskulSelect value={editingStudent.pilihan_1_id} ekskuls={ekskuls} onChange={(val) => setEditingStudent({...editingStudent, pilihan_1_id: val})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Ekskul Pilihan 2</label>
                  <EkskulSelect value={editingStudent.pilihan_2_id} ekskuls={ekskuls} onChange={(val) => setEditingStudent({...editingStudent, pilihan_2_id: val})} />
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" disabled={loading} className="w-full btn btn-primary py-4 flex items-center justify-center gap-2">
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function EkskulBadge({ name, color }) {
  if (!name) return null
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    teal: 'bg-teal-50 text-teal-600'
  }
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${colors[color]}`}>
      {name}
    </span>
  )
}

function EkskulSelect({ value, ekskuls, onChange }) {
  return (
    <select className="input-field" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Tidak ada</option>
      {ekskuls.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
    </select>
  )
}
