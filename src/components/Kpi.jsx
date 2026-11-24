import React from 'react'
import Sparkline from './Sparkline'

export default function Kpi({ label, value, unit, hint, delta, deltaLabel, tone = 'neutral', spark, sparkColor = '#0d9488' }) {
  return (
    <article className={`kpi tone-${tone}`}>
      <header className="kpi-label">{label}</header>
      <div className="kpi-value">
        {value}
        {unit ? <span className="kpi-unit">{unit}</span> : null}
      </div>
      <div className="kpi-bottom">
        <div>
          {delta !== undefined && delta !== '' && (
            <div className={`kpi-delta tone-${tone}`}>
              {delta}
              {deltaLabel ? <span className="kpi-delta-label"> {deltaLabel}</span> : null}
            </div>
          )}
          {hint && <div className="kpi-hint">{hint}</div>}
        </div>
        {spark && <Sparkline values={spark} color={sparkColor} />}
      </div>
    </article>
  )
}
