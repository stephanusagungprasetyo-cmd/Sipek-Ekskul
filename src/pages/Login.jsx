import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { School, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login(username, password)
      toast.success('Login Berhasil!')
      navigate('/')
    } catch (err) {
      console.error(err)
      setError('Username atau password salah. Silakan coba lagi.')
      toast.error('Login Gagal')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="p-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-50 text-primary-600 rounded-2xl mb-6">
            <School size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Selamat Datang</h1>
          <p className="text-slate-400 mt-2">Silakan login untuk mengakses sistem SIPEK</p>
        </div>

        <div className="px-10 pb-10">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Username</label>
              <input
                type="text"
                className="input-field"
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn btn-primary py-3.5 flex items-center justify-center gap-2 mt-4"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Memproses...
                </>
              ) : (
                'Masuk ke Akun'
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-50 text-center">
            <p className="text-xs text-slate-400 leading-relaxed">
              &copy; 2026 Sistem Penilaian Ekstrakurikuler Sekolah.<br/>
              Modern, Ringan, dan Terintegrasi.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
