import { createAuthClient } from "better-auth/react"
import { twoFactorClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  // Si la cuenta tiene verificación en dos pasos, después de la contraseña se pide el código en /verificar.
  plugins: [twoFactorClient()],
})

export const { signIn, signUp, signOut, useSession } = authClient
