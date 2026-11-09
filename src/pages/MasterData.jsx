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
  
  // Data & Pagination State (Pilihan baris: 10, 20, 50 - Default: 20)
  const [students, setStudents] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
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

  // Supabase Realtime Listener untuk tabel students
  useEffect(() => {
    const channel = supabase
      .channel('students-master-data-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => {
          fetchStudents()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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

  // Download Template Excel (Format 9 Kolom Sesuai Revisi)
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          'No': 1,
          'Nama Lengkap Siswa': 'Ahmad Pratama',
          'JK': 'L',
          'Kelas': '7A',
          'Tahun Ajaran': selectedYear || '2026/2027',
          'Ekskul Wajib': 'Pramuka',
          'Ekskul Pilihan 1': 'Basket',
          'Ekskul Pilihan 2': 'English Club',
          'Ekskul Pilihan 3': ''
        },
        {
          'No': 2,
          'Nama Lengkap Siswa': 'Siti Nurhaliza',
          'JK': 'P',
          'Kelas': '7B',
          'Tahun Ajaran': selectedYear || '2026/2027',
          'Ekskul Wajib': 'PMR',
          'Ekskul Pilihan 1': 'Modern Dance',
          'Ekskul Pilihan 2': '',
          'Ekskul Pilihan 3': ''
        },
        {
          'No': 3,
          'Nama Lengkap Siswa': 'Budi Santoso',
          'JK': 'L',
          'Kelas': '8A',
          'Tahun Ajaran': selectedYear || '2026/2027',
          'Ekskul Wajib': 'Paskibra',
          'Ekskul Pilihan 1': 'Futsal',
          'Ekskul Pilihan 2': 'Programming',
          'Ekskul Pilihan 3': 'Science Club'
        }
      ]

      const worksheet = XLSX.utils.json_to_sheet(templateData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Siswa')

      worksheet['!cols'] = [
        { wch: 5 },
        { wch: 26 },
        { wch: 6 },
        { wch: 8 },
        { wch: 14 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 }
      ]

      XLSX.writeFile(workbook, 'Template_Master_Data_Siswa_SIPEK.xlsx')
      toast.success('Template Excel 9 kolom berhasil diunduh!')
    } catch (err) {
      console.error(err)
      toast.error('Gagal mengunduh template: ' + err.message)
    }
  }

  // Export Data Siswa Tahun Ajaran Terpilih
  const handleExportExcel = async () => {
    try {
      toast.loading(`Mengekspor data T.A. ${selectedYear}...`, { id: 'exporting' })

      let query = supabase
        .from('students')
        .select(`
          name,
          gender,
          class_name,
          academic_year,
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
        'Nama Lengkap Siswa': student.name,
        'JK': student.gender,
        'Kelas': student.class_name,
        'Tahun Ajaran': student.academic_year || selectedYear,
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
        { wch: 26 },
        { wch: 6 },
        { wch: 8 },
        { wch: 14 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 }
      ]

      XLSX.writeFile(workbook, `Data_Siswa_TA_${selectedYear.replace('/', '_')}.xlsx`)
      toast.success(`Data siswa T.A. ${selectedYear} berhasil diekspor!`, { id: 'exporting' })
    } catch (err) {
      console.error(err)
      toast.error('Gagal mengekspor data: ' + err.message, { id: 'exporting' })
    }
  }

  // Import File Excel (Mendukung Format 9 Kolom Baru & Format Lama)
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

        toast.loading(`Memproses import ${data.length} baris data...`, { id: 'uploading' })
        
        // Buat map ekstrakurikuler case-insensitive untuk pencarian cepat ID
        const ekskulMap = {}
        ekskuls.forEach(ek => {
          ekskulMap[ek.name.toLowerCase().trim()] = ek.id
        })

        const findEkskulId = (name) => {
          if (!name) return null
          const clean = name.toString().toLowerCase().trim()
          return ekskulMap[clean] || null
        }

        let successCount = 0

        for (const row of data) {
          const name = (row['Nama Lengkap Siswa'] || row['Nama Siswa'] || row['Nama'] || '').toString().trim()
          const genderRaw = (row['JK'] || row['Jenis Kelamin'] || '').toString().trim().toUpperCase()
          const gender = genderRaw.startsWith('P') ? 'P' : 'L'
          const className = (row['Kelas'] || '').toString().trim()
          const rowYear = (row['Tahun Ajaran'] || importTargetYear || selectedYear).toString().trim()

          if (!name) continue

          // Resolusi Ekskul dari Kolom 9-Format Baru
          const wajibId = findEkskulId(row['Ekskul Wajib'])
          const pil1Id = findEkskulId(row['Ekskul Pilihan 1'] || row['Ekskul'])
          const pil2Id = findEkskulId(row['Ekskul Pilihan 2'])
          const pil3Id = findEkskulId(row['Ekskul Pilihan 3'])

          // Cek apakah siswa sudah ada di tahun ajaran ini (cocokkan nama, kelas, dan tahun ajaran)
          let existQuery = supabase.from('students').select('*').ilike('name', name)
          if (className) {
            existQuery = existQuery.eq('class_name', className)
          }
          if (rowYear === '2025/2026') {
            existQuery = existQuery.or('academic_year.eq.2025/2026,academic_year.is.null')
          } else {
            existQuery = existQuery.eq('academic_year', rowYear)
          }

          const { data: exist } = await existQuery.maybeSingle()

          let studentId = null

          if (exist) {
            studentId = exist.id
            const updatePayload = {
              class_name: className || exist.class_name,
              academic_year: rowYear
            }
            if (wajibId) updatePayload.wajib_id = wajibId
            if (pil1Id) updatePayload.pilihan_1_id = pil1Id
            if (pil2Id) updatePayload.pilihan_2_id = pil2Id
            if (pil3Id) updatePayload.pilihan_3_id = pil3Id

            await supabase.from('students').update(updatePayload).eq('id', studentId)
          } else {
            const insertPayload = {
              name,
              gender,
              class_name: className || '-',
              academic_year: rowYear,
              wajib_id: wajibId,
              pilihan_1_id: pil1Id,
              pilihan_2_id: pil2Id,
              pilihan_3_id: pil3Id
            }

            const { data: created, error: createErr } = await supabase
              .from('students')
              .insert(insertPayload)
              .select('id')
              .single()

            if (createErr) throw createErr
            studentId = created?.id
          }

          // Sinkronisasi record scores: bersihkan ekskul lama yang sudah tidak aktif & upsert yang aktif
          const activeEkskulIds = [wajibId, pil1Id, pil2Id, pil3Id].filter(Boolean)
          if (exist && activeEkskulIds.length > 0) {
            await supabase.from('scores')
              .delete()
              .eq('student_id', studentId)
              .not('extracurricular_id', 'in', `(${activeEkskulIds.join(',')})`)
          }
          for (const eid of activeEkskulIds) {
            await supabase.from('scores').upsert({
              student_id: studentId,
              extracurricular_id: eid
            }, { onConflict: 'student_id,extracurricular_id' })
          }

          successCount++
        }

        toast.success(`Berhasil memproses ${successCount} data siswa!`, { id: 'uploading' })
        setShowImportModal(false)
        setSelectedYear(importTargetYear)
        setPage(1)
        fetchStudents()
      } catch (err) {
        console.error(err)
        toast.error('Gagal import: ' + err.message, { id: 'uploading' })
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

      // Sinkronisasi record scores untuk ekskul terpilih
      const selectedEkskuls = [
        payload.wajib_id,
        payload.pilihan_1_id,
        payload.pilihan_2_id,
        payload.pilihan_3_id
      ].filter(Boolean)

      // Bersihkan baris nilai ekskul lama yang sudah tidak lagi dipilih oleh siswa ini
      if (!isNewStudent) {
        if (selectedEkskuls.length > 0) {
          await supabase.from('scores')
            .delete()
            .eq('student_id', studentId)
            .not('extracurricular_id', 'in', `(${selectedEkskuls.join(',')})`)
        } else {
          await supabase.from('scores').delete().eq('student_id', studentId)
        }
      }

      // Upsert record nilai untuk ekskul yang saat ini dipilih
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
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Management Data Siswa</h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Sumber master data siswa sekolah untuk role Pendamping, Pelatih, dan Koordinator.
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm flex items-center gap-1.5 text-xs font-bold py-2 px-3"
            title="Download Template 9 Kolom Excel"
          >
            <Download size={14} className="text-slate-500" />
            <span>Download Template</span>
          </button>

          <button
            onClick={() => {
              setImportTargetYear(selectedYear)
              setShowImportModal(true)
            }}
            className="btn bg-primary-600 hover:bg-primary-700 text-white shadow-sm flex items-center gap-1.5 text-xs font-bold py-2 px-3"
          >
            <Upload size={14} />
            <span>Import Excel</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="btn bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 text-xs font-bold py-2 px-3"
          >
            <FileSpreadsheet size={14} />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleAddNewStudent}
            className="btn bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 text-xs font-bold py-2 px-3"
          >
            <Plus size={14} />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Tahun Ajaran Dropdown, Search & PageSize */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Tahun Ajaran Dropdown (Revisi Poin 1) */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
            <Calendar size={14} className="text-primary-600" />
            Tahun Ajaran:
          </label>
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(e.target.value)}
            className="input-field py-1.5 px-3 text-xs font-bold text-slate-800 bg-slate-50 w-auto min-w-[140px]"
          >
            <option value="2026/2027">2026/2027 (Baru)</option>
            <option value="2025/2026">2025/2026 (Lama)</option>
            <option value="2027/2028">2027/2028</option>
          </select>
        </div>

        {/* Search Input & Page Size (Pilihan: 10, 20, 50 - Revisi Tambahan) */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 md:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Cari nama atau kelas..."
              className="input-field pl-9 py-1.5 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 text-xs text-slate-500">
            <span>Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              className="input-field py-1 px-2 text-xs w-16 font-bold"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Compact Table (Ringkas, minim scroll kanan-kiri) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-primary-600" size={28} />
            <p className="text-xs font-medium">Memuat data siswa Tahun Ajaran {selectedYear}...</p>
          </div>
        ) : students.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="table-modern w-full text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 font-bold text-slate-600">
                    <th className="w-10 text-center py-2 px-2">No</th>
                    <th className="cursor-pointer hover:text-primary-600 transition-colors py-2 px-3" onClick={() => requestSort('name')}>
                      <div className="flex items-center gap-1">Nama Siswa <ArrowUpDown size={11} /></div>
                    </th>
                    <th className="w-12 text-center py-2 px-1">JK</th>
                    <th className="w-16 cursor-pointer hover:text-primary-600 transition-colors text-center py-2 px-1" onClick={() => requestSort('class_name')}>
                      <div className="flex items-center justify-center gap-1">Kelas <ArrowUpDown size={11} /></div>
                    </th>
                    <th className="py-2 px-2">Ekskul Wajib</th>
                    <th className="py-2 px-2">Pilihan 1</th>
                    <th className="py-2 px-2">Pilihan 2</th>
                    <th className="py-2 px-2">Pilihan 3</th>
                    <th className="w-16 text-center py-2 px-2">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((student, idx) => (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="text-center text-slate-400 font-medium py-2 px-2">
                        {(page - 1) * pageSize + idx + 1}
                      </td>
                      <td className="font-bold text-slate-800 py-2 px-3">
                        {student.name}
                      </td>
                      <td className="text-center py-2 px-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${student.gender === 'P' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'}`}>
                          {student.gender}
                        </span>
                      </td>
                      <td className="font-bold text-slate-700 text-center py-2 px-1">
                        {student.class_name}
                      </td>
                      <td className="py-2 px-2"><EkskulBadge name={student.wajib?.name} color="indigo" /></td>
                      <td className="py-2 px-2"><EkskulBadge name={student.pilihan1?.name} color="amber" /></td>
                      <td className="py-2 px-2"><EkskulBadge name={student.pilihan2?.name} color="teal" /></td>
                      <td className="py-2 px-2"><EkskulBadge name={student.pilihan3?.name} color="rose" /></td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => handleEditClick(student)} 
                            className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-all"
                            title="Edit Siswa"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button 
                            onClick={() => deleteStudent(student.id, student.name)} 
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                            title="Hapus Siswa"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
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
                  <ChevronsLeft size={15} />
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft size={15} />
                </button>

                <span className="px-2.5 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg text-xs">
                  Halaman {page} dari {totalPages}
                </span>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Halaman Selanjutnya"
                >
                  <ChevronRight size={15} />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Halaman Terakhir"
                >
                  <ChevronsRight size={15} />
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
              Silakan klik <strong>"Import Excel"</strong> untuk mengunggah template data siswa baru (9 kolom), atau klik <strong>"Download Template"</strong> untuk mengunduh formatnya.
            </p>
          </div>
        )}
      </div>

      {/* Modal Import Excel 9 Kolom dengan Pilihan Tahun Ajaran */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                  <Upload size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Import Master Data Siswa</h3>
                  <p className="text-[11px] text-slate-400">Format 9 Kolom Excel</p>
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Target Tahun Ajaran (Fallback)
                </label>
                <select
                  value={importTargetYear}
                  onChange={(e) => setImportTargetYear(e.target.value)}
                  className="input-field py-1.5 text-xs font-bold text-slate-800"
                >
                  <option value="2026/2027">2026/2027 (Baru)</option>
                  <option value="2025/2026">2025/2026 (Lama)</option>
                  <option value="2027/2028">2027/2028</option>
                </select>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Jika baris di Excel tidak mengisi Tahun Ajaran, target di atas yang akan digunakan secara otomatis.
                </p>
              </div>

              <div className="border-2 border-dashed border-slate-200 hover:border-primary-400 rounded-2xl p-5 text-center transition-colors">
                <FileSpreadsheet size={32} className="mx-auto text-primary-500 mb-2" />
                <p className="text-xs font-bold text-slate-700 mb-0.5">
                  Pilih file Excel yang akan diunggah
                </p>
                <p className="text-[10px] text-slate-400 mb-3 leading-tight">
                  Format: <span className="font-semibold text-slate-600">No, Nama Lengkap Siswa, JK, Kelas, Tahun Ajaran, Ekskul Wajib, Pilihan 1-3</span>
                </p>

                <label className="btn btn-primary py-2 px-4 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
                  {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
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

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-start gap-2 text-[11px] text-blue-700">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-blue-600" />
                <p>
                  Gunakan tombol <strong>Download Template</strong> untuk memastikan 9 kolom sudah sesuai format.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Siswa */}
      {showEditModal && editingStudent && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-base font-bold text-slate-800">
                {isNewStudent ? 'Tambah Data Siswa Baru' : 'Edit Data Siswa'}
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nama Lengkap Siswa
                  </label>
                  <input 
                    type="text" 
                    className="input-field text-xs py-1.5" 
                    value={editingStudent.name} 
                    onChange={(e) => setEditingStudent({...editingStudent, name: e.target.value})} 
                    required 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Jenis Kelamin
                  </label>
                  <select 
                    className="input-field text-xs py-1.5" 
                    value={editingStudent.gender} 
                    onChange={(e) => setEditingStudent({...editingStudent, gender: e.target.value})}
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kelas
                  </label>
                  <input 
                    type="text" 
                    className="input-field text-xs py-1.5" 
                    placeholder="Contoh: 7A, 8B"
                    value={editingStudent.class_name} 
                    onChange={(e) => setEditingStudent({...editingStudent, class_name: e.target.value})} 
                    required 
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tahun Ajaran
                  </label>
                  <select 
                    className="input-field text-xs py-1.5 font-bold"
                    value={editingStudent.academic_year}
                    onChange={(e) => setEditingStudent({...editingStudent, academic_year: e.target.value})}
                  >
                    <option value="2026/2027">2026/2027</option>
                    <option value="2025/2026">2025/2026</option>
                    <option value="2027/2028">2027/2028</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ekskul Wajib
                  </label>
                  <EkskulSelect 
                    value={editingStudent.wajib_id} 
                    ekskuls={ekskuls} 
                    onChange={(val) => setEditingStudent({...editingStudent, wajib_id: val})} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ekskul Pilihan 1
                  </label>
                  <EkskulSelect 
                    value={editingStudent.pilihan_1_id} 
                    ekskuls={ekskuls} 
                    onChange={(val) => setEditingStudent({...editingStudent, pilihan_1_id: val})} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ekskul Pilihan 2
                  </label>
                  <EkskulSelect 
                    value={editingStudent.pilihan_2_id} 
                    ekskuls={ekskuls} 
                    onChange={(val) => setEditingStudent({...editingStudent, pilihan_2_id: val})} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ekskul Pilihan 3
                  </label>
                  <EkskulSelect 
                    value={editingStudent.pilihan_3_id} 
                    ekskuls={ekskuls} 
                    onChange={(val) => setEditingStudent({...editingStudent, pilihan_3_id: val})} 
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 btn btn-secondary py-2 text-xs font-bold"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 btn btn-primary py-2 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
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
  if (!name) return <span className="text-slate-300 text-[10px]">-</span>
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100'
  }
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border truncate inline-block max-w-[130px] ${colors[color]}`} title={name}>
      {name}
    </span>
  )
}

function EkskulSelect({ value, ekskuls, onChange }) {
  return (
    <select className="input-field text-xs py-1.5" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">-- Tidak ada --</option>
      {ekskuls.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
    </select>
  )
}
