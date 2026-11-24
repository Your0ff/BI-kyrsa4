import React from 'react'
import { fmt } from '../lib/stats'

/**
 * Рейтинг с двусторонними полосами (отрицательные — влево от нуля).
 * items: [{ id, name, value, hint? }]
 */
export default function RankBars({ items, digits = 1, unit = '%', positiveColor = '#059669', negativeColor = '#dc2626' }) {
  const max = Math.max(0.001, ...items.map((i) => Math.abs(i.value)))
  return (
    <div className="rank">
      {items.map((item) => {
        const width = (Math.abs(item.value) / max) * 50
        const positive = item.value >= 0
        return (
          <div className="rank-row" key={item.id} title={item.hint || `${item.name}: ${fmt(item.value, digits)} ${unit}`}>
            <span className="rank-name">{item.name}</span>
            <span className="rank-track">
              <span className="rank-axis" />
              <span
                className="rank-bar"
                style={{
                  width: `${width}%`,
                  [positive ? 'left' : 'right']: '50%',
                  background: positive ? positiveColor : negativeColor,
                }}
              />
            </span>
            <span className={`rank-value ${positive ? 'pos' : 'neg'}`}>
              {positive ? '+' : '−'}
              {fmt(Math.abs(item.value), digits)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
