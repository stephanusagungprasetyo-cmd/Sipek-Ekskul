import { useState, useEffect, useCallback, useRef } from 'react'
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
  AlertCircle,
  Layers,
  Check
} from 'lucide-react'
import toast from 'react-hot-toast'

// Helper Bersihkan nama ekskul & deteksi placeholder kosong
const cleanEkskulName = (raw) => {
  if (!raw) return null
  const str = raw.toString().trim()
  if (!str) return null
  const lower = str.toLowerCase()
  if (['-', '--', '---', 'none', 'null', 'tidak ada', 'kosong', 'n/a', 'na', '.'].includes(lower)) {
    return null
  }
  return str
}

// Format nama ekskul ke Title Case rapi (misal: "paskibra" -> "Paskibra", "modern dance" -> "Modern Dance")
const formatTitleCase = (str) => {
  if (!str) return ''
  const trimmed = str.trim()
  if (trimmed.length <= 4 && trimmed === trimmed.toUpperCase()) {
    return trimmed
  }
  return trimmed
    .split(/\s+/)
    .map(word => {
      const upper = word.toUpperCase()
      if (['PMR', 'KIR', 'IT', 'OSIS', 'PASKIBRA'].includes(upper)) {
        return upper
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

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
  const [selectedEkskulFilter, setSelectedEkskulFilter] = useState('all')

  // Modal Kelola & Tambah Ekskul State
  const [showEkskulModal, setShowEkskulModal] = useState(false)
  const [newEkskulName, setNewEkskulName] = useState('')
  const [isSavingEkskul, setIsSavingEkskul] = useState(false)
  const [ekskulSearchTerm, setEkskulSearchTerm] = useState('')
  const [editingEkskulId, setEditingEkskulId] = useState(null)
  const [editingEkskulName, setEditingEkskulName] = useState('')
  const [isUpdatingEkskul, setIsUpdatingEkskul] = useState(false)

  // Ref untuk mengontrol proses import & debounce realtime
  const isImportingRef = useRef(false)
  const realtimeTimeoutRef = useRef(null)

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

  const fetchStudents = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
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

      // Filter Ekstrakurikuler jika dipilih spesifik
      if (selectedEkskulFilter !== 'all') {
        query = query.or(`wajib_id.eq.${selectedEkskulFilter},pilihan_1_id.eq.${selectedEkskulFilter},pilihan_2_id.eq.${selectedEkskulFilter},pilihan_3_id.eq.${selectedEkskulFilter}`)
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
      if (!isSilent) setLoading(false)
    }
  }, [selectedYear, selectedEkskulFilter, page, pageSize, debouncedSearch, sortConfig])

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
          // Jangan re-fetch jika proses import Excel sedang berlangsung
          if (isImportingRef.current) return

          // Debounce pembaruan agar jika banyak perubahan beruntun, hanya refresh 1 kali
          if (realtimeTimeoutRef.current) clearTimeout(realtimeTimeoutRef.current)
          realtimeTimeoutRef.current = setTimeout(() => {
            fetchStudents(true) // Silent mode: cegah kedipan halaman/spinner penuh
          }, 1000)
        }
      )
      .subscribe()

    return () => {
      if (realtimeTimeoutRef.current) clearTimeout(realtimeTimeoutRef.current)
      supabase.removeChannel(channel)
    }
  }, [fetchStudents])

  // Supabase Realtime Listener untuk tabel extracurriculars
  useEffect(() => {
    const channel = supabase
      .channel('ekskuls-master-data-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'extracurriculars' },
        () => {
          if (isImportingRef.current) return
          fetchEkskuls()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchEkskuls() {
    const { data } = await supabase.from('extracurriculars').select('*').order('name')
    setEkskuls(data || [])
  }

  // Kelola Ekstrakurikuler: Tambah Ekskul Baru Manual
  const handleCreateEkskul = async (e) => {
    e?.preventDefault()
    const cleaned = cleanEkskulName(newEkskulName)
    if (!cleaned) {
      toast.error('Masukkan nama ekstrakurikuler yang valid!')
      return
    }

    const formattedName = formatTitleCase(cleaned)
    const exists = ekskuls.some(ek => ek.name.toLowerCase() === formattedName.toLowerCase())
    if (exists) {
      toast.error(`Ekskul "${formattedName}" sudah terdaftar!`)
      return
    }

    setIsSavingEkskul(true)
    try {
      const { error } = await supabase
        .from('extracurriculars')
        .insert({ name: formattedName })

      if (error) throw error

      toast.success(`Ekskul "${formattedName}" berhasil ditambahkan!`)
      setNewEkskulName('')
      await fetchEkskuls()
    } catch (err) {
      console.error(err)
      toast.error('Gagal menambahkan ekskul: ' + err.message)
    } finally {
      setIsSavingEkskul(false)
    }
  }

  // Kelola Ekstrakurikuler: Edit Ekskul
  const handleStartEditEkskul = (ekskul) => {
    setEditingEkskulId(ekskul.id)
    setEditingEkskulName(ekskul.name)
  }

  const handleCancelEditEkskul = () => {
    setEditingEkskulId(null)
    setEditingEkskulName('')
  }

  const handleUpdateEkskul = async (id) => {
    const cleaned = cleanEkskulName(editingEkskulName)
    if (!cleaned) {
      toast.error('Masukkan nama ekskul yang valid!')
      return
    }

    const formattedName = formatTitleCase(cleaned)
    const duplicate = ekskuls.some(ek => ek.id !== id && ek.name.toLowerCase() === formattedName.toLowerCase())
    if (duplicate) {
      toast.error(`Ekskul "${formattedName}" sudah terdaftar!`)
      return
    }

    setIsUpdatingEkskul(true)
    try {
      const { error } = await supabase
        .from('extracurriculars')
        .update({ name: formattedName })
        .eq('id', id)

      if (error) throw error

      toast.success(`Ekskul berhasil diubah menjadi "${formattedName}"!`)
      setEditingEkskulId(null)
      setEditingEkskulName('')
      await fetchEkskuls()
      fetchStudents()
    } catch (err) {
      console.error(err)
      toast.error('Gagal mengubah nama ekskul: ' + err.message)
    } finally {
      setIsUpdatingEkskul(false)
    }
  }

  // Kelola Ekstrakurikuler: Hapus Ekskul
  const handleDeleteEkskul = async (ekskul) => {
    try {
      // Cek apakah ekskul ini sedang digunakan oleh siswa
      const { count: studentCount } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .or(`wajib_id.eq.${ekskul.id},pilihan_1_id.eq.${ekskul.id},pilihan_2_id.eq.${ekskul.id},pilihan_3_id.eq.${ekskul.id}`)

      let confirmMsg = `Hapus ekstrakurikuler "${ekskul.name}"?`
      if (studentCount && studentCount > 0) {
        confirmMsg = `PERINGATAN: Ekskul "${ekskul.name}" saat ini diikuti oleh ${studentCount} siswa!\n\nJika dihapus, pilihan ekskul pada ${studentCount} siswa tersebut akan menjadi kosong dan riwayat nilainya akan terhapus.\n\nApakah Anda yakin ingin tetap menghapusnya?`
      }

      if (!window.confirm(confirmMsg)) return

      const { error: delErr } = await supabase
        .from('extracurriculars')
        .delete()
        .eq('id', ekskul.id)

      if (delErr) throw delErr

      toast.success(`Ekskul "${ekskul.name}" berhasil dihapus!`)
      await fetchEkskuls()
      fetchStudents()
    } catch (err) {
      console.error(err)
      toast.error('Gagal menghapus ekskul: ' + err.message)
    }
  }

  const handleYearChange = (year) => {
    setSelectedYear(year)
    setImportTargetYear(year)
    setPage(1)
  }

  const handleEkskulFilterChange = (ekskulId) => {
    setSelectedEkskulFilter(ekskulId)
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

      // Filter Ekstrakurikuler jika dipilih spesifik
      if (selectedEkskulFilter !== 'all') {
        query = query.or(`wajib_id.eq.${selectedEkskulFilter},pilihan_1_id.eq.${selectedEkskulFilter},pilihan_2_id.eq.${selectedEkskulFilter},pilihan_3_id.eq.${selectedEkskulFilter}`)
      }

      const { data: allStudents, error } = await query

      if (error) throw error

      if (!allStudents || allStudents.length === 0) {
        toast.error(`Tidak ada data siswa untuk kriteria yang dipilih`, { id: 'exporting' })
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

      const activeEkskulObj = ekskuls.find(e => e.id === selectedEkskulFilter)
      const ekskulSuffix = activeEkskulObj ? `_${activeEkskulObj.name.replace(/\s+/g, '_')}` : ''

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

      XLSX.writeFile(workbook, `Data_Siswa_TA_${selectedYear.replace('/', '_')}${ekskulSuffix}.xlsx`)
      toast.success(`Data siswa T.A. ${selectedYear} (${allStudents.length} siswa) berhasil diekspor!`, { id: 'exporting' })
    } catch (err) {
      console.error(err)
      toast.error('Gagal mengekspor data: ' + err.message, { id: 'exporting' })
    }
  }

  // Import File Excel (Ultra Fast True Bulk Import dengan Mute Realtime)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setIsUploading(true)
    isImportingRef.current = true // KUNCI: Mute Realtime Listener selama import berlangsung!

    const reader = new FileReader()

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws)

        if (data.length === 0) throw new Error('File Excel kosong atau format tidak sesuai')

        toast.loading(`Mempersiapkan import ${data.length} baris data...`, { id: 'uploading' })

        // 1. Cek kapabilitas tabel scores (kolom semester) sekali saja
        let hasSemesterCol = false
        try {
          const { error: testErr } = await supabase.from('scores').select('semester').limit(1)
          hasSemesterCol = !testErr
        } catch (e) {
          hasSemesterCol = false
        }

        // 2. Pre-fetch seluruh master ekstrakurikuler
        const { data: currentEkskuls } = await supabase.from('extracurriculars').select('id, name')
        const ekskulMap = {}
        ;(currentEkskuls || ekskuls).forEach(ek => {
          ekskulMap[ek.name.toLowerCase().trim()] = ek.id
        })

        // 3. Pre-create Ekskul Baru yang belum ada secara kolektif
        const newlyCreatedEkskuls = []
        const newEkskulNamesToCreate = new Set()

        data.forEach(row => {
          ;['Ekskul Wajib', 'Ekskul Pilihan 1', 'Ekskul', 'Ekskul Pilihan 2', 'Ekskul Pilihan 3'].forEach(col => {
            const cleaned = cleanEkskulName(row[col])
            if (cleaned) {
              const formatted = formatTitleCase(cleaned)
              if (!ekskulMap[formatted.toLowerCase()]) {
                newEkskulNamesToCreate.add(formatted)
              }
            }
          })
        })

        if (newEkskulNamesToCreate.size > 0) {
          const insertList = Array.from(newEkskulNamesToCreate).map(name => ({ name }))
          const { data: createdEkskuls } = await supabase
            .from('extracurriculars')
            .insert(insertList)
            .select('id, name')

          if (createdEkskuls) {
            createdEkskuls.forEach(ek => {
              ekskulMap[ek.name.toLowerCase().trim()] = ek.id
              newlyCreatedEkskuls.push(ek.name)
            })
          } else {
            const { data: refetch } = await supabase.from('extracurriculars').select('id, name')
            refetch?.forEach(ek => {
              ekskulMap[ek.name.toLowerCase().trim()] = ek.id
            })
          }
        }

        const findEkskulId = (name) => {
          if (!name) return null
          const cleaned = cleanEkskulName(name)
          if (!cleaned) return null
          return ekskulMap[cleaned.toLowerCase()] || ekskulMap[formatTitleCase(cleaned).toLowerCase()] || null
        }

        // 4. Pre-fetch seluruh siswa yang sudah ada pada tahun ajaran target (1 query cepat)
        let studentsPreQuery = supabase
          .from('students')
          .select('id, name, class_name, academic_year, wajib_id, pilihan_1_id, pilihan_2_id, pilihan_3_id')
          .limit(10000)

        if (importTargetYear === '2025/2026') {
          studentsPreQuery = studentsPreQuery.or('academic_year.eq.2025/2026,academic_year.is.null')
        } else {
          studentsPreQuery = studentsPreQuery.eq('academic_year', importTargetYear)
        }

        const { data: existingStudentsList } = await studentsPreQuery
        const studentMap = new Map()
        existingStudentsList?.forEach(s => {
          const nameKey = s.name.trim().toLowerCase()
          const classKey = (s.class_name || '').trim().toLowerCase()
          studentMap.set(`${nameKey}__${classKey}`, s)
          if (!studentMap.has(nameKey)) {
            studentMap.set(nameKey, s)
          }
        })

        // 5. Klasifikasikan baris Excel menjadi toUpdate dan toInsert
        const studentsToUpdate = []
        const studentsToInsert = []
        const studentActiveEkskuls = []
        const seenInFile = new Set()

        data.forEach(row => {
          const name = (row['Nama Lengkap Siswa'] || row['Nama Siswa'] || row['Nama'] || '').toString().trim()
          if (!name) return

          const genderRaw = (row['JK'] || row['Jenis Kelamin'] || '').toString().trim().toUpperCase()
          const gender = genderRaw.startsWith('P') ? 'P' : 'L'
          const className = (row['Kelas'] || '').toString().trim()
          const rowYear = (row['Tahun Ajaran'] || importTargetYear || selectedYear).toString().trim()

          const fileKey = `${name.toLowerCase()}__${className.toLowerCase()}`
          if (seenInFile.has(fileKey)) return
          seenInFile.add(fileKey)

          const wajibId = findEkskulId(row['Ekskul Wajib'])
          const pil1Id = findEkskulId(row['Ekskul Pilihan 1'] || row['Ekskul'])
          const pil2Id = findEkskulId(row['Ekskul Pilihan 2'])
          const pil3Id = findEkskulId(row['Ekskul Pilihan 3'])

          const activeEkskulIds = [wajibId, pil1Id, pil2Id, pil3Id].filter(Boolean)

          const nameKey = name.toLowerCase()
          const classKey = className.toLowerCase()
          const exist = studentMap.get(`${nameKey}__${classKey}`) || studentMap.get(nameKey)

          if (exist) {
            studentsToUpdate.push({
              id: exist.id,
              name,
              gender,
              class_name: className || exist.class_name,
              academic_year: rowYear,
              wajib_id: wajibId || null,
              pilihan_1_id: pil1Id || null,
              pilihan_2_id: pil2Id || null,
              pilihan_3_id: pil3Id || null
            })
            studentActiveEkskuls.push({
              studentId: exist.id,
              activeEkskulIds,
              exist
            })
          } else {
            studentsToInsert.push({
              studentData: {
                name,
                gender,
                class_name: className || '-',
                academic_year: rowYear,
                wajib_id: wajibId || null,
                pilihan_1_id: pil1Id || null,
                pilihan_2_id: pil2Id || null,
                pilihan_3_id: pil3Id || null
              },
              activeEkskulIds
            })
          }
        })

        const totalToProcess = studentsToUpdate.length + studentsToInsert.length
        toast.loading(`Memproses sinkronisasi ${totalToProcess} siswa...`, { id: 'uploading' })

        // 6. True Bulk Upsert Siswa yang sudah ada (Batch 100 per query)
        const BATCH_SIZE = 100
        for (let i = 0; i < studentsToUpdate.length; i += BATCH_SIZE) {
          const batch = studentsToUpdate.slice(i, i + BATCH_SIZE)
          const { error } = await supabase.from('students').upsert(batch, { onConflict: 'id' })
          if (error) throw error

          const processed = Math.min(i + BATCH_SIZE, studentsToUpdate.length)
          const pct = Math.round((processed / totalToProcess) * 40)
          toast.loading(`Memperbarui data siswa (${pct}%)...`, { id: 'uploading' })
        }

        // 7. True Bulk Insert Siswa Baru (Batch 100 per query)
        for (let i = 0; i < studentsToInsert.length; i += BATCH_SIZE) {
          const batch = studentsToInsert.slice(i, i + BATCH_SIZE)
          const insertPayloads = batch.map(b => b.studentData)
          const { data: createdList, error } = await supabase
            .from('students')
            .insert(insertPayloads)
            .select('id, name, class_name')

          if (error) throw error

          createdList?.forEach((s, idx) => {
            const item = batch[idx]
            studentActiveEkskuls.push({
              studentId: s.id,
              activeEkskulIds: item.activeEkskulIds,
              exist: null
            })
          })

          const processed = studentsToUpdate.length + Math.min(i + BATCH_SIZE, studentsToInsert.length)
          const pct = Math.round((processed / totalToProcess) * 40)
          toast.loading(`Menyimpan data siswa baru (${pct}%)...`, { id: 'uploading' })
        }

        // 8. Kumpulkan seluruh record scores
        const allScoreRows = []
        const droppedScoreDeletions = []

        studentActiveEkskuls.forEach(({ studentId, activeEkskulIds, exist }) => {
          if (!studentId) return

          // Cek jika siswa melepas ekskul lama
          if (exist) {
            const oldEkskuls = [exist.wajib_id, exist.pilihan_1_id, exist.pilihan_2_id, exist.pilihan_3_id].filter(Boolean)
            const dropped = oldEkskuls.filter(eid => !activeEkskulIds.includes(eid))
            if (dropped.length > 0) {
              droppedScoreDeletions.push({ studentId, droppedIds: dropped })
            }
          }

          activeEkskulIds.forEach(eid => {
            allScoreRows.push(
              hasSemesterCol
                ? { student_id: studentId, extracurricular_id: eid, semester: 1 }
                : { student_id: studentId, extracurricular_id: eid }
            )
          })
        })

        // Cegah duplikat key scores dalam 1 batch
        const uniqueScoresMap = new Map()
        allScoreRows.forEach(row => {
          const key = hasSemesterCol
            ? `${row.student_id}_${row.extracurricular_id}_${row.semester}`
            : `${row.student_id}_${row.extracurricular_id}`
          if (!uniqueScoresMap.has(key)) {
            uniqueScoresMap.set(key, row)
          }
        })
        const uniqueScoreRows = Array.from(uniqueScoresMap.values())

        // 9. True Bulk Upsert Scores (Batch 200 per query)
        const SCORE_CHUNK = 200
        for (let i = 0; i < uniqueScoreRows.length; i += SCORE_CHUNK) {
          const chunk = uniqueScoreRows.slice(i, i + SCORE_CHUNK)
          const { error } = await supabase.from('scores').upsert(chunk, {
            onConflict: hasSemesterCol ? 'student_id,extracurricular_id,semester' : 'student_id,extracurricular_id',
            ignoreDuplicates: true
          })
          if (error) {
            console.warn('Batch score upsert warning:', error.message)
          }
          const pct = 40 + Math.round(((i + chunk.length) / uniqueScoreRows.length) * 55)
          toast.loading(`Sinkronisasi nilai ekskul (${pct}%)...`, { id: 'uploading' })
        }

        // 10. Bersihkan scores ekskul yang dilepas siswa
        if (droppedScoreDeletions.length > 0) {
          await Promise.all(droppedScoreDeletions.map(d =>
            supabase.from('scores').delete().eq('student_id', d.studentId).in('extracurricular_id', d.droppedIds)
          ))
        }

        // 11. Selesai
        if (newlyCreatedEkskuls.length > 0) {
          toast.success(
            `Ekskul baru otomatis dibuat (${newlyCreatedEkskuls.length}): ${newlyCreatedEkskuls.join(', ')}`,
            { duration: 6000 }
          )
          await fetchEkskuls()
        }

        toast.success(`Berhasil mengimpor ${totalToProcess} data siswa!`, { id: 'uploading' })
        setShowImportModal(false)

        if (selectedYear !== importTargetYear) {
          setSelectedYear(importTargetYear)
          setPage(1)
        } else {
          setPage(1)
          await fetchStudents()
        }
      } catch (err) {
        console.error(err)
        toast.error('Gagal import: ' + err.message, { id: 'uploading' })
      } finally {
        isImportingRef.current = false
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
      pilihan_3_id: '',
      sem2_pilihan_1_id: '',
      sem2_pilihan_2_id: '',
      sem2_pilihan_3_id: ''
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
      sem2_pilihan_1_id: student.sem2_pilihan_1_id || '',
      sem2_pilihan_2_id: student.sem2_pilihan_2_id || '',
      sem2_pilihan_3_id: student.sem2_pilihan_3_id || '',
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
        pilihan_3_id: editingStudent.pilihan_3_id || null,
        sem2_pilihan_1_id: editingStudent.sem2_pilihan_1_id || null,
        sem2_pilihan_2_id: editingStudent.sem2_pilihan_2_id || null,
        sem2_pilihan_3_id: editingStudent.sem2_pilihan_3_id || null
      }

      let studentId = editingStudent.id

      if (isNewStudent) {
        let { data: created, error } = await supabase.from('students').insert(payload).select('id').single()
        if (error && error.message && error.message.includes('sem2_pilihan')) {
          // Fallback jika kolom sem2_pilihan belum dijalankan di Supabase
          const fallbackPayload = { ...payload }
          delete fallbackPayload.sem2_pilihan_1_id
          delete fallbackPayload.sem2_pilihan_2_id
          delete fallbackPayload.sem2_pilihan_3_id
          const res = await supabase.from('students').insert(fallbackPayload).select('id').single()
          created = res.data
          error = res.error
        }
        if (error) throw error
        studentId = created.id
        toast.success('Siswa baru berhasil ditambahkan!')
      } else {
        let { error } = await supabase.from('students').update(payload).eq('id', studentId)
        if (error && error.message && error.message.includes('sem2_pilihan')) {
          const fallbackPayload = { ...payload }
          delete fallbackPayload.sem2_pilihan_1_id
          delete fallbackPayload.sem2_pilihan_2_id
          delete fallbackPayload.sem2_pilihan_3_id
          const res = await supabase.from('students').update(fallbackPayload).eq('id', studentId)
          error = res.error
        }
        if (error) throw error
        toast.success('Data siswa berhasil diperbarui!')
      }

      // Sinkronisasi record scores untuk Semester 1
      const selectedEkskulsSem1 = [
        payload.wajib_id,
        payload.pilihan_1_id,
        payload.pilihan_2_id,
        payload.pilihan_3_id
      ].filter(Boolean)

      // Sinkronisasi record scores untuk Semester 2 (Mendukung Opsi B: Boleh Ganti Ekskul di Sem 2)
      const selectedEkskulsSem2 = [
        payload.wajib_id,
        payload.sem2_pilihan_1_id || payload.pilihan_1_id,
        payload.sem2_pilihan_2_id || payload.pilihan_2_id,
        payload.sem2_pilihan_3_id || payload.pilihan_3_id
      ].filter(Boolean)

      // 1. Bersihkan nilai ekskul lama yang sudah tidak lagi dipilih siswa
      if (!isNewStudent) {
        if (selectedEkskulsSem1.length > 0) {
          try {
            await supabase.from('scores')
              .delete()
              .eq('student_id', studentId)
              .eq('semester', 1)
              .not('extracurricular_id', 'in', `(${selectedEkskulsSem1.join(',')})`)
          } catch (e) {
            await supabase.from('scores')
              .delete()
              .eq('student_id', studentId)
              .not('extracurricular_id', 'in', `(${selectedEkskulsSem1.join(',')})`)
          }
        }
        if (selectedEkskulsSem2.length > 0) {
          try {
            await supabase.from('scores')
              .delete()
              .eq('student_id', studentId)
              .eq('semester', 2)
              .not('extracurricular_id', 'in', `(${selectedEkskulsSem2.join(',')})`)
          } catch (e) {}
        }
      }

      // 2. Upsert record nilai untuk Semester 1
      for (const eid of selectedEkskulsSem1) {
        const { error: upsertSemErr } = await supabase.from('scores').upsert({
          student_id: studentId,
          extracurricular_id: eid,
          semester: 1
        }, { onConflict: 'student_id,extracurricular_id,semester', ignoreDuplicates: true })

        if (upsertSemErr) {
          await supabase.from('scores').upsert({
            student_id: studentId,
            extracurricular_id: eid
          }, { onConflict: 'student_id,extracurricular_id', ignoreDuplicates: true })
        }
      }

      // 3. Upsert record nilai untuk Semester 2 (jika skema semester sudah aktif)
      for (const eid of selectedEkskulsSem2) {
        await supabase.from('scores').upsert({
          student_id: studentId,
          extracurricular_id: eid,
          semester: 2
        }, { onConflict: 'student_id,extracurricular_id,semester', ignoreDuplicates: true })
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

  const filteredEkskuls = ekskuls.filter(ek => 
    ek.name.toLowerCase().includes(ekskulSearchTerm.toLowerCase().trim())
  )

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
            onClick={() => {
              setEkskulSearchTerm('')
              setNewEkskulName('')
              setEditingEkskulId(null)
              setShowEkskulModal(true)
            }}
            className="btn bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 text-xs font-bold py-2 px-3"
            title="Kelola & Tambah Ekstrakurikuler"
          >
            <Layers size={14} />
            <span>Kelola Ekskul</span>
            <span className="ml-0.5 bg-indigo-800/60 text-indigo-100 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {ekskuls.length}
            </span>
          </button>

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

      {/* Control Bar: Tahun Ajaran Dropdown, Filter Ekskul, Search & PageSize */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Dropdowns Group: Tahun Ajaran & Filter Ekskul */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tahun Ajaran Dropdown (Revisi Poin 1) */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Calendar size={14} className="text-primary-600" />
              T.A:
            </label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="input-field py-1.5 px-3 text-xs font-bold text-slate-800 bg-slate-50 w-auto min-w-[125px]"
            >
              <option value="2026/2027">2026/2027</option>
              <option value="2025/2026">2025/2026</option>
              <option value="2027/2028">2027/2028</option>
            </select>
          </div>

          {/* Filter Ekskul Dropdown */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Layers size={14} className="text-primary-600" />
              Ekskul:
            </label>
            <select
              value={selectedEkskulFilter}
              onChange={(e) => handleEkskulFilterChange(e.target.value)}
              className="input-field py-1.5 px-3 text-xs font-bold text-slate-800 bg-slate-50 w-auto min-w-[160px] max-w-[220px] truncate"
            >
              <option value="all">Semua Ekskul ({ekskuls.length})</option>
              {ekskuls.map(ek => (
                <option key={ek.id} value={ek.id}>
                  {ek.name}
                </option>
              ))}
            </select>
          </div>
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
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden relative min-h-[300px]">
        {loading && students.length === 0 ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-primary-600" size={28} />
            <p className="text-xs font-medium">Memuat data siswa Tahun Ajaran {selectedYear}...</p>
          </div>
        ) : (
          <>
            {loading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[0.5px] z-10 flex items-center justify-center transition-all">
                <div className="bg-white/95 shadow-lg border border-slate-200 rounded-full px-4 py-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <Loader2 className="animate-spin text-primary-600" size={14} />
                  <span>Memperbarui data...</span>
                </div>
              </div>
            )}
            {students.length > 0 ? (
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
      </>
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
                  <option value="2026/2027">2026/2027</option>
                  <option value="2025/2026">2025/2026</option>
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

                {/* Opsi B: Pilihan Ekskul Semester 2 (Jika Siswa Pindah Ekskul) */}
                <div className="md:col-span-2 pt-2 border-t border-slate-100">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-800">
                        Pilihan Ekskul Semester 2 (Opsional - Jika Siswa Ganti Ekskul)
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
                        Opsi B
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2.5">
                      Kosongkan jika siswa tetap mengikuti ekskul pilihan yang sama seperti Semester 1.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Pilihan 1 (Sem. 2)</label>
                        <EkskulSelect 
                          value={editingStudent.sem2_pilihan_1_id} 
                          ekskuls={ekskuls} 
                          onChange={(val) => setEditingStudent({...editingStudent, sem2_pilihan_1_id: val})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Pilihan 2 (Sem. 2)</label>
                        <EkskulSelect 
                          value={editingStudent.sem2_pilihan_2_id} 
                          ekskuls={ekskuls} 
                          onChange={(val) => setEditingStudent({...editingStudent, sem2_pilihan_2_id: val})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Pilihan 3 (Sem. 2)</label>
                        <EkskulSelect 
                          value={editingStudent.sem2_pilihan_3_id} 
                          ekskuls={ekskuls} 
                          onChange={(val) => setEditingStudent({...editingStudent, sem2_pilihan_3_id: val})} 
                        />
                      </div>
                    </div>
                  </div>
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

      {/* Modal Kelola & Tambah Ekskul */}
      {showEkskulModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Kelola Ekstrakurikuler</h3>
                  <p className="text-[11px] text-slate-400">Master Ekskul Terdaftar untuk Semua Role</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEkskulModal(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Form Tambah Ekskul Baru */}
              <form onSubmit={handleCreateEkskul} className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-3.5 space-y-2">
                <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wider">
                  + Tambah Ekskul Baru
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newEkskulName}
                    onChange={(e) => setNewEkskulName(e.target.value)}
                    placeholder="Contoh: Panahan, Robotika, Manga..."
                    className="input-field text-xs py-1.5 flex-1 bg-white"
                  />
                  <button
                    type="submit"
                    disabled={isSavingEkskul || !newEkskulName.trim()}
                    className="btn bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-1.5 px-3 shrink-0 flex items-center gap-1 disabled:opacity-50"
                  >
                    {isSavingEkskul ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    <span>Tambah</span>
                  </button>
                </div>
                <p className="text-[10px] text-indigo-600/80">
                  Ekskul yang ditambahkan di sini langsung muncul di dropdown input nilai Pelatih, Koordinator, Pendamping, dan Admin.
                </p>
              </form>

              {/* Search & List Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Daftar Ekskul ({ekskuls.length})
                  </span>
                  <div className="relative w-44">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                    <input
                      type="text"
                      placeholder="Cari ekskul..."
                      value={ekskulSearchTerm}
                      onChange={(e) => setEkskulSearchTerm(e.target.value)}
                      className="input-field pl-7 py-1 text-xs"
                    />
                  </div>
                </div>

                {/* Ekskuls List */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {filteredEkskuls.length > 0 ? (
                    filteredEkskuls.map((ek, idx) => (
                      <div
                        key={ek.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-all text-xs"
                      >
                        {editingEkskulId === ek.id ? (
                          <div className="flex items-center gap-1.5 flex-1 mr-2">
                            <input
                              type="text"
                              value={editingEkskulName}
                              onChange={(e) => setEditingEkskulName(e.target.value)}
                              className="input-field text-xs py-1 flex-1 bg-white"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateEkskul(ek.id)
                                if (e.key === 'Escape') handleCancelEditEkskul()
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateEkskul(ek.id)}
                              disabled={isUpdatingEkskul}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                              title="Simpan"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditEkskul}
                              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
                              title="Batal"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="w-5 text-center text-slate-400 font-semibold text-[11px]">
                                {idx + 1}.
                              </span>
                              <span className="font-bold text-slate-800">{ek.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditEkskul(ek)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                title="Edit Nama Ekskul"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEkskul(ek)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                title="Hapus Ekskul"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      Tidak ada ekstrakurikuler yang sesuai dengan pencarian.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowEkskulModal(false)}
                className="btn btn-secondary text-xs font-bold py-1.5 px-4"
              >
                Tutup
              </button>
            </div>
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
