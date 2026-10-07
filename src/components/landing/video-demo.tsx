"use client"

import * as React from "react"
import { Pause, Play } from "lucide-react"

/**
 * Video corto de la app dentro de un celular. Se descarga y reproduce solo cuando aparece en pantalla
 * (sin sonido y en bucle, como en redes sociales); quien prefiere menos movimiento lo inicia con el botón.
 */
export function VideoDemo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = React.useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = React.useState(false)

  React.useEffect(() => {
    const video = ref.current
    if (!video) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => {})
        else video.pause()
      },
      { threshold: 0.35 },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  function toggle() {
    const video = ref.current
    if (!video) return
    if (video.paused) void video.play().catch(() => {})
    else video.pause()
  }

  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <div className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(circle,var(--accent),transparent_70%)]" />
      <div className="rounded-[2.6rem] bg-foreground p-2.5 shadow-2xl shadow-primary/20 ring-1 ring-foreground/10">
        <video
          ref={ref}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="none"
          aria-label={label}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onClick={toggle}
          className="aspect-[9/16] w-full cursor-pointer rounded-[2.1rem] bg-muted object-cover"
        />
      </div>
      <button
        type="button"
        onClick={toggle}
        className="absolute right-4 bottom-4 flex size-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md ring-1 ring-foreground/10 backdrop-blur transition hover:bg-background"
        aria-label={playing ? "Pausar video" : "Reproducir video"}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
      </button>
    </div>
  )
}
