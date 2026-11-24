import React, { useState } from 'react'
import { fmt } from '../lib/stats'

const W = 760
const PL = 54
const PR = 18
const PT = 18
const PB = 32

function niceTicks(min, max, count) {
  const span = max - min || 1
  const step = span / count
  return Array.from({ length: count + 1 }, (_, i) => min + step * i)
}

/**
 * Многорядный линейный график в SVG.
 * data: [{ year, [key]: number }]
 * series: [{ key, label, color, dashed? }]
 */
export default function LineChart({
  data,
  series,
  height = 320,
  yTickCount = 5,
  includeZero = true,
  digits = 1,
  unit = '',
  xLabelGap = 1,
}) {
  const [hover, setHover] = useState(null)
  const H = height
  const innerW = W - PL - PR
  const innerH = H - PT - PB

  const values = data.flatMap((d) => series.map((s) => d[s.key])).filter((v) => Number.isFinite(v))
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (includeZero) {
    min = Math.min(min, 0)
    max = Math.max(max, 0)
  }
  const pad = (max - min) * 0.12 || 1
  min -= pad
  max += pad

  const x = (i) => PL + (innerW * i) / Math.max(1, data.length - 1)
  const y = (v) => PT + innerH * (1 - (v - min) / (max - min || 1))
  const ticks = niceTicks(min, max, yTickCount)
  const zeroY = y(0)
  const showZero = 0 >= min && 0 <= max

  const handleMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    const svgX = ratio * W
    const idx = Math.round(((svgX - PL) / innerW) * (data.length - 1))
    const clamped = Math.min(data.length - 1, Math.max(0, idx))
    setHover(clamped)
  }

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart"
        style={{ width: '100%', height: 'auto' }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={`t${t}`}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} className="gridline" />
            <text x={PL - 10} y={y(t) + 4} textAnchor="end" className="axis-label">
              {fmt(t, digits)}
            </text>
          </g>
        ))}

        {showZero && <line x1={PL} x2={W - PR} y1={zeroY} y2={zeroY} className="zeroline" />}

        {data.map((d, i) =>
          i % xLabelGap === 0 ? (
            <text key={d.year} x={x(i)} y={H - 10} textAnchor="middle" className="axis-label">
              {d.year}
            </text>
          ) : null,
        )}

        {series.map((s) => {
          const points = data
            .map((d, i) => (Number.isFinite(d[s.key]) ? `${x(i)},${y(d[s.key])}` : null))
            .filter(Boolean)
            .join(' ')
          return (
            <g key={s.key}>
              <polyline
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth="2.4"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.dashed ? '6 5' : undefined}
                vectorEffect="non-scaling-stroke"
              />
              {data.map((d, i) =>
                Number.isFinite(d[s.key]) ? (
                  <circle key={`${s.key}${i}`} cx={x(i)} cy={y(d[s.key])} r="3" fill={s.color} />
                ) : null,
              )}
            </g>
          )
        })}

        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PT}
            y2={PT + innerH}
            className="hover-line"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {hover !== null && (
        <div
          className="tooltip"
          style={{
            left: `${Math.min(88, Math.max(12, ((x(hover) - PL) / innerW) * 100))}%`,
          }}
        >
          <div className="tooltip-title">{data[hover].year}</div>
          {series.map((s) => (
            <div key={s.key} className="tooltip-row">
              <span className="dot" style={{ background: s.color }} />
              <span>{s.label}</span>
              <b>
                {fmt(data[hover][s.key], digits)}
                {unit}
              </b>
            </div>
          ))}
        </div>
      )}

      <div className="legend">
        {series.map((s) => (
          <span key={s.key} className="legend-item">
            <span className="legend-swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
