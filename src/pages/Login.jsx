import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import logoUtama from '../assets/Logo_BPK_PENABURlogoutama.png'

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-black p-4 relative overflow-hidden">
      {/* Glow effects */}
      <div className="absolute w-96 h-96 rounded-full bg-primary-600/10 blur-3xl -top-20 -left-20" />
      <div className="absolute w-96 h-96 rounded-full bg-blue-500/10 blur-3xl -bottom-20 -right-20" />

      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl shadow-black/30 border border-slate-100/80 overflow-hidden relative z-10">
        <div className="pt-8 px-8 pb-4 text-center">
          <div className="flex items-center justify-center mb-4">
            <img 
              src={logoUtama} 
              alt="Logo BPK PENABUR" 
              className="h-16 object-contain drop-shadow-sm"
            />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">SIP-EK</h1>
          <p className="text-slate-500 text-xs mt-2 leading-relaxed">
            Selamat Datang di Sistem Informasi Penilaian Ekskur SMPK 4 PENABUR! Silahkan login untuk mengakses.
          </p>
        </div>

        <div className="px-8 pb-8">
          {error && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-red-600 text-xs">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Username</label>
              <input
                type="text"
                className="input-field py-2 text-sm"
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                className="input-field py-2 text-sm"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn btn-primary py-2.5 flex items-center justify-center gap-2 mt-2 text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Memproses...
                </>
              ) : (
                'Masuk ke Akun'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-50 text-center">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              &copy; 2026 Sistem Penilaian Ekstrakurikuler Sekolah.<br/>
              Modern, Ringan, dan Terintegrasi.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
