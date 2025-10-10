import { ref, computed } from 'vue'

const TOKEN_KEY = 'rag_auth_token'
const USER_KEY = 'rag_auth_user'

// 全局状态
const isAuthenticated = ref(!!localStorage.getItem(TOKEN_KEY))
const currentUser = ref(localStorage.getItem(USER_KEY) || null)

export function useAuth() {
  const login = (username) => {
    const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, username)
    isAuthenticated.value = true
    currentUser.value = username
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    isAuthenticated.value = false
    currentUser.value = null
  }

  const checkAuth = () => {
    return !!localStorage.getItem(TOKEN_KEY)
  }

  return {
    isAuthenticated: computed(() => isAuthenticated.value),
    currentUser: computed(() => currentUser.value),
    login,
    logout,
    checkAuth
  }
}
