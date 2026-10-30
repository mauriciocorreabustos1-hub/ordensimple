"use client"

/** Dirección de avisos de este aparato (si los activó), para no avisarle a él mismo lo que hizo aquí. */
export async function thisPushDevice() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/")
    return (await reg?.pushManager.getSubscription())?.endpoint
  } catch {
    return undefined
  }
}
