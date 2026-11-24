import React, { useMemo, useState } from 'react'
import { classify, fmtNullable, fmtSigned } from '../lib/stats'

const isNum = (v) => Number.isFinite(v)
const safeNum = (v) => (isNum(v) ? v : 0)

const COLUMNS = [
  { key: 'name', label: 'Моногород' },
  { key: 'district', label: 'Федеральный округ' },
  { key: 'industry', label: 'Профиль' },
  { key: 'popLast', label: 'Население, тыс.' },
  { key: 'popChangePct', label: 'Изменение за период, %' },
  { key: 'natRate', label: 'Естеств. прирост, %' },
  { key: 'migRate', label: 'Миграц. прирост, %' },
  { key: 'status', label: 'Тип динамики' },
]

export default function DataTable({ rows, limit }) {
  const [sort, setSort] = useState({ key: 'popLast', dir: 'desc' })

  const sorted = useMemo(() => {
    const copy = rows.map((r) => ({ ...r, status: classify(r.natRate, r.migRate).label }))
    copy.sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      const res = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ru')
      return sort.dir === 'asc' ? res : -res
    })
    return limit ? copy.slice(0, limit) : copy
  }, [rows, sort, limit])

  const toggle = (key) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))
  }

  const arrow = (key) => (sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : '')

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => toggle(col.key)}
                className={sort.key === col.key ? 'sorted' : ''}
                title="Нажмите, чтобы отсортировать"
              >
                {col.label} <span className="sort-arrow">{arrow(col.key)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const status = classify(row.natRate, row.migRate)
            return (
              <tr key={row.id}>
                <td>
                  <div className="cell-strong">{row.name}</div>
                  <div className="cell-sub">
                    {row.region}
                    {row.sourceName && row.sourceName !== row.name ? ` · в источнике: ${row.sourceName}` : ''}
                  </div>
                </td>
                <td>{row.district}</td>
                <td>{row.industry}</td>
                <td className="num">{fmtNullable(row.popLast, 1)}</td>
                <td className={`num ${safeNum(row.popChangePct) < 0 ? 'neg' : 'pos'}`}>
                  {isNum(row.popChangePct) ? `${fmtSigned(row.popChangePct, 1)} %` : '—'}
                </td>
                <td className={`num ${safeNum(row.natRate) < 0 ? 'neg' : 'pos'}`}>
                  {fmtNullable(row.natRate, 2)}
                </td>
                <td className={`num ${safeNum(row.migRate) < 0 ? 'neg' : 'pos'}`}>
                  {fmtNullable(row.migRate, 2)}
                </td>
                <td>
                  <span className="badge" style={{ borderColor: status.color, color: status.color }}>
                    {status.short}
                  </span>
                </td>
              </tr>
            )
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="empty">
                Нет городов, удовлетворяющих фильтрам
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
