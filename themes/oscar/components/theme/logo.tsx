"use client"

import Image, { type ImageProps } from "next/image"
import { useTheme } from "next-themes"
import { getThemeManifest } from "@/lib/theme/manifest"

type ThemeLogoProps = Omit<ImageProps, "src" | "alt"> & {
  alt?: string
  compact?: boolean
}

export function ThemeLogo({ alt, compact = false, onError, style, ...props }: ThemeLogoProps) {
  const { resolvedTheme } = useTheme()
  const theme = getThemeManifest()
  const slot = `logo${resolvedTheme === "dark" ? "Dark" : "Light"}${compact ? "48" : ""}`
  const src = `/rustfs/console/oscar-branding/${slot}/`
  const width = typeof props.width === "number" ? `${props.width}px` : props.width
  const height = typeof props.height === "number" ? `${props.height}px` : props.height

  return (
    <Image
      {...props}
      src={src}
      alt={alt ?? theme.brand.name}
      style={{ width, height, objectFit: "contain", ...style }}
      onError={onError}
    />
  )
}
