import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      profile: null,
      loading: true,
      
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),
      
      login: async (username, password) => {
        set({ loading: true })
        // Map simple username to email for Supabase Auth
        // admin uses @sipek.local, others use @sipek.com (since client-side signUp rejects .local)
        const email = username.toLowerCase() === 'admin'
          ? 'admin@sipek.local'
          : `${username.toLowerCase()}@sipek.com`
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        
        if (error) {
          set({ loading: false })
          throw error
        }
        
        // Fetch profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*, extracurriculars(id, name)')
          .eq('id', data.user.id)
          .single()
          
        if (profileError) {
          console.error('Error fetching profile:', profileError)
        }
        
        set({ user: data.user, profile, loading: false })
        return { user: data.user, profile }
      },
      
      logout: async () => {
        await supabase.auth.signOut()
        set({ user: null, profile: null })
      },
      
      refreshSession: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*, extracurriculars(id, name)')
            .eq('id', session.user.id)
            .single()
          set({ user: session.user, profile, loading: false })
        } else {
          set({ user: null, profile: null, loading: false })
        }
      }
    }),
    {
      name: 'auth-storage',
    }
  )
)
