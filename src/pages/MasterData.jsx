import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MasterData() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    fetchStudents()
  }, [])

  async function fetchStudents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('students')
      .select('*, extracurriculars(name)')
      .order('class_name', { ascending: true })
    
    if (error) {
      toast.error('Gagal mengambil data siswa')
    } else {
      setStudents(data)
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

        if (data.length === 0) {
          throw new Error('File Excel kosong atau tidak valid')
        }

        // Processing data
        // Expecting columns: Nama, JK, Kelas, Ekskul (or similar)
        toast.loading('Memproses data...', { id: 'uploading' })

        for (const row of data) {
          const studentName = row['Nama Siswa'] || row['Nama']
          const gender = row['JK'] || row['Jenis Kelamin']
          const className = row['Kelas']
          const ekskulName = row['Ekskul'] || row['Ekstrakurikuler']

          if (!studentName || !ekskulName) continue

          // 1. Get or Create Extracurricular
          let { data: ekskul } = await supabase
            .from('extracurriculars')
            .select('id')
            .eq('name', ekskulName)
            .single()

          if (!ekskul) {
            const { data: newEkskul } = await supabase
              .from('extracurriculars')
              .insert({ name: ekskulName })
              .select('id')
              .single()
            ekskul = newEkskul
          }

          // 2. Insert Student
          const { data: student, error: studentError } = await supabase
            .from('students')
            .insert({
              name: studentName,
              gender: gender === 'P' || gender?.toLowerCase().includes('perempuan') ? 'P' : 'L',
              class_name: className || '-',
              extracurricular_id: ekskul.id
            })
            .select('id')
            .single()

          if (student && !studentError) {
            // 3. Initialize Score
            await supabase.from('scores').insert({
              student_id: student.id,
              extracurricular_id: ekskul.id
            })
          }
        }

        toast.success('Berhasil mengunggah data siswa', { id: 'uploading' })
        fetchStudents()
      } catch (err) {
        console.error(err)
        toast.error('Error parsing file: ' + err.message, { id: 'uploading' })
      } finally {
        setIsUploading(false)
      }
    }

    reader.readAsBinaryString(file)
  }

  const deleteAllData = async () => {
    if (!window.confirm('Hapus seluruh data siswa? Tindakan ini tidak bisa dibatalkan.')) return
    
    setLoading(true)
    const { error } = await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    if (error) {
      toast.error('Gagal menghapus data')
    } else {
      toast.success('Seluruh data berhasil dihapus')
      fetchStudents()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Master Data Siswa</h2>
          <p className="text-slate-500 mt-1">Kelola dan unggah basis data siswa dari file Excel.</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={deleteAllData}
            className="btn btn-secondary text-red-500 hover:bg-red-50 hover:border-red-100 flex items-center gap-2"
          >
            <Trash2 size={18} />
            Hapus Semua
          </button>
          
          <label className="btn btn-primary cursor-pointer flex items-center gap-2">
            {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
            {isUploading ? 'Mengunggah...' : 'Upload Excel'}
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white border-0">
          <p className="text-primary-100 text-sm font-medium">Total Siswa</p>
          <h3 className="text-4xl font-bold mt-1">{students.length}</h3>
          <p className="text-primary-100 text-xs mt-4 flex items-center gap-1">
            <CheckCircle2 size={14} /> Terdata di sistem
          </p>
        </div>
        <div className="card">
          <p className="text-slate-400 text-sm font-medium">Format Excel</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
              <FileSpreadsheet size={20} />
            </div>
            <div className="text-xs text-slate-500">
              Gunakan kolom: <span className="font-bold">Nama, JK, Kelas, Ekskul</span>
            </div>
          </div>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p>Memuat data siswa...</p>
          </div>
        ) : students.length > 0 ? (
          <table className="table-modern">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Siswa</th>
                <th>JK</th>
                <th>Kelas</th>
                <th>Ekstrakurikuler</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, idx) => (
                <tr key={student.id}>
                  <td className="w-16">{idx + 1}</td>
                  <td className="font-semibold text-slate-800">{student.name}</td>
                  <td>{student.gender}</td>
                  <td>{student.class_name}</td>
                  <td>
                    <span className="px-2.5 py-1 bg-slate-100 rounded-full text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {student.extracurriculars?.name}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
              <Database size={32} />
            </div>
            <div>
              <p className="font-medium text-slate-500">Belum ada data siswa</p>
              <p className="text-sm">Silakan unggah file Excel untuk memulai.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
