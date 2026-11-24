import React, { useState } from 'react'
import { fmtInt } from '../lib/stats'

const W = 760
const PL = 62
const PR = 18
const PT = 16
const PB = 32

/**
 * Сгруппированная столбчатая диаграмма (абсолютные значения).
 * data: [{ year, [key]: number }]
 * series: [{ key, label, color }]
 */
export default function GroupedBars({ data, series, height = 300, digits = 0 }) {
  const [hover, setHover] = useState(null)
  const innerW = W - PL - PR
  const innerH = height - PT - PB
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] || 0)))
  const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i)
  const y = (v) => PT + innerH * (1 - v / max)
  const slot = innerW / data.length
  const barW = Math.min(26, (slot * 0.62) / series.length)

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="chart"
        style={{ width: '100%', height: 'auto' }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} className="gridline" />
            <text x={PL - 10} y={y(t) + 4} textAnchor="end" className="axis-label">
              {fmtInt(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const center = PL + slot * i + slot / 2
          const groupW = barW * series.length
          return (
            <g key={d.year}>
              {series.map((s, si) => {
                const value = d[s.key] || 0
                const bx = center - groupW / 2 + si * barW
                return (
                  <rect
                    key={s.key}
                    x={bx}
                    y={y(value)}
                    width={barW - 2}
                    height={Math.max(0, PT + innerH - y(value))}
                    fill={s.color}
                    opacity={hover === null || hover === i ? 0.95 : 0.45}
                    rx="2"
                  />
                )
              })}
              <rect
                x={PL + slot * i}
                y={PT}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              <text x={center} y={height - 10} textAnchor="middle" className="axis-label">
                {d.year}
              </text>
            </g>
          )
        })}
      </svg>

      {hover !== null && (
        <div
          className="tooltip"
          style={{
            left: `${Math.min(88, Math.max(12, ((PL + slot * hover + slot / 2) / W) * 100))}%`,
          }}
        >
          <div className="tooltip-title">{data[hover].year}</div>
          {series.map((s) => (
            <div key={s.key} className="tooltip-row">
              <span className="dot" style={{ background: s.color }} />
              <span>{s.label}</span>
              <b>{fmtInt(data[hover][s.key] || 0)}</b>
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
