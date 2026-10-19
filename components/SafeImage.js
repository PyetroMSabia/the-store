"use client";

import { useState } from "react";

const DEFAULT_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="none">` +
      `<rect width="400" height="400" fill="#121215"/>` +
      `<rect x="1" y="1" width="398" height="398" stroke="#25252b" stroke-width="2"/>` +
      `<circle cx="200" cy="180" r="44" fill="#1c1c22" stroke="#f2c14e" stroke-width="1.5" stroke-dasharray="4 4"/>` +
      `<path d="M190 180h20M200 170v20" stroke="#f2c14e" stroke-width="2" stroke-linecap="round"/>` +
      `<text x="200" y="250" text-anchor="middle" fill="#f2c14e" font-family="sans-serif" font-size="12" font-weight="700" letter-spacing="2">THE STORE</text>` +
      `<text x="200" y="270" text-anchor="middle" fill="#888892" font-family="sans-serif" font-size="11">Curadoria de Ofertas</text>` +
    `</svg>`
  );

export default function SafeImage({
  src,
  alt = "",
  className = "",
  style,
  fallbackSrc = DEFAULT_FALLBACK,
  loading = "lazy",
  ...props
}) {
  const [hasError, setHasError] = useState(false);
  const effectiveSrc = hasError || !src ? fallbackSrc : src;

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      className={className}
      style={{
        ...style,
        ...(hasError ? { filter: "saturate(0.9)" } : {}),
      }}
      loading={loading}
      onError={(e) => {
        e.currentTarget.onerror = null;
        setHasError(true);
      }}
      {...props}
    />
  );
}
