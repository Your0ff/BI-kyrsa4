import React, { useState } from 'react'
import { classify, fmt, fmtInt, fmtSigned } from '../lib/stats'

const W = 760
const H = 430
const PL = 58
const PR = 20
const PT = 20
const PB = 52

const QUADRANTS = [
  { x: 0.25, y: 0.16, label: 'Естественный прирост\n+ миграционный приток', color: '#059669' },
  { x: 0.75, y: 0.16, label: 'Естественная убыль,\nкомпенсируемая мигрантами', color: '#2563eb' },
  { x: 0.25, y: 0.9, label: 'Естественный прирост\nпри оттоке', color: '#d97706' },
  { x: 0.75, y: 0.9, label: 'Двойная убыль', color: '#dc2626' },
]

/**
 * Матрица «естественный прирост × миграционный прирост».
 * points: [{ id, name, natRate, migRate, popLast }]
 */
export default function ScatterQuadrant({ points }) {
  const [active, setActive] = useState(null)
  const innerW = W - PL - PR
  const innerH = H - PT - PB

  const items = points.filter((p) => Number.isFinite(p.natRate) && Number.isFinite(p.migRate))
  if (!items.length) {
    return <p className="card-caption">Недостаточно данных для построения матрицы.</p>
  }

  const xs = items.map((p) => p.natRate)
  const ys = items.map((p) => p.migRate)
  const spanOf = (arr) => {
    const lo = Math.min(...arr, 0)
    const hi = Math.max(...arr, 0)
    const pad = (hi - lo) * 0.18 || 1
    return [lo - pad, hi + pad]
  }
  const [xMin, xMax] = spanOf(xs)
  const [yMin, yMax] = spanOf(ys)

  const cx = (v) => PL + ((v - xMin) / (xMax - xMin)) * innerW
  const cy = (v) => PT + innerH * (1 - (v - yMin) / (yMax - yMin))
  const radius = (pop) => 4 + Math.sqrt(Math.max(pop, 5)) * 0.52

  const xTicks = Array.from({ length: 5 }, (_, i) => xMin + ((xMax - xMin) / 4) * i)
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) / 4) * i)
  const labeled = [...items].sort((a, b) => (b.popLast || 0) - (a.popLast || 0)).slice(0, 6).map((p) => p.id)

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" style={{ width: '100%', height: 'auto' }}>
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={cx(t)} x2={cx(t)} y1={PT} y2={PT + innerH} className="gridline" />
            <text x={cx(t)} y={H - 28} textAnchor="middle" className="axis-label">
              {fmt(t, 1)}
            </text>
          </g>
        ))}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={PL} x2={W - PR} y1={cy(t)} y2={cy(t)} className="gridline" />
            <text x={PL - 10} y={cy(t) + 4} textAnchor="end" className="axis-label">
              {fmt(t, 1)}
            </text>
          </g>
        ))}

        <line x1={cx(0)} x2={cx(0)} y1={PT} y2={PT + innerH} className="zeroline" />
        <line x1={PL} x2={W - PR} y1={cy(0)} y2={cy(0)} className="zeroline" />

        {QUADRANTS.map((q) => (
          <text
            key={q.label}
            x={PL + innerW * q.x}
            y={PT + innerH * q.y}
            textAnchor="middle"
            className="quadrant-label"
            fill={q.color}
          >
            {q.label.split('\n').map((line, i) => (
              <tspan key={line} x={PL + innerW * q.x} dy={i === 0 ? 0 : 15}>
                {line}
              </tspan>
            ))}
          </text>
        ))}

        {items.map((p) => {
          const isActive = active === p.id
          return (
            <g key={p.id} onMouseEnter={() => setActive(p.id)} onMouseLeave={() => setActive(null)}>
              <circle
                cx={cx(p.natRate)}
                cy={cy(p.migRate)}
                r={radius(p.popLast)}
                fill={classify(p.natRate, p.migRate).color}
                opacity={isActive ? 0.95 : 0.62}
                stroke={isActive ? '#0f172a' : 'rgba(255,255,255,0.9)'}
                strokeWidth={isActive ? 1.6 : 1}
              />
              {(labeled.includes(p.id) || isActive) && (
                <text
                  x={cx(p.natRate)}
                  y={cy(p.migRate) - radius(p.popLast) - 5}
                  textAnchor="middle"
                  className="point-label"
                >
                  {p.name}
                </text>
              )}
            </g>
          )
        })}

        <text x={PL + innerW / 2} y={H - 6} textAnchor="middle" className="axis-title">
          Естественный прирост, % (среднее за период)
        </text>
        <text
          transform={`translate(14 ${PT + innerH / 2}) rotate(-90)`}
          textAnchor="middle"
          className="axis-title"
        >
          Миграционный прирост, %
        </text>
      </svg>

      {active !== null &&
        (() => {
          const p = items.find((item) => item.id === active)
          if (!p) return null
          return (
            <div
              className="tooltip"
              style={{
                left: `${Math.min(84, Math.max(14, (cx(p.natRate) / W) * 100))}%`,
                top: `${Math.max(0, (cy(p.migRate) / H) * 100 - 8)}%`,
              }}
            >
              <div className="tooltip-title">{p.name}</div>
              <div className="tooltip-row">
                <span>Естественный прирост</span>
                <b>{fmtSigned(p.natRate, 2)} %</b>
              </div>
              <div className="tooltip-row">
                <span>Миграционный прирост</span>
                <b>{fmtSigned(p.migRate, 2)} %</b>
              </div>
              <div className="tooltip-row">
                <span>Население</span>
                <b>{fmtInt(p.popLast * 1000)} чел.</b>
              </div>
              <div className="tooltip-row muted">{classify(p.natRate, p.migRate).label}</div>
            </div>
          )
        })()}

      <div className="legend">
        {[['Устойчивый рост', '#059669'], ['Миграционная компенсация', '#2563eb'], ['Отток', '#d97706'], ['Двойная убыль', '#dc2626']].map(
          ([label, color]) => (
            <span key={label} className="legend-item">
              <span className="legend-swatch" style={{ background: color }} />
              {label}
            </span>
          ),
        )}
        <span className="legend-note">размер круга — численность населения</span>
      </div>
    </div>
  )
}
