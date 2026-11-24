import { YEARS } from '../data/towns'

export const round = (value, digits = 1) => {
  const k = 10 ** digits
  return Math.round(value * k) / k
}

const isNum = (v) => Number.isFinite(v)

export const fmt = (value, digits = 1) =>
  (isNum(value) ? round(value, digits) : 0).toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })

export const fmtInt = (value) => Math.round(isNum(value) ? value : 0).toLocaleString('ru-RU')

export const fmtSigned = (value, digits = 1) => {
  const v = isNum(value) ? value : 0
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), digits)}`
}

export const fmtNullable = (value, digits = 1) => (isNum(value) ? fmt(value, digits) : '—')

/** Срез временного ряда по диапазону лет (включительно) */
export const sliceYears = (series, from, to) => series.filter((d) => d.year >= from && d.year <= to)

const sumOf = (rows, key) => {
  const values = rows.map((r) => r[key]).filter(isNum)
  return values.length ? values.reduce((a, b) => a + b, 0) : null
}

const avgOf = (rows, key) => {
  const values = rows.map((r) => r[key]).filter(isNum)
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

/** Средние характеристики одного города за период */
export function townSummary(town, from, to) {
  const rows = sliceYears(town.series, from, to)
  const first = rows[0]
  const last = rows[rows.length - 1]

  const popChangePct =
    first && last && first.population > 0 ? ((last.population - first.population) / first.population) * 100 : null

  return {
    id: town.id,
    name: town.name,
    region: town.region,
    district: town.district,
    industry: town.industry,
    sourceName: town.sourceName || '',
    munType: town.munType || '',
    natRate: avgOf(rows, 'natRate'),
    migRate: avgOf(rows, 'migRate'),
    birthRate: avgOf(rows, 'birthRate'),
    deathRate: avgOf(rows, 'deathRate'),
    births: sumOf(rows, 'births'),
    deaths: sumOf(rows, 'deaths'),
    arrived: sumOf(rows, 'arrived'),
    departed: sumOf(rows, 'departed'),
    natGrowth: sumOf(rows, 'natGrowth'),
    migGrowth: sumOf(rows, 'migGrowth'),
    popFirst: first ? first.population : null,
    popLast: last ? last.population : null,
    popChangePct,
  }
}

/** Суммарные показатели по выбранной совокупности городов за каждый год */
export function aggregateByYear(townsList, from, to) {
  const years = YEARS.filter((y) => y >= from && y <= to)
  return years
    .map((year) => {
      let births = 0
      let deaths = 0
      let arrived = 0
      let departed = 0
      let migGrowth = 0
      let population = 0
      let natRateSum = 0
      let natRateCount = 0
      let migRateSum = 0
      let migRateCount = 0

      townsList.forEach((town) => {
        const row = town.series.find((r) => r.year === year)
        if (!row) return
        if (isNum(row.births)) births += row.births
        if (isNum(row.deaths)) deaths += row.deaths
        if (isNum(row.arrived)) arrived += row.arrived
        if (isNum(row.departed)) departed += row.departed
        if (isNum(row.migGrowth)) migGrowth += row.migGrowth
        if (isNum(row.population)) population += row.population
        if (isNum(row.natRate)) {
          natRateSum += row.natRate
          natRateCount += 1
        }
        if (isNum(row.migRate)) {
          migRateSum += row.migRate
          migRateCount += 1
        }
      })

      const natGrowth = births - deaths
      return {
        year,
        births,
        deaths,
        arrived,
        departed,
        population,
        natGrowth,
        migGrowth,
        // коэффициент на 1000 жителей: население накапливается в тыс. чел.
        natRate: population > 0 ? natGrowth / population : natRateCount ? natRateSum / natRateCount : 0,
        migRate: population > 0 ? migGrowth / population : migRateCount ? migRateSum / migRateCount : 0,
      }
    })
    .filter(Boolean)
}

/** Типология городов по соотношению естественного и миграционного движения */
export function classify(natRate, migRate) {
  const nat = isNum(natRate) ? natRate : 0
  const mig = isNum(migRate) ? migRate : 0
  if (nat >= 0 && mig >= 0) return { label: 'Устойчивый рост', color: '#059669', short: 'Рост' }
  if (nat < 0 && mig >= 0) return { label: 'Миграционная компенсация', color: '#2563eb', short: 'Компенсация' }
  if (nat >= 0 && mig < 0) return { label: 'Отток при естественном приросте', color: '#d97706', short: 'Отток' }
  return { label: 'Двойная убыль', color: '#dc2626', short: 'Убыль' }
}

/** Индекс динамики численности (первый год = 100) */
export function populationIndex(series, from, to) {
  const rows = sliceYears(series, from, to)
  if (!rows.length || !rows[0].population) return []
  const base = rows[0].population
  return rows.map((r) => ({ year: r.year, value: (r.population / base) * 100 }))
}

export function toCsv(rows, hasFlows) {
  const header = [
    'Город',
    'Регион',
    'Федеральный округ',
    'Отрасль',
    'Население, тыс. чел.',
    'Изменение численности, %',
    'Естественный прирост, %',
    'Миграционный прирост, %',
    'Родилось',
    'Умерло',
    ...(hasFlows ? ['Прибыло', 'Выбыло'] : []),
    'Естественный прирост, чел.',
    'Миграционный прирост, чел.',
  ]
  const body = rows.map((r) => [
    r.name,
    r.region,
    r.district,
    r.industry,
    fmtNullable(r.popLast, 1),
    fmtSigned(r.popChangePct, 2),
    fmtSigned(r.natRate, 2),
    fmtSigned(r.migRate, 2),
    isNum(r.births) ? r.births : '',
    isNum(r.deaths) ? r.deaths : '',
    ...(hasFlows ? [isNum(r.arrived) ? r.arrived : '', isNum(r.departed) ? r.departed : ''] : []),
    isNum(r.natGrowth) ? r.natGrowth : '',
    isNum(r.migGrowth) ? r.migGrowth : '',
  ])
  return [header, ...body].map((line) => line.join(';')).join('\n')
}
