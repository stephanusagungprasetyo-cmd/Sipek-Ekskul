import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  Loader2, 
  Trash2, 
  Database, 
  Edit3, 
  Search, 
  X, 
  Save,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Calendar,
  AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function MasterData() {
  // Tahun Ajaran State (Default 2026/2027)
  const [selectedYear, setSelectedYear] = useState('2026/2027')
  
  // Data & Pagination State
  const [students, setStudents] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'class_name', direction: 'asc' })
  
  // Modals
  const [showEditModal, setShowEditModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [isNewStudent, setIsNewStudent] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [importTargetYear, setImportTargetYear] = useState('2026/2027')
  const [ekskuls, setEkskuls] = useState([])

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    fetchEkskuls()
  }, [])

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from('students')
        .select(`
          *,
          wajib:extracurriculars!wajib_id(id, name),
          pilihan1:extracurriculars!pilihan_1_id(id, name),
          pilihan2:extracurriculars!pilihan_2_id(id, name),
          pilihan3:extracurriculars!pilihan_3_id(id, name)
        `, { count: 'exact' })

      // Filter Tahun Ajaran
      if (selectedYear === '2025/2026') {
        query = query.or('academic_year.eq.2025/2026,academic_year.is.null')
      } else {
        query = query.eq('academic_year', selectedYear)
      }

      // Filter Pencarian
      if (debouncedSearch.trim()) {
        query = query.or(`name.ilike.%${debouncedSearch.trim()}%,class_name.ilike.%${debouncedSearch.trim()}%`)
      }

      // Sorting
      if (sortConfig.key === 'class_name') {
        query = query
          .order('class_name', { ascending: sortConfig.direction === 'asc' })
          .order('name', { ascending: true })
      } else {
        query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' })
      }

      // Range Pagination
      query = query.range(from, to)

      const { data, count, error } = await query

      if (error) throw error

      setStudents(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      console.error(err)
      toast.error('Gagal mengambil data siswa: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedYear, page, pageSize, debouncedSearch, sortConfig])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  async function fetchEkskuls() {
    const { data } = await supabase.from('extracurriculars').select('*').order('name')
    setEkskuls(data || [])
  }

  const handleYearChange = (year) => {
    setSelectedYear(year)
    setImportTargetYear(year)
    setPage(1)
  }

  const requestSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
    setPage(1)
  }

  // Download Template Excel
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          'No': 1,
          'Nama Siswa': 'Ahmad Pratama',
          'JK': 'L',
          'Kelas': '7A',
          'Ekskul': 'Pramuka'
        },
        {
          'No': 2,
          'Nama Siswa': 'Ahmad Pratama',
          'JK': 'L',
          'Kelas': '7A',
          'Ekskul': 'Basket'
        },
        {
          'No': 3,
          'Nama Siswa': 'Siti Nurhaliza',
          'JK': 'P',
          'Kelas': '7B',
          'Ekskul': 'PMR'
        },
        {
          'No': 4,
          'Nama Siswa': 'Siti Nurhaliza',
          'JK': 'P',
          'Kelas': '7B',
          'Ekskul': 'English Club'
        }
      ]

      const worksheet = XLSX.utils.json_to_sheet(templateData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Siswa')

      worksheet['!cols'] = [
        { wch: 5 },
        { wch: 25 },
        { wch: 6 },
        { wch: 10 },
        { wch: 20 }
      ]

      XLSX.writeFile(workbook, 'Template_Import_Siswa_SIPEK.xlsx')
      toast.success('Template Excel berhasil diunduh!')
    } catch (err) {
      console.error(err)
      toast.error('Gagal mengunduh template: ' + err.message)
    }
  }

  // Export Data Siswa Tahun Ajaran Terpilih
  const handleExportExcel = async () => {
    try {
      toast.loading(`Mengekspor data T.A. ${selectedYear}...`, { id: 'exporting' })

      // Fetch semua data untuk tahun ajaran yang dipilih
      let query = supabase
        .from('students')
        .select(`
          name,
          gender,
          class_name,
          wajib:extracurriculars!wajib_id(name),
          pilihan1:extracurriculars!pilihan_1_id(name),
          pilihan2:extracurriculars!pilihan_2_id(name),
          pilihan3:extracurriculars!pilihan_3_id(name)
        `)
        .order('class_name', { ascending: true })
        .order('name', { ascending: true })

      if (selectedYear === '2025/2026') {
        query = query.or('academic_year.eq.2025/2026,academic_year.is.null')
      } else {
        query = query.eq('academic_year', selectedYear)
      }

      const { data: allStudents, error } = await query

      if (error) throw error

      if (!allStudents || allStudents.length === 0) {
        toast.error(`Tidak ada data siswa untuk Tahun Ajaran ${selectedYear}`, { id: 'exporting' })
        return
      }

      const excelData = allStudents.map((student, idx) => ({
        'No': idx + 1,
        'Nama Siswa': student.name,
        'JK': student.gender,
        'Kelas': student.class_name,
        'Ekskul Wajib': student.wajib?.name || '-',
        'Ekskul Pilihan 1': student.pilihan1?.name || '-',
        'Ekskul Pilihan 2': student.pilihan2?.name || '-',
        'Ekskul Pilihan 3': student.pilihan3?.name || '-'
      }))

      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, `Data Siswa ${selectedYear.replace('/', '-')}`)

      worksheet['!cols'] = [
        { wch: 5 },
        { wch: 28 },
        { wch: 6 },
        { wch: 10 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 }
      ]

      XLSX.writeFile(workbook, `Data_Siswa_TA_${selectedYear.replace('/', '_')}.xlsx`)
      toast.success(`Data siswa T.A. ${selectedYear} berhasil diekspor!`, { id: 'exporting' })
    } catch (err) {
      console.error(err)
      toast.error('Gagal mengekspor data: ' + err.message, { id: 'exporting' })
    }
  }

  // Import File Excel dengan Pilihan Tahun Ajaran
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

        if (data.length === 0) throw new Error('File Excel kosong atau format tidak sesuai')

        toast.loading(`Memproses import ke T.A. ${importTargetYear}...`, { id: 'uploading' })
        const WAJIB_LIST = ['pramuka', 'pmr', 'dewan galang', 'paskibra']

        let successCount = 0

        for (const row of data) {
          const name = (row['Nama Siswa'] || row['Nama'] || '').toString().trim()
          const genderRaw = (row['JK'] || row['Jenis Kelamin'] || '').toString().trim().toUpperCase()
          const gender = genderRaw.startsWith('P') ? 'P' : 'L'
          const className = (row['Kelas'] || '').toString().trim()
          const ekskulName = (row['Ekskul'] || row['Ekstrakurikuler'] || '').toString().trim()

          if (!name) continue

          // Cari ID Ekskul jika dicantumkan
          let eksData = null
          if (ekskulName) {
            const res = await supabase.from('extracurriculars').select('id').ilike('name', ekskulName).maybeSingle()
            eksData = res.data
          }

          // Cek apakah siswa sudah ada di tahun ajaran target
          let existQuery = supabase.from('students').select('*').ilike('name', name)
          if (importTargetYear === '2025/2026') {
            existQuery = existQuery.or('academic_year.eq.2025/2026,academic_year.is.null')
          } else {
            existQuery = existQuery.eq('academic_year', importTargetYear)
          }

          const { data: exist } = await existQuery.maybeSingle()
          const isWajib = ekskulName && WAJIB_LIST.includes(ekskulName.toLowerCase())

          if (exist) {
            // Update data ekskul siswa yang sudah ada di tahun ajaran ini
            let updatePayload = { class_name: className || exist.class_name }
            if (eksData) {
              if (isWajib) updatePayload.wajib_id = eksData.id
              else if (!exist.pilihan_1_id || exist.pilihan_1_id === eksData.id) updatePayload.pilihan_1_id = eksData.id
              else if (!exist.pilihan_2_id || exist.pilihan_2_id === eksData.id) updatePayload.pilihan_2_id = eksData.id
              else updatePayload.pilihan_3_id = eksData.id
            }

            await supabase.from('students').update(updatePayload).eq('id', exist.id)

            if (eksData) {
              await supabase.from('scores').upsert({ 
                student_id: exist.id, 
                extracurricular_id: eksData.id 
              }, { onConflict: 'student_id,extracurricular_id' })
            }
          } else {
            // Tambahkan siswa baru dengan academic_year target
            let insertPayload = {
              name,
              gender,
              class_name: className || '-',
              academic_year: importTargetYear
            }

            if (eksData) {
              if (isWajib) insertPayload.wajib_id = eksData.id
              else insertPayload.pilihan_1_id = eksData.id
            }

            const { data: created } = await supabase
              .from('students')
              .insert(insertPayload)
              .select('id')
              .single()

            if (created && eksData) {
              await supabase.from('scores').insert({ 
                student_id: created.id, 
                extracurricular_id: eksData.id 
              })
            }
          }

          successCount++
        }

        toast.success(`Berhasil mengimpor ${successCount} baris data ke T.A. ${importTargetYear}!`, { id: 'uploading' })
        setShowImportModal(false)
        setSelectedYear(importTargetYear)
        setPage(1)
        fetchStudents()
      } catch (err) {
        console.error(err)
        toast.error('Error: ' + err.message, { id: 'uploading' })
      } finally {
        setIsUploading(false)
        e.target.value = ''
      }
    }

    reader.readAsBinaryString(file)
  }

  // Tambah & Edit Siswa Manual
  const handleAddNewStudent = () => {
    setIsNewStudent(true)
    setEditingStudent({
      name: '',
      gender: 'L',
      class_name: '',
      academic_year: selectedYear,
      wajib_id: '',
      pilihan_1_id: '',
      pilihan_2_id: '',
      pilihan_3_id: ''
    })
    setShowEditModal(true)
  }

  const handleEditClick = (student) => {
    setIsNewStudent(false)
    setEditingStudent({
      ...student,
      wajib_id: student.wajib_id || '',
      pilihan_1_id: student.pilihan_1_id || '',
      pilihan_2_id: student.pilihan_2_id || '',
      pilihan_3_id: student.pilihan_3_id || '',
      academic_year: student.academic_year || selectedYear
    })
    setShowEditModal(true)
  }

  const handleSaveStudent = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        name: editingStudent.name,
        gender: editingStudent.gender,
        class_name: editingStudent.class_name,
        academic_year: editingStudent.academic_year || selectedYear,
        wajib_id: editingStudent.wajib_id || null,
        pilihan_1_id: editingStudent.pilihan_1_id || null,
        pilihan_2_id: editingStudent.pilihan_2_id || null,
        pilihan_3_id: editingStudent.pilihan_3_id || null
      }

      let studentId = editingStudent.id

      if (isNewStudent) {
        const { data: created, error } = await supabase.from('students').insert(payload).select('id').single()
        if (error) throw error
        studentId = created.id
        toast.success('Siswa baru berhasil ditambahkan!')
      } else {
        const { error } = await supabase.from('students').update(payload).eq('id', studentId)
        if (error) throw error
        toast.success('Data siswa berhasil diperbarui!')
      }

      // Upsert record nilai untuk ekskul terpilih
      const selectedEkskuls = [
        payload.wajib_id,
        payload.pilihan_1_id,
        payload.pilihan_2_id,
        payload.pilihan_3_id
      ].filter(Boolean)

      for (const eid of selectedEkskuls) {
        await supabase.from('scores').upsert({
          student_id: studentId,
          extracurricular_id: eid
        }, { onConflict: 'student_id,extracurricular_id' })
      }

      setShowEditModal(false)
      fetchStudents()
    } catch (err) {
      console.error(err)
      toast.error('Gagal menyimpan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteStudent = async (id, studentName) => {
    if (!window.confirm(`Hapus siswa "${studentName}"? Riwayat nilai siswa ini juga akan terhapus.`)) return
    
    try {
      const { error } = await supabase.from('students').delete().eq('id', id)
      if (error) throw error
      toast.success('Siswa berhasil dihapus')
      fetchStudents()
    } catch (err) {
      console.error(err)
      toast.error('Gagal menghapus: ' + err.message)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-50 border border-primary-200/80 rounded-full text-xs font-bold text-primary-700 mb-2">
            <Calendar size={13} />
            <span>Tahun Ajaran Aktif: {selectedYear}</span>
          </div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Management Data Siswa</h2>
          <p className="text-slate-500 text-sm mt-1">
            Kelola data siswa per tahun ajaran, import template Excel, dan integrasi pilihan ekskul.
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleDownloadTemplate}
            className="btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm flex items-center gap-2 text-xs font-bold py-2.5 px-3.5"
            title="Download Template Format Excel"
          >
            <Download size={15} className="text-slate-500" />
            <span>Download Template</span>
          </button>

          <button
            onClick={() => {
              setImportTargetYear(selectedYear)
              setShowImportModal(true)
            }}
            className="btn bg-primary-600 hover:bg-primary-700 text-white shadow-sm flex items-center gap-2 text-xs font-bold py-2.5 px-3.5"
          >
            <Upload size={15} />
            <span>Import Excel</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="btn bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 text-xs font-bold py-2.5 px-3.5"
          >
            <FileSpreadsheet size={15} />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleAddNewStudent}
            className="btn bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 text-xs font-bold py-2.5 px-3.5"
          >
            <Plus size={15} />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Tahun Ajaran Filter, Search & PageSize */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Tahun Ajaran Tabs / Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
            <Calendar size={14} className="text-primary-600" />
            Tahun Ajaran:
          </label>
          <div className="inline-flex p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => handleYearChange('2026/2027')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedYear === '2026/2027' 
                  ? 'bg-white text-primary-600 shadow-sm font-extrabold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2026/2027 (Baru)
            </button>
            <button
              onClick={() => handleYearChange('2025/2026')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedYear === '2025/2026' 
                  ? 'bg-white text-primary-600 shadow-sm font-extrabold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2025/2026 (Lama)
            </button>
            <button
              onClick={() => handleYearChange('2027/2028')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedYear === '2027/2028' 
                  ? 'bg-white text-primary-600 shadow-sm font-extrabold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2027/2028
            </button>
          </div>
        </div>

        {/* Search Input & Page Size */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Cari nama atau kelas..."
              className="input-field pl-10 py-2 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-xs text-slate-500">
            <span>Baris:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              className="input-field py-1.5 px-2 text-xs w-20 font-semibold"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table with Server Pagination */}
      <div className="table-container bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-primary-600" size={32} />
            <p className="text-sm font-medium">Memuat data siswa Tahun Ajaran {selectedYear}...</p>
          </div>
        ) : students.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="table-modern whitespace-nowrap w-full">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-bold text-slate-600">
                    <th className="w-14 text-center">No</th>
                    <th className="cursor-pointer hover:text-primary-600 transition-colors" onClick={() => requestSort('name')}>
                      <div className="flex items-center gap-1.5">Nama Siswa <ArrowUpDown size={13} /></div>
                    </th>
                    <th className="w-16 text-center">JK</th>
                    <th className="w-24 cursor-pointer hover:text-primary-600 transition-colors" onClick={() => requestSort('class_name')}>
                      <div className="flex items-center gap-1.5">Kelas <ArrowUpDown size={13} /></div>
                    </th>
                    <th>Wajib</th>
                    <th>Pilihan 1</th>
                    <th>Pilihan 2</th>
                    <th>Pilihan 3</th>
                    <th className="w-24 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {students.map((student, idx) => (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="text-center text-slate-400 font-medium">
                        {(page - 1) * pageSize + idx + 1}
                      </td>
                      <td className="font-bold text-slate-800">
                        {student.name}
                      </td>
                      <td className="text-center font-semibold text-slate-600">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] ${student.gender === 'P' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'}`}>
                          {student.gender}
                        </span>
                      </td>
                      <td className="font-bold text-slate-700">
                        {student.class_name}
                      </td>
                      <td><EkskulBadge name={student.wajib?.name} color="indigo" /></td>
                      <td><EkskulBadge name={student.pilihan1?.name} color="amber" /></td>
                      <td><EkskulBadge name={student.pilihan2?.name} color="teal" /></td>
                      <td><EkskulBadge name={student.pilihan3?.name} color="rose" /></td>
                      <td>
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => handleEditClick(student)} 
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                            title="Edit Siswa"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button 
                            onClick={() => deleteStudent(student.id, student.name)} 
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Hapus Siswa"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
              <div>
                Menampilkan <strong className="text-slate-800">{(page - 1) * pageSize + 1}</strong> - <strong className="text-slate-800">{Math.min(page * pageSize, totalCount)}</strong> dari <strong className="text-slate-800">{totalCount}</strong> siswa (T.A. {selectedYear})
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Halaman Pertama"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
                  Halaman {page} dari {totalPages}
                </span>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Halaman Selanjutnya"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Halaman Terakhir"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center">
              <Database size={28} />
            </div>
            <p className="font-bold text-slate-700">Belum ada data siswa untuk Tahun Ajaran {selectedYear}</p>
            <p className="text-xs text-slate-400 max-w-sm">
              Silakan klik tombol <strong>"Import Excel"</strong> untuk mengunggah file data siswa baru, atau gunakan <strong>"Download Template"</strong> jika membutuhkan format file.
            </p>
          </div>
        )}
      </div>

      {/* Modal Import Excel dengan Pemilih Tahun Ajaran */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Import Data Siswa</h3>
                  <p className="text-[11px] text-slate-400">Unggah file Excel .xlsx atau .xls</p>
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Pemilih Tahun Ajaran Tujuan Import */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Target Tahun Ajaran
                </label>
                <select
                  value={importTargetYear}
                  onChange={(e) => setImportTargetYear(e.target.value)}
                  className="input-field py-2 text-xs font-bold text-slate-800"
                >
                  <option value="2026/2027">Tahun Ajaran 2026/2027 (Baru)</option>
                  <option value="2025/2026">Tahun Ajaran 2025/2026 (Lama)</option>
                  <option value="2027/2028">Tahun Ajaran 2027/2028</option>
                </select>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Data yang diunggah akan otomatis terdata pada Tahun Ajaran yang Anda pilih di atas.
                </p>
              </div>

              {/* Area File Upload */}
              <div className="border-2 border-dashed border-slate-200 hover:border-primary-400 rounded-2xl p-6 text-center transition-colors">
                <FileSpreadsheet size={36} className="mx-auto text-primary-500 mb-2" />
                <p className="text-xs font-bold text-slate-700 mb-1">
                  Pilih file Excel yang akan diunggah
                </p>
                <p className="text-[10px] text-slate-400 mb-4">
                  Kolom format: <span className="font-semibold text-slate-600">Nama Siswa, JK, Kelas, Ekskul</span>
                </p>

                <label className="btn btn-primary py-2 px-5 text-xs font-bold cursor-pointer inline-flex items-center gap-2">
                  {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  <span>{isUploading ? 'Memproses...' : 'Pilih File Excel'}</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-start gap-2.5 text-[11px] text-blue-700">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-blue-600" />
                <p>
                  Belum punya format Excel? Gunakan tombol <strong>Download Template</strong> di halaman utama untuk format kolom yang telah disesuaikan.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Siswa */}
      {showEditModal && editingStudent && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800">
                {isNewStudent ? 'Tambah Data Siswa Baru' : 'Edit Data Siswa'}
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-6 sm:p-8 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nama Lengkap Siswa
                  </label>
                  <input 
                    type="text" 
                    className="input-field text-xs py-2" 
                    value={editingStudent.name} 
                    onChange={(e) => setEditingStudent({...editingStudent, name: e.target.value})} 
                    required 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Jenis Kelamin
                  </label>
                  <select 
                    className="input-field text-xs py-2" 
                    value={editingStudent.gender} 
                    onChange={(e) => setEditingStudent({...editingStudent, gender: e.target.value})}
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Kelas
                  </label>
                  <input 
                    type="text" 
                    className="input-field text-xs py-2" 
                    placeholder="Contoh: 7A, 8B"
                    value={editingStudent.class_name} 
                    onChange={(e) => setEditingStudent({...editingStudent, class_name: e.target.value})} 
                    required 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tahun Ajaran
                  </label>
                  <select 
                    className="input-field text-xs py-2 font-semibold"
                    value={editingStudent.academic_year}
                    onChange={(e) => setEditingStudent({...editingStudent, academic_year: e.target.value})}
                  >
                    <option value="2026/2027">2026/2027</option>
                    <option value="2025/2026">2025/2026</option>
                    <option value="2027/2028">2027/2028</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ekskul Wajib
                  </label>
                  <EkskulSelect 
                    value={editingStudent.wajib_id} 
                    ekskuls={ekskuls} 
                    onChange={(val) => setEditingStudent({...editingStudent, wajib_id: val})} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ekskul Pilihan 1
                  </label>
                  <EkskulSelect 
                    value={editingStudent.pilihan_1_id} 
                    ekskuls={ekskuls} 
                    onChange={(val) => setEditingStudent({...editingStudent, pilihan_1_id: val})} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ekskul Pilihan 2
                  </label>
                  <EkskulSelect 
                    value={editingStudent.pilihan_2_id} 
                    ekskuls={ekskuls} 
                    onChange={(val) => setEditingStudent({...editingStudent, pilihan_2_id: val})} 
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ekskul Pilihan 3
                  </label>
                  <EkskulSelect 
                    value={editingStudent.pilihan_3_id} 
                    ekskuls={ekskuls} 
                    onChange={(val) => setEditingStudent({...editingStudent, pilihan_3_id: val})} 
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 btn btn-secondary py-2.5 text-xs font-bold"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 btn btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{isNewStudent ? 'Tambahkan Siswa' : 'Simpan Perubahan'}</span>
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
  if (!name) return <span className="text-slate-300">-</span>
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100'
  }
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${colors[color]}`}>
      {name}
    </span>
  )
}

function EkskulSelect({ value, ekskuls, onChange }) {
  return (
    <select className="input-field text-xs py-2" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">-- Tidak ada --</option>
      {ekskuls.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
    </select>
  )
}
