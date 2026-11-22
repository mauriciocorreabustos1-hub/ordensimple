"use client"

import * as React from "react"
import { Play } from "lucide-react"
import { videoEmbedUrl } from "@/lib/links"

/**
 * Video de YouTube o Vimeo que se carga recién al tocarlo: la página abre rápido y el reproductor de otro sitio
 * no entra (ni deja cookies) hasta que la persona quiere verlo. Nunca se reproduce solo.
 */
export function LinkVideo({ id, video, title }: { id: string; video: { provider: "youtube" | "vimeo"; id: string }; title: string }) {
  const [playing, setPlaying] = React.useState(false)
  return (
    <figure className="space-y-2">
      <div className="relative aspect-video overflow-hidden rounded-[var(--lk-card-radius)] bg-black [box-shadow:var(--lk-shadow)]">
        {playing ? (
          <iframe
            src={videoEmbedUrl(video)}
            title={title || "Video"}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full"
          />
        ) : (
          <button
            type="button"
            data-lk={id}
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,rgb(255_255_255/0.08),transparent_70%)] text-white"
            aria-label={`Ver el video${title ? `: ${title}` : ""}`}
          >
            <span className="grid size-16 place-items-center rounded-full bg-[var(--lk-accent)] text-[var(--lk-accent-text)] shadow-lg transition-transform group-hover:scale-105 motion-reduce:transition-none">
              <Play aria-hidden className="ml-1 size-7 fill-current" />
            </span>
            <span className="absolute bottom-3 left-4 font-sans text-xs opacity-75">{video.provider === "youtube" ? "YouTube" : "Vimeo"}</span>
          </button>
        )}
      </div>
      {title ? <figcaption className="text-center text-[0.88em] opacity-80">{title}</figcaption> : null}
    </figure>
  )
}
