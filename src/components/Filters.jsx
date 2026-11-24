import React from 'react'

export default function Filters({
  towns,
  selectedTowns,
  onToggleTown,
  onSelectAllTowns,
  districts,
  selected,
  onToggle,
  onSelectAll,
  years,
  from,
  to,
  onFrom,
  onTo,
  shown,
  total,
  onReset,
}) {
  const visibleTowns = towns.filter((t) => selectedTowns.includes(t.id))
  const allChosen = visibleTowns.length === towns.length && towns.length > 0
  // по алфавиту — так город проще найти глазами
  const sortedTowns = [...towns].sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  return (
    <div className="filters">
      <div className="filter-group filter-towns">
        <label>
          <span>
            Моногорода: выбрано {visibleTowns.length} из {towns.length}
          </span>
          <button type="button" className="link-btn" onClick={onSelectAllTowns}>
            {allChosen ? 'снять все' : 'выбрать все'}
          </button>
        </label>
        <div className="town-list">
          {sortedTowns.map((t) => {
            const active = selectedTowns.includes(t.id)
            return (
              <label
                key={t.id}
                className={`town-check ${active ? 'active' : ''}`}
                title={`${t.region} · ${t.industry}`}
              >
                <span>{t.name}</span>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => onToggleTown(t.id)}
                />
              </label>
            )
          })}
          {towns.length === 0 && <span className="town-empty">Сначала выберите федеральные округа</span>}
        </div>
      </div>

      <div className="filters-row">
        <div className="filter-group">
          <label>Период наблюдения</label>
          <div className="period">
            <select value={from} onChange={(e) => onFrom(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y} disabled={y >= to}>
                  {y}
                </option>
              ))}
            </select>
            <span className="dash">—</span>
            <select value={to} onChange={(e) => onTo(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y} disabled={y <= from}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-group filter-districts">
          <label>
            Федеральные округа
            <button type="button" className="link-btn" onClick={onSelectAll}>
              {selected.length === districts.length ? 'снять все' : 'выбрать все'}
            </button>
          </label>
          <div className="chips">
            {districts.map((d) => {
              const active = selected.includes(d)
              return (
                <button
                  type="button"
                  key={d}
                  className={`chip ${active ? 'active' : ''}`}
                  onClick={() => onToggle(d)}
                  aria-pressed={active}
                >
                  {d.replace(' ФО', '')}
                </button>
              )
            })}
          </div>
        </div>

        <div className="filter-group filter-summary">
          <label>Выборка</label>
          <div className="summary">
            <b>{shown}</b> из {total} городов
            <button type="button" className="link-btn" onClick={onReset}>
              сбросить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}