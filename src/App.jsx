import React, { useMemo, useState } from 'react'
import { COVERAGE, DATA_META, DATA_READY, DATA_SOURCE, DISTRICTS, HAS_FLOWS, YEARS, towns } from './data/towns'
import {
  aggregateByYear,
  classify,
  fmt,
  fmtInt,
  fmtNullable,
  fmtSigned,
  populationIndex,
  townSummary,
  toCsv,
} from './lib/stats'
import DataSetup from './components/DataSetup'
import Filters from './components/Filters'
import Kpi from './components/Kpi'
import LineChart from './components/LineChart'
import GroupedBars from './components/GroupedBars'
import RankBars from './components/RankBars'
import ScatterQuadrant from './components/ScatterQuadrant'
import DataTable from './components/DataTable'

const TABS = [
  { id: 'overview', label: 'Обзор' },
  { id: 'natural', label: 'Естественное движение' },
  { id: 'migration', label: 'Миграция' },
  { id: 'compare', label: 'Сравнение городов' },
  { id: 'data', label: 'Данные' },
]

const PALETTE = ['#0d9488', '#2563eb', '#db2777', '#d97706', '#7c3aed', '#059669', '#e11d48', '#0369a1']

const isNum = (v) => Number.isFinite(v)
const avg = (list) => {
  const values = list.filter(isNum)
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
}
const sum = (list) => list.filter(isNum).reduce((a, b) => a + b, 0)

const safe = (v) => (isNum(v) ? v : 0)

export default function App() {
  const [tab, setTab] = useState('overview')
  const [selectedTownIds, setSelectedTownIds] = useState(() => towns.map((t) => t.id))
  const [selectedDistricts, setSelectedDistricts] = useState(DISTRICTS)
  const [from, setFrom] = useState(YEARS[0] ?? 2010)
  const [to, setTo] = useState(YEARS[YEARS.length - 1] ?? 2023)
  const [compareIds, setCompareIds] = useState(() =>
    [...towns]
      .sort((a, b) => (b.series[0]?.population || 0) - (a.series[0]?.population || 0))
      .slice(0, 5)
      .map((t) => t.id),
  )

  // города выбранных округов — их и показываем в списке чекбоксов
  const townsInDistricts = useMemo(
    () => towns.filter((t) => selectedDistricts.includes(t.district)),
    [selectedDistricts],
  )

  const filteredTowns = useMemo(
    () => townsInDistricts.filter((t) => selectedTownIds.includes(t.id)),
    [townsInDistricts, selectedTownIds],
  )

  const summaries = useMemo(
    () => filteredTowns.map((t) => townSummary(t, from, to)),
    [filteredTowns, from, to],
  )
  const byYear = useMemo(() => aggregateByYear(filteredTowns, from, to), [filteredTowns, from, to])

  const kpi = useMemo(() => {
    if (!byYear.length || !summaries.length) return null
    const first = byYear[0]
    const last = byYear[byYear.length - 1]
    const natTotal = sum(byYear.map((y) => y.natGrowth))
    const migTotal = sum(byYear.map((y) => y.migGrowth))
    const avgNat = avg(summaries.map((t) => t.natRate))
    const avgMig = avg(summaries.map((t) => t.migRate))
    const doubleDecline = summaries.filter((t) => classify(t.natRate, t.migRate).short === 'Убыль').length
    const outflow = summaries.filter((t) => safe(t.migRate) < 0).length
    const population = last.population
    const popChangePct = first.population > 0 ? ((last.population - first.population) / first.population) * 100 : 0
    return {
      population,
      popChangePct,
      natTotal,
      migTotal,
      avgNat,
      avgMig,
      doubleDecline,
      outflow,
      count: summaries.length,
      doubleDeclineShare: (doubleDecline / summaries.length) * 100,
      outflowShare: (outflow / summaries.length) * 100,
    }
  }, [byYear, summaries])

  const rateSeries = [
    { key: 'natRate', label: 'Естественный прирост', color: '#0d9488' },
    { key: 'migRate', label: 'Миграционный прирост', color: '#2563eb' },
  ]

  const byRateDesc = (key) => (a, b) => safe(b[key]) - safe(a[key])

  const sortedByNat = useMemo(() => [...summaries].sort(byRateDesc('natRate')), [summaries])
  const sortedByMig = useMemo(() => [...summaries].sort(byRateDesc('migRate')), [summaries])

  const compareTowns = useMemo(
    () => filteredTowns.filter((t) => compareIds.includes(t.id)).slice(0, 8),
    [filteredTowns, compareIds],
  )

  const compareSeries = useMemo(
    () =>
      compareTowns.map((t, i) => ({
        key: t.id,
        label: t.name,
        color: PALETTE[i % PALETTE.length],
      })),
    [compareTowns],
  )

  const compareRows = useMemo(() => {
    const years = YEARS.filter((y) => y >= from && y <= to)
    const indexes = compareTowns.map((t) => ({ id: t.id, data: populationIndex(t.series, from, to) }))
    return years.map((year) => {
      const row = { year }
      indexes.forEach(({ id, data }) => {
        const point = data.find((p) => p.year === year)
        row[id] = point ? point.value : null
      })
      return row
    })
  }, [compareTowns, from, to])

  const exportCsv = () => {
    const csv = toCsv(summaries, HAS_FLOWS)
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `monogoroda_${from}-${to}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const toggleDistrict = (district) => {
    setSelectedDistricts((prev) =>
      prev.includes(district) ? prev.filter((d) => d !== district) : [...prev, district],
    )
  }

  const toggleTown = (id) => {
    setSelectedTownIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const selectAllTowns = () => {
    const visibleIds = townsInDistricts.map((t) => t.id)
    const allChosen = visibleIds.length > 0 && visibleIds.every((id) => selectedTownIds.includes(id))
    setSelectedTownIds((prev) =>
      allChosen ? prev.filter((id) => !visibleIds.includes(id)) : [...new Set([...prev, ...visibleIds])],
    )
  }

  const toggleCompare = (id) => {
    setCompareIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-8)))
  }

  const reset = () => {
    setSelectedTownIds(towns.map((t) => t.id))
    setSelectedDistricts(DISTRICTS)
    setFrom(YEARS[0] ?? 2010)
    setTo(YEARS[YEARS.length - 1] ?? 2023)
  }

  if (!DATA_READY) return <DataSetup />

  const fetchedLabel = DATA_META?.fetchedAt ? new Date(DATA_META.fetchedAt).toLocaleDateString('ru-RU') : null

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div>
            <div className="brand">
              <span className="brand-mark">BI</span>
              <span className="brand-text">Мониторинг демографии моногородов</span>
            </div>
            <h1>Динамика естественного и миграционного движения населения в моногородах России</h1>
            <p className="subtitle">
              Аналитическая панель по {towns.length} монопрофильным городам, {YEARS[0]}–{YEARS[YEARS.length - 1]} гг.
              Источник: БД ПМО Росстата (выгрузка «Демографические показатели МО России»).
            </p>
          </div>
          <div className="header-aside">
            <span className="pill">Реальные данные{fetchedLabel ? ` · ${fetchedLabel}` : ''}</span>
            <button type="button" className="btn" onClick={exportCsv}>
              Экспорт CSV
            </button>
          </div>
        </div>

        <nav className="tabs">
          {TABS.map((t) => (
            <button
              type="button"
              key={t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <Filters
        towns={townsInDistricts}
        selectedTowns={selectedTownIds}
        onToggleTown={toggleTown}
        onSelectAllTowns={selectAllTowns}
        districts={DISTRICTS}
        selected={selectedDistricts}
        onToggle={toggleDistrict}
        onSelectAll={() =>
          setSelectedDistricts(selectedDistricts.length === DISTRICTS.length ? [] : DISTRICTS)
        }
        years={YEARS}
        from={from}
        to={to}
        onFrom={(y) => setFrom(Math.min(y, to))}
        onTo={(y) => setTo(Math.max(y, from))}
        shown={filteredTowns.length}
        total={towns.length}
        onReset={reset}
      />

      <main className="content">
        {!kpi ? (
          <div className="card empty-state">Отметьте хотя бы один город и федеральный округ, чтобы увидеть показатели.</div>
        ) : (
          <>
            {tab === 'overview' && (
              <>
                <section className="kpi-grid">
                  <Kpi
                    label="Численность населения"
                    value={fmt(kpi.population, 1)}
                    unit="тыс. чел."
                    delta={`${fmtSigned(kpi.popChangePct, 2)} %`}
                    deltaLabel={`за ${from}–${to}`}
                    tone={kpi.popChangePct >= 0 ? 'pos' : 'neg'}
                    hint={`${kpi.count} городов в выборке`}
                    spark={byYear.map((y) => y.population)}
                  />
                  <Kpi
                    label="Естественный прирост за период"
                    value={fmtInt(kpi.natTotal)}
                    unit="чел."
                    delta={`${fmtSigned(kpi.avgNat, 2)} %`}
                    deltaLabel="в среднем за год"
                    tone={kpi.avgNat >= 0 ? 'pos' : 'neg'}
                    hint={`рождаемость ${fmt(byYear[byYear.length - 1].births / kpi.population, 1)} %`}
                    spark={byYear.map((y) => y.natGrowth)}
                    sparkColor="#0d9488"
                  />
                  <Kpi
                    label="Миграционный прирост за период"
                    value={fmtInt(kpi.migTotal)}
                    unit="чел."
                    delta={`${fmtSigned(kpi.avgMig, 2)} %`}
                    deltaLabel="в среднем за год"
                    tone={kpi.avgMig >= 0 ? 'pos' : 'neg'}
                    hint={`доля городов с оттоком — ${fmt(kpi.outflowShare, 0)} %`}
                    spark={byYear.map((y) => y.migGrowth)}
                    sparkColor="#2563eb"
                  />
                  <Kpi
                    label="Города с двойной убылью"
                    value={`${kpi.doubleDecline} / ${kpi.count}`}
                    delta={`${fmt(kpi.doubleDeclineShare, 0)} %`}
                    deltaLabel="выборки"
                    tone="neg"
                    hint="естественная убыль + миграционный отток"
                  />
                </section>

                <section className="card">
                  <div className="card-head">
                    <h2>Коэффициенты движения населения</h2>
                    <span className="card-note">среднегодовой коэффициент, суммарно по выборке</span>
                  </div>
                  <LineChart data={byYear} series={rateSeries} unit=" %" height={330} />
                </section>

                <div className="grid-2">
                  <section className="card">
                    <div className="card-head">
                      <h2>Матрица «естественное × миграционное движение»</h2>
                      <span className="card-note">средние значения за период</span>
                    </div>
                    <ScatterQuadrant points={summaries} />
                  </section>

                  <section className="card">
                    <div className="card-head">
                      <h2>Миграционный отток: худшие 8</h2>
                      <span className="card-note">% в среднем за год</span>
                    </div>
                    <RankBars
                      items={[...sortedByMig]
                        .reverse()
                        .slice(0, 8)
                        .filter((t) => isNum(t.migRate))
                        .map((t) => ({ id: t.id, name: t.name, value: t.migRate, hint: `${t.region}: ${t.district}` }))}
                    />
                    <div className="card-head secondary">
                      <h3>Миграционный приток: лучшие 5</h3>
                    </div>
                    <RankBars
                      items={sortedByMig
                        .filter((t) => safe(t.migRate) > 0)
                        .slice(0, 5)
                        .map((t) => ({ id: t.id, name: t.name, value: t.migRate }))}
                      positiveColor="#059669"
                      negativeColor="#059669"
                    />
                  </section>
                </div>

                <section className="card">
                  <div className="card-head">
                    <h2>Сводная таблица моногородов</h2>
                    <span className="card-note">сортировка по клику на заголовок</span>
                  </div>
                  <DataTable rows={summaries} limit={12} />
                </section>
              </>
            )}

            {tab === 'natural' && (
              <>
                <section className="kpi-grid kpi-grid-3">
                  <Kpi
                    label="Родилось за период"
                    value={fmtTotal(summaries, 'births')}
                    unit="чел."
                    hint={`${fmt(avg(summaries.map((t) => t.birthRate)), 1)} % — средний коэффициент`}
                    tone="pos"
                    spark={byYear.map((y) => y.births)}
                    sparkColor="#0d9488"
                  />
                  <Kpi
                    label="Умерло за период"
                    value={fmtTotal(summaries, 'deaths')}
                    unit="чел."
                    hint={`${fmt(avg(summaries.map((t) => t.deathRate)), 1)} % — средний коэффициент`}
                    tone="neg"
                    spark={byYear.map((y) => y.deaths)}
                    sparkColor="#dc2626"
                  />
                  <Kpi
                    label="Естественная убыль"
                    value={fmtInt(kpi.natTotal)}
                    unit="чел."
                    delta={`${fmtSigned(kpi.avgNat, 2)} %`}
                    deltaLabel="в среднем за год"
                    tone={kpi.avgNat >= 0 ? 'pos' : 'neg'}
                    hint="разница между родившимися и умершими"
                  />
                </section>

                <section className="card">
                  <div className="card-head">
                    <h2>Родившиеся и умершие</h2>
                    <span className="card-note">человек в год, суммарно по выборке</span>
                  </div>
                  <GroupedBars
                    data={byYear}
                    series={[
                      { key: 'births', label: 'Родилось', color: '#0d9488' },
                      { key: 'deaths', label: 'Умерло', color: '#e11d48' },
                    ]}
                    height={320}
                  />
                </section>

                <div className="grid-2">
                  <section className="card">
                    <div className="card-head">
                      <h2>Естественный прирост</h2>
                      <span className="card-note">среднегодовой коэффициент</span>
                    </div>
                    <LineChart
                      data={byYear}
                      series={[{ key: 'natRate', label: 'Естественный прирост', color: '#0d9488' }]}
                      height={300}
                      unit=" %"
                    />
                    <p className="card-caption">
                      Снижение рождаемости (демографическая «яма» 1990-х) при медленно сокращающейся смертности
                      приводит к отрицательному естественному приросту практически во всех моногородах выборки.
                    </p>
                  </section>

                  <section className="card">
                    <div className="card-head">
                      <h2>Рейтинг по естественному приросту</h2>
                      <span className="card-note">% в среднем за год</span>
                    </div>
                    <RankBars
                      items={sortedByNat
                        .filter((t) => isNum(t.natRate))
                        .slice(0, 6)
                        .map((t) => ({ id: t.id, name: t.name, value: t.natRate }))}
                      positiveColor="#059669"
                      negativeColor="#059669"
                    />
                    <div className="card-head secondary">
                      <h3>Наибольшая естественная убыль</h3>
                    </div>
                    <RankBars
                      items={[...sortedByNat]
                        .filter((t) => isNum(t.natRate))
                        .reverse()
                        .slice(0, 6)
                        .map((t) => ({ id: t.id, name: t.name, value: t.natRate }))}
                      positiveColor="#dc2626"
                      negativeColor="#dc2626"
                    />
                  </section>
                </div>

                <section className="card">
                  <div className="card-head">
                    <h2>Детализация по городам</h2>
                    <span className="card-note">естественное движение за период</span>
                  </div>
                  <DataTable rows={summaries} />
                </section>
              </>
            )}

            {tab === 'migration' && (
              <>
                <section className="kpi-grid kpi-grid-3">
                  <Kpi
                    label="Миграционный прирост за период"
                    value={fmtInt(kpi.migTotal)}
                    unit="чел."
                    delta={`${fmtSigned(kpi.avgMig, 2)} %`}
                    deltaLabel="в среднем за год"
                    tone={kpi.avgMig >= 0 ? 'pos' : 'neg'}
                    hint={`${kpi.outflow} из ${kpi.count} городов с оттоком`}
                    spark={byYear.map((y) => y.migGrowth)}
                    sparkColor="#2563eb"
                  />
                  <Kpi
                    label={`${HAS_FLOWS ? 'Прибыло за период' : 'Городов с миграционным оттоком'}`}
                    value={HAS_FLOWS ? totalOr(summaries, 'arrived') : `${kpi.outflow} / ${kpi.count}`}
                    unit={HAS_FLOWS ? 'чел.' : ''}
                    delta={HAS_FLOWS ? '' : `${fmt(kpi.outflowShare, 0)} %`}
                    deltaLabel={HAS_FLOWS ? '' : 'выборки'}
                    tone={HAS_FLOWS ? 'pos' : 'neg'}
                    hint={HAS_FLOWS ? 'по данным миграционных служб' : 'за весь период наблюдения'}
                    spark={HAS_FLOWS ? byYear.map((y) => y.arrived) : undefined}
                    sparkColor="#2563eb"
                  />
                  <Kpi
                    label={HAS_FLOWS ? 'Выбыло за период' : 'Города с миграционным притоком'}
                    value={HAS_FLOWS ? totalOr(summaries, 'departed') : `${kpi.count - kpi.outflow} / ${kpi.count}`}
                    unit={HAS_FLOWS ? 'чел.' : ''}
                    delta={HAS_FLOWS ? '' : `${fmt(100 - kpi.outflowShare, 0)} %`}
                    deltaLabel={HAS_FLOWS ? '' : 'выборки'}
                    tone={HAS_FLOWS ? 'neg' : 'pos'}
                    hint={HAS_FLOWS ? 'по данным миграционных служб' : 'положительное сальдо миграции'}
                    spark={HAS_FLOWS ? byYear.map((y) => y.departed) : undefined}
                    sparkColor="#e11d48"
                  />
                </section>

                <section className="card">
                  <div className="card-head">
                    <h2>{HAS_FLOWS ? 'Прибывшие и выбывшие' : 'Миграционный прирост по годам'}</h2>
                    <span className="card-note">
                      {HAS_FLOWS ? 'человек в год, суммарно по выборке' : 'человек в год, суммарно по выборке (сальдо)'}
                    </span>
                  </div>
                  {HAS_FLOWS ? (
                    <GroupedBars
                      data={byYear}
                      series={[
                        { key: 'arrived', label: 'Прибыло', color: '#2563eb' },
                        { key: 'departed', label: 'Выбыло', color: '#e11d48' },
                      ]}
                      height={320}
                    />
                  ) : (
                    <LineChart
                      data={byYear}
                      series={[{ key: 'migGrowth', label: 'Миграционный прирост, чел.', color: '#2563eb' }]}
                      height={320}
                      digits={0}
                    />
                  )}
                </section>

                <div className="grid-2">
                  <section className="card">
                    <div className="card-head">
                      <h2>Миграционный прирост (%)</h2>
                      <span className="card-note">среднегодовой коэффициент, в год</span>
                    </div>
                    <LineChart
                      data={byYear}
                      series={[{ key: 'migRate', label: 'Миграционный прирост', color: '#2563eb' }]}
                      height={300}
                      unit=" %"
                    />
                    <p className="card-caption">
                      Сальдо миграции в моногородах чувствительно к состоянию градообразующего предприятия:
                      сокращение штата даёт всплеск выбытий с лагом в 1–2 года.
                    </p>
                  </section>

                  <section className="card">
                    <div className="card-head">
                      <h2>Миграционная привлекательность</h2>
                      <span className="card-note">% в среднем за год</span>
                    </div>
                    <RankBars
                      items={sortedByMig
                        .filter((t) => isNum(t.migRate))
                        .slice(0, 6)
                        .map((t) => ({ id: t.id, name: t.name, value: t.migRate }))}
                      positiveColor="#059669"
                      negativeColor="#059669"
                    />
                    <div className="card-head secondary">
                      <h3>Наибольший отток</h3>
                    </div>
                    <RankBars
                      items={[...sortedByMig]
                        .filter((t) => isNum(t.migRate))
                        .reverse()
                        .slice(0, 6)
                        .map((t) => ({ id: t.id, name: t.name, value: t.migRate }))}
                      positiveColor="#dc2626"
                      negativeColor="#dc2626"
                    />
                  </section>
                </div>

                <section className="card">
                  <div className="card-head">
                    <h2>Типология городов</h2>
                    <span className="card-note">естественное × миграционное движение</span>
                  </div>
                  <ScatterQuadrant points={summaries} />
                </section>
              </>
            )}

            {tab === 'compare' && (
              <>
                <section className="card">
                  <div className="card-head">
                    <h2>Выберите города для сравнения</h2>
                    <span className="card-note">не более 8 городов</span>
                  </div>
                  <div className="picker">
                    {filteredTowns.map((t) => {
                      const active = compareIds.includes(t.id)
                      return (
                        <button
                          type="button"
                          key={t.id}
                          className={`chip ${active ? 'active' : ''}`}
                          onClick={() => toggleCompare(t.id)}
                          aria-pressed={active}
                        >
                          {t.name}
                        </button>
                      )
                    })}
                  </div>
                </section>

                <section className="card">
                  <div className="card-head">
                    <h2>Динамика численности населения</h2>
                    <span className="card-note">индекс, {from} = 100</span>
                  </div>
                  {compareTowns.length ? (
                    <LineChart
                      data={compareRows}
                      series={compareSeries}
                      height={380}
                      includeZero={false}
                      digits={1}
                      yTickCount={5}
                    />
                  ) : (
                    <p className="card-caption">Выберите хотя бы один город из списка выше.</p>
                  )}
                </section>

                <div className="grid-2">
                  <section className="card">
                    <div className="card-head">
                      <h2>Естественный прирост по выбранным городам</h2>
                      <span className="card-note">среднее за период, %</span>
                    </div>
                    <RankBars
                      items={compareTowns
                        .map((t) => {
                          const s = summaries.find((x) => x.id === t.id)
                          return { id: t.id, name: t.name, value: s && isNum(s.natRate) ? s.natRate : null }
                        })
                        .filter((x) => isNum(x.value))}
                      positiveColor="#0d9488"
                      negativeColor="#dc2626"
                    />
                  </section>
                  <section className="card">
                    <div className="card-head">
                      <h2>Миграционный прирост по выбранным городам</h2>
                      <span className="card-note">среднее за период, %</span>
                    </div>
                    <RankBars
                      items={compareTowns
                        .map((t) => {
                          const s = summaries.find((x) => x.id === t.id)
                          return { id: t.id, name: t.name, value: s && isNum(s.migRate) ? s.migRate : null }
                        })
                        .filter((x) => isNum(x.value))}
                      positiveColor="#2563eb"
                      negativeColor="#dc2626"
                    />
                  </section>
                </div>
              </>
            )}

            {tab === 'data' && (
              <>
                <section className="card">
                  <div className="card-head">
                    <h2>Полный набор данных: {filteredTowns.length} городов, {from}–{to}</h2>
                    <button type="button" className="btn small" onClick={exportCsv}>
                      Скачать CSV
                    </button>
                  </div>
                  <DataTable rows={summaries} />
                </section>

                <div className="grid-2">
                  <section className="card">
                    <div className="card-head">
                      <h2>Методика расчёта</h2>
                    </div>
                    <ul className="method">
                      <li>Коэффициент естественного прироста = (родившиеся − умершие) / население × 1000.</li>
                      <li>Коэффициент миграционного прироста = прибывшие − выбывшие (сальдо) / население × 1000.</li>
                      <li>Численность населения — оценка на 1 января, тыс. человек.</li>
                      <li>Круглые суммы и средние считаются по выбранному периоду наблюдения.</li>
                      <li>Типология строится по знакам обоих коэффициентов на матрице.</li>
                    </ul>
                  </section>
                  <section className="card">
                    <div className="card-head">
                      <h2>Источники данных</h2>
                    </div>
                    <ul className="method">
                      <li>
                        Росстат — База данных показателей муниципальных образований (БД ПМО): естественное движение
                        населения, миграция, численность.
                      </li>
                      <li>
                        Выгрузка «Демографические показатели муниципальных образований России» (проект «Если быть
                        точным», tochno.st, лицензия CC BY).
                      </li>
                      <li>Перечень монопрофильных муниципальных образований — распоряжение Правительства РФ № 1398-р.</li>
                      <li>Выборка: {towns.length} моногородов; данные загружены {fetchedLabel || '—'}.</li>
                    </ul>
                    <p className="card-caption">
                      {DATA_META?.note || ''}
                      {COVERAGE.gaps > 0 ? ` Пропуски в рядах: ${COVERAGE.gaps}.` : ''}
                    </p>
                    {(DATA_META?.droppedYears?.length > 0 ||
                      DATA_META?.unmatched?.length > 0 ||
                      DATA_META?.districtLevel?.length > 0) && (
                      <p className="card-caption">
                        {DATA_META?.droppedYears?.length > 0
                          ? `Годы с неполным покрытием исключены: ${DATA_META.droppedYears.join(', ')}. `
                          : ''}
                        {DATA_META?.unmatched?.length > 0
                          ? `Нет данных на уровне муниципального образования: ${DATA_META.unmatched
                              .map((u) => (typeof u === 'string' ? u : u.name))
                              .join(', ')}. `
                          : ''}
                        {DATA_META?.districtLevel?.length > 0
                          ? `Ряд дан по муниципальному району (городской округ отдельно не публикуется): ${DATA_META.districtLevel.join(', ')}.`
                          : ''}
                      </p>
                    )}
                  </section>
                </div>
              </>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <span>{DATA_SOURCE}</span>
        <span className="footer-meta">
          {YEARS[0]}–{YEARS[YEARS.length - 1]} · {towns.length} моногородов · {DISTRICTS.length} федеральных округов
        </span>
      </footer>
    </div>
  )
}

/** Суммарное значение по городам, где показатель есть */
function fmtTotal(summaries, key) {
  const values = summaries.map((t) => t[key]).filter(isNum)
  return fmtInt(values.reduce((a, b) => a + b, 0))
}

function totalOr(summaries, key) {
  const values = summaries.map((t) => t[key]).filter(isNum)
  return fmtInt(values.reduce((a, b) => a + b, 0))
}