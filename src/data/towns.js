// Загрузка реальных данных из src/data/monogoroda.json.
// Файл создаётся скриптом `npm run data` (см. README): он скачивает выгрузку
// БД ПМО Росстата «Демографические показатели муниципальных образований»
// и оставляет только моногорода из src/data/monogorods.js.
//
// import.meta.glob не падает, если файла ещё нет, — приложение просто покажет
// экран с инструкцией по загрузке данных.

import { DATA_SOURCE } from './monogorods'

const modules = import.meta.glob('./monogoroda.json', { eager: true })
const raw = modules['./monogoroda.json']?.default ?? null

export const DATA_META = raw?.meta ?? null

export const towns = (raw?.towns ?? []).map((town) => ({
  ...town,
  series: [...town.series].sort((a, b) => a.year - b.year),
}))

export const DATA_READY = towns.length > 0

const years = new Set()
towns.forEach((town) => town.series.forEach((row) => years.add(row.year)))
export const YEARS = [...years].sort((a, b) => a - b)

const DISTRICT_ORDER = [
  'Центральный ФО',
  'Северо-Западный ФО',
  'Южный ФО',
  'Северо-Кавказский ФО',
  'Приволжский ФО',
  'Уральский ФО',
  'Сибирский ФО',
  'Дальневосточный ФО',
]

const presentDistricts = new Set(towns.map((t) => t.district))
export const DISTRICTS = DISTRICT_ORDER.filter((d) => presentDistricts.has(d))

/** Есть ли в источнике разбивка на прибывших и выбывших */
export const HAS_FLOWS = towns.some((town) =>
  town.series.every((row) => Number.isFinite(row.arrived) && Number.isFinite(row.departed)),
)

/** Полная детализация по каждому году с полным рядом (для расчёта охвата) */
export const COVERAGE = (() => {
  if (!towns.length || !YEARS.length) return { first: null, last: null, gaps: 0 }
  const gaps = towns.reduce((acc, town) => acc + (YEARS.length - town.series.length), 0)
  return { first: YEARS[0], last: YEARS[YEARS.length - 1], gaps }
})()

export { DATA_SOURCE }
