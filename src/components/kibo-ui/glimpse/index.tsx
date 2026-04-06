"use client"

import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

/** Composable link preview (SPA): pass title/description/image as children; no server fetch. */
export type GlimpseProps = ComponentProps<typeof HoverCard>

export const Glimpse = ({ openDelay = 200, closeDelay = 100, ...props }: GlimpseProps) => (
  <HoverCard openDelay={openDelay} closeDelay={closeDelay} {...props} />
)

export type GlimpseTriggerProps = ComponentProps<typeof HoverCardTrigger>

export const GlimpseTrigger = (props: GlimpseTriggerProps) => <HoverCardTrigger {...props} />

export type GlimpseContentProps = ComponentProps<typeof HoverCardContent>

export const GlimpseContent = ({ className, ...props }: GlimpseContentProps) => (
  <HoverCardContent
    className={cn("w-80 max-w-[min(20rem,calc(100vw-2rem))] overflow-hidden p-0", className)}
    {...props}
  />
)

export type GlimpseTitleProps = ComponentProps<"p">

export const GlimpseTitle = ({ className, ...props }: GlimpseTitleProps) => (
  <p
    className={cn("px-3 pt-3 text-sm font-semibold leading-snug text-neutral-50", className)}
    {...props}
  />
)

export type GlimpseDescriptionProps = ComponentProps<"p">

export const GlimpseDescription = ({ className, ...props }: GlimpseDescriptionProps) => (
  <p
    className={cn(
      "line-clamp-3 px-3 pb-3 pt-1 text-xs leading-relaxed text-neutral-400",
      className
    )}
    {...props}
  />
)

export type GlimpseImageProps = ComponentProps<"img">

export const GlimpseImage = ({ className, alt = "", ...props }: GlimpseImageProps) => (
  <img
    className={cn("aspect-video w-full object-cover", className)}
    alt={alt}
    {...props}
  />
)
