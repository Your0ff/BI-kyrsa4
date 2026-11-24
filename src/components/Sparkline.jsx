import React from 'react'

export default function Sparkline({ values, color = '#0d9488', width = 120, height = 36 }) {
  if (!values || values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values.map((v, i) => {
    const x = (width / (values.length - 1)) * i
    const y = height - 3 - ((v - min) / span) * (height - 6)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const area = `0,${height} ${points.join(' ')} ${width},${height}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true">
      <polygon points={area} fill={color} opacity="0.14" />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
