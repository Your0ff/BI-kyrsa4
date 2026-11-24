// Чистые функции разбора выгрузки БД ПМО (tochno.st / Росстат).
// Без fs и сети — чтобы их можно было тестировать отдельно.
//
// Реальный формат файла (проверено на mun_demography.csv):
//   oktmo;not_zato;region;mun_type;municipality;year;population;average_population;
//   deaths;births;migration;mortality_rate;birth_rate;migration_rate
// Названия МО часто в прилагательной форме: «Магнитогорский (ГО)», «Киселевский»,
// «город Норильск», поэтому сопоставление идёт по основе слова + субъекту РФ.

const QUOTES_RE = /[«»"'`”“]/g

export function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(QUOTES_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Заголовок колонки: нижний регистр, без подчёркиваний и дефисов */
export function normalizeHeader(value) {
  return normalizeText(value).replace(/[_-]+/g, ' ')
}

// Служебные слова, которые не помогают отличить одно МО от другого
const STOP_TOKENS = new Set([
  'городской', 'округ', 'городского', 'муниципальный', 'муниципального', 'муниципальное',
  'муниципальная', 'муниципальный район', 'район', 'района', 'городское', 'сельское',
  'поселение', 'поселения', 'город', 'города', 'пгт', 'рп', 'поселок', 'поселка', 'село',
  'деревня', 'типа', 'внутригородским', 'делением', 'населенный', 'пункт',
  'г', 'о', 'мо', 'го', 'с', 'в', 'и', 'на', 'им',
])

/** Название муниципального образования без типа МО и служебных пометок */
export function normalizeMunicipality(value) {
  const cleaned = normalizeText(value)
    .replace(/\((го|гп|сп|мо|мр)\)/g, ' ')
    .replace(/[.,;:()\-–—/]/g, ' ')
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !STOP_TOKENS.has(t))
    .join(' ')
}

/** Основа слова: «магнитогорский» → «магнитогорск», «киселевский» → «киселевск» */
export function stemWord(name) {
  return normalizeMunicipality(name).replace(
    /(ский|ская|ское|ские|ского|скому|ским|ском|ого|ому|ыми|ий|ый|ая|ое|ые|ых|ой)$/,
    '',
  )
}

export function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0) || ''
  const candidates = [';', ',', '\t', '|']
  let best = ';'
  let bestCount = -1
  for (const d of candidates) {
    const count = line.split(d).length
    if (count > bestCount) {
      bestCount = count
      best = d
    }
  }
  return best
}

/** Простой CSV/TSV-парсер с поддержкой кавычек */
export function parseDelimited(text, delimiter) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const src = String(text).replace(/^\uFEFF/, '')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // пропускаем
    } else {
      field += ch
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''))
}

// Варианты названий колонок (сравниваются после normalizeHeader)
const ALIASES = {
  year: ['год', 'годы', 'year', 'период'],
  region: ['region', 'регион', 'субъект рф', 'субъект российской федерации', 'название региона', 'наименование региона', 'регион рф'],
  district: ['district', 'федеральный округ', 'federal district', 'фо'],
  municipality: ['municipality', 'муниципальное образование', 'название мо', 'название муниципального образования', 'наименование муниципального образования', 'наименование мо', 'муниципалитет', 'mo'],
  munType: ['mun type', 'тип мо', 'тип муниципального образования', 'тип поселения', 'вид мо'],
  oktmo: ['oktmo', 'октмо', 'код октмо'],
  population: ['population', 'численность населения на 1 января', 'численность населения на 1 января соответствующего года', 'численность населения', 'население', 'численность постоянного населения'],
  avgPopulation: ['average population', 'avg population', 'average_population', 'mean population', 'mid year population', 'среднегодовая численность населения', 'среднегодовая численность'],
  births: ['births', 'число родившихся', 'родившиеся', 'родилось'],
  deaths: ['deaths', 'число умерших', 'умершие', 'умерло'],
  birthRate: ['birth rate', 'fertil  rate', 'fertility rate', 'общий коэффициент рождаемости', 'коэффициент рождаемости'],
  deathRate: ['mortality rate', 'death rate', 'общий коэффициент смертности', 'коэффициент смертности'],
  natRate: ['natural increase rate', 'коэффициент естественного прироста', 'коэффициент естественного прироста убыли'],
  migRate: ['migration rate', 'net migration rate', 'коэффициент миграционного прироста, убыли', 'коэффициент миграционного прироста'],
  migGrowth: ['migration', 'net migration', 'миграционный прирост', 'миграционный прирост убыль', 'миграция'],
  arrived: ['arrived', 'число прибывших', 'прибывшие', 'прибыло'],
  departed: ['departed', 'число выбывших', 'выбывшие', 'выбыло'],
}

/** Определяет индексы нужных колонок по заголовку */
export function findColumns(header) {
  const norm = header.map(normalizeHeader)
  const used = new Set()
  const result = {}

  const assign = (key, idx) => {
    if (result[key] === undefined && !used.has(idx)) {
      result[key] = idx
      used.add(idx)
    }
  }

  // 1) точное совпадение (в порядке приоритета ключей)
  for (const [key, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      const idx = norm.findIndex((h, i) => h === alias && !used.has(i))
      if (idx !== -1) {
        assign(key, idx)
        break
      }
    }
  }
  // 2) частичное совпадение
  for (const [key, aliases] of Object.entries(ALIASES)) {
    if (result[key] !== undefined) continue
    for (const alias of aliases) {
      const idx = norm.findIndex((h, i) => {
        if (used.has(i) || !h) return false
        if ((key === 'migGrowth' || key === 'births' || key === 'deaths') && h.includes('rate')) return false
        if ((key === 'migGrowth' || key === 'births' || key === 'deaths') && h.includes('коэффициент')) return false
        if ((key === 'birthRate' || key === 'deathRate' || key === 'migRate' || key === 'natRate') && !h.includes('rate') && !h.includes('коэффициент')) return false
        return h.includes(alias)
      })
      if (idx !== -1) {
        assign(key, idx)
        break
      }
    }
  }
  return result
}

export function toNumber(value) {
  if (value === null || value === undefined) return null
  const s = String(value).replace(/\s|\u00a0/g, '').replace(/−/g, '-').replace(',', '.')
  if (!s || s === '-' || s === '—' || s === '…' || s === 'X' || s === 'NA' || s === 'null') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const median = (arr) => {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/**
 * Переводит строки выгрузки в нормализованные наблюдения.
 * Возвращает { records, columns } либо ошибку с заголовками, если не распознано.
 */
export function buildRecords(rows) {
  if (!rows.length) return { error: 'Файл пуст' }
  const header = rows[0]
  const columns = findColumns(header)
  const missing = ['year', 'municipality'].filter((k) => columns[k] === undefined)
  if (missing.length || (columns.population === undefined && columns.avgPopulation === undefined)) {
    return { error: 'Не распознаны обязательные колонки', header, columns }
  }

  const records = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const year = toNumber(row[columns.year])
    const name = row[columns.municipality]
    if (!year || !name) continue

    const population = columns.population !== undefined ? toNumber(row[columns.population]) : null
    const avgPopulation = columns.avgPopulation !== undefined ? toNumber(row[columns.avgPopulation]) : null

    records.push({
      name: String(name),
      nameNorm: normalizeMunicipality(name),
      munType: columns.munType !== undefined ? String(row[columns.munType] || '') : '',
      region: columns.region !== undefined ? String(row[columns.region] || '') : '',
      regionNorm: columns.region !== undefined ? normalizeText(row[columns.region]) : '',
      oktmo: columns.oktmo !== undefined ? String(row[columns.oktmo] || '').trim() : '',
      year,
      population: population !== null ? population : avgPopulation,
      avgPopulation,
      births: columns.births !== undefined ? toNumber(row[columns.births]) : null,
      deaths: columns.deaths !== undefined ? toNumber(row[columns.deaths]) : null,
      birthRate: columns.birthRate !== undefined ? toNumber(row[columns.birthRate]) : null,
      deathRate: columns.deathRate !== undefined ? toNumber(row[columns.deathRate]) : null,
      natRate: columns.natRate !== undefined ? toNumber(row[columns.natRate]) : null,
      migRate: columns.migRate !== undefined ? toNumber(row[columns.migRate]) : null,
      migGrowth: columns.migGrowth !== undefined ? toNumber(row[columns.migGrowth]) : null,
      arrived: columns.arrived !== undefined ? toNumber(row[columns.arrived]) : null,
      departed: columns.departed !== undefined ? toNumber(row[columns.departed]) : null,
    })
  }
  return { records, columns }
}

/**
 * Масштаб величин. В БД ПМО население — в человеках (медиана по всем МО ~20–25 тыс.),
 * коэффициенты — на 1 человеко-год, события — в человеках.
 * Определяем по медианам и сверяем с коэффициентами.
 */
export function detectScales(records) {
  const populations = records.map((r) => r.population).filter((v) => Number.isFinite(v) && v > 0)
  const popMedian = median(populations)
  // меньше 1000 — значит данные уже в тыс. чел.
  const populationDivisor = popMedian >= 1000 ? 1000 : 1
  const personsMedian = populationDivisor === 1000 ? popMedian : popMedian * 1000

  const rates = records
    .flatMap((r) => [r.migRate, r.birthRate, r.deathRate, r.natRate])
    .filter((v) => Number.isFinite(v))
    .map(Math.abs)
  const rateMedian = median(rates)
  const rateMultiplier = rateMedian !== 0 && rateMedian < 1 ? 1000 : 1
  const ratePermille = rateMedian * rateMultiplier

  const events = records
    .flatMap((r) => [r.births, r.deaths, r.migGrowth])
    .filter((v) => Number.isFinite(v))
    .map(Math.abs)
  const eventsMedian = median(events)

  // сколько событий ожидается, если они записаны в человеках
  const expectedPersons = (ratePermille * personsMedian) / 1000
  let countsMultiplier = 1
  if (expectedPersons > 0 && eventsMedian > 0) {
    countsMultiplier = Math.abs(eventsMedian - expectedPersons) <= Math.abs(eventsMedian * 1000 - expectedPersons) ? 1 : 1000
  } else if (popMedian > 0 && eventsMedian / popMedian < 1e-4) {
    countsMultiplier = 1000
  }

  return { populationDivisor, rateMultiplier, countsMultiplier, popMedian, personsMedian, rateMedian, ratePermille, eventsMedian, expectedPersons }
}

// Общие слова, которые есть почти у каждого региона и поэтому ничего не различают
const REGION_STOP = new Set(['республика', 'область', 'край', 'автономный', 'округ', 'район', 'город', 'федерального', 'значения', 'обл', 'респ'])

/** Совпадение субъекта РФ */
export function regionMatches(monogorod, record) {
  const target = normalizeText(monogorod.region)
  const value = record.regionNorm
  if (!target || !value) return false
  const distinctive = (s) =>
    s
      .split(/[\s()—-]+/)
      .filter((w) => w.length > 3 && !REGION_STOP.has(w))
  const targetWords = distinctive(target)
  const valueWords = distinctive(value)
  if (!targetWords.length) return target === value
  // совпадение должно быть по уникальному слову («Самарская», «Татарстан», «Саха»)
  return targetWords.some((w) => valueWords.some((v) => v === w || v.startsWith(w.slice(0, 6)) || w.startsWith(v.slice(0, 6))))
}

/** Похожесть названий МО: 0 — не похоже, 3 — совпадение основы */
export function nameScore(aRaw, bRaw) {
  const a = normalizeMunicipality(aRaw)
  const b = normalizeMunicipality(bRaw)
  if (!a || !b) return 0
  if (a === b) return 3
  const sa = stemWord(aRaw)
  const sb = stemWord(bRaw)
  if (sa && sb && sa === sb) return 2.6
  if (a.startsWith(b) || b.startsWith(a)) return 2.2
  if (sa && sb && (sa.startsWith(sb) || sb.startsWith(sa))) return 2.2
  if (sa && sb && sa.slice(0, 5) === sb.slice(0, 5) && Math.abs(sa.length - sb.length) <= 4) return 1.2
  // одно из слов названия МО совпадает с названием города
  // («Богородский и ГО Электросталь» ↔ «Электросталь»)
  const tokensB = b.split(' ')
  if (a.split(' ').some((t) => t.length > 3 && tokensB.includes(t))) return 2.4
  return 0
}

const groupKey = (record) => record.oktmo || `${record.regionNorm}|${record.nameNorm}`

/** Группирует наблюдения по муниципальным образованиям */
export function groupRecords(records) {
  const groups = new Map()
  records.forEach((r) => {
    const key = groupKey(r)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  })
  return [...groups.values()]
}

/**
 * Выбирает муниципальное образование, соответствующее моногороду.
 * Обязательно совпадение субъекта РФ; среди кандидатов побеждает лучшая похожесть
 * названия, при равном счёте — городской округ (а не район).
 */
export function matchMunicipality(monogorod, records) {
  const groups = groupRecords(records)
  const variants = [monogorod.name, ...(monogorod.aliases || [])]
  const candidates = []

  groups.forEach((rows) => {
    const head = rows[0]
    if (!regionMatches(monogorod, head)) return
    const score = Math.max(...variants.map((v) => nameScore(v, head.name)))
    if (score <= 0) return
    const isOkrug = /городской округ|муниципальный округ|городской округ с/i.test(head.munType)
    const isDistrict = /район/i.test(head.munType)
    const withPopulation = rows.filter((r) => Number.isFinite(r.population)).length
    const total = score + (isOkrug ? 0.6 : 0) - (isDistrict ? 0.25 : 0) + Math.min(withPopulation, 10) * 0.01
    candidates.push({ rows, score, total, head })
  })

  if (!candidates.length) return []
  candidates.sort((a, b) => b.total - a.total || b.score - a.score)
  const best = candidates[0]

  // страховка: нужен хотя бы какой-то ряд численности
  const usable = best.rows.filter((r) => Number.isFinite(r.population))
  return usable.length >= 2 ? best.rows : []
}

/** Подсказка для отчёта: ближайшие по названию МО из того же региона */
export function nearbyCandidates(monogorod, records, limit = 5) {
  const scored = groupRecords(records)
    .filter((rows) => regionMatches(monogorod, rows[0]))
    .map((rows) => ({
      name: rows[0].name,
      score: Math.max(...[monogorod.name, ...(monogorod.aliases || [])].map((v) => nameScore(v, rows[0].name))),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ru'))
  return scored.slice(0, limit).map((s) => s.name)
}

const round = (value, digits = 2) => {
  const k = 10 ** digits
  return Math.round(value * k) / k
}

const rateFrom = (count, populationThousands) => {
  if (!Number.isFinite(count) || !populationThousands) return null
  return round(count / populationThousands, 2) // ‰: чел. / тыс. чел.
}

/** Собирает временной ряд одного города */
export function buildTownSeries(monogorod, records, scales) {
  const byYear = new Map()
  records.forEach((r) => {
    if (!byYear.has(r.year)) byYear.set(r.year, r)
  })

  const years = [...byYear.keys()].sort((a, b) => a - b)
  const counts = scales.countsMultiplier || 1
  const series = []

  years.forEach((year) => {
    const r = byYear.get(year)
    const population = Number.isFinite(r.population) ? r.population / scales.populationDivisor : null
    const rawAvg = Number.isFinite(r.avgPopulation) ? r.avgPopulation : r.population
    const avgPopulation = Number.isFinite(rawAvg) ? rawAvg / scales.populationDivisor : null
    const avgPopulationPersons = Number.isFinite(avgPopulation) ? avgPopulation * 1000 : null

    const births =
      Number.isFinite(r.births)
        ? Math.round(r.births * counts)
        : Number.isFinite(r.birthRate) && avgPopulationPersons
          ? Math.round((r.birthRate * scales.rateMultiplier * avgPopulationPersons) / 1000)
          : null
    const deaths =
      Number.isFinite(r.deaths)
        ? Math.round(r.deaths * counts)
        : Number.isFinite(r.deathRate) && avgPopulationPersons
          ? Math.round((r.deathRate * scales.rateMultiplier * avgPopulationPersons) / 1000)
          : null
    const migGrowth =
      Number.isFinite(r.migGrowth)
        ? Math.round(r.migGrowth * counts)
        : Number.isFinite(r.migRate) && avgPopulationPersons
          ? Math.round(((r.migRate * scales.rateMultiplier) / 1000) * avgPopulationPersons)
          : null

    const natGrowth = Number.isFinite(births) && Number.isFinite(deaths) ? births - deaths : null

    series.push({
      year,
      population: Number.isFinite(population) ? round(population, 1) : null,
      births,
      deaths,
      arrived: Number.isFinite(r.arrived) ? Math.round(r.arrived * counts) : null,
      departed: Number.isFinite(r.departed) ? Math.round(r.departed * counts) : null,
      natGrowth,
      migGrowth,
      birthRate: Number.isFinite(r.birthRate) ? round(r.birthRate * scales.rateMultiplier, 2) : rateFrom(births, avgPopulation),
      deathRate: Number.isFinite(r.deathRate) ? round(r.deathRate * scales.rateMultiplier, 2) : rateFrom(deaths, avgPopulation),
      natRate: Number.isFinite(r.natRate) ? round(r.natRate * scales.rateMultiplier, 2) : rateFrom(natGrowth, avgPopulation),
      migRate: Number.isFinite(r.migRate) ? round(r.migRate * scales.rateMultiplier, 2) : rateFrom(migGrowth, avgPopulation),
    })
  })

  // убираем пустые годы в конце ряда (за последний год население есть, а события ещё не опубликованы)
  while (
    series.length &&
    series[series.length - 1].births === null &&
    series[series.length - 1].deaths === null &&
    series[series.length - 1].migGrowth === null
  ) {
    series.pop()
  }

  // без численности населения год бесполезен: не считаются ни индексы, ни агрегатные‰
  return series.filter((row) => Number.isFinite(row.population))
}

/** Общая сборка: список городов + несопоставленные */
export function buildDataset(monogorods, records, scales) {
  const towns = []
  const unmatched = []

  monogorods.forEach((monogorod, index) => {
    const matched = matchMunicipality(monogorod, records)
    if (!matched.length) {
      unmatched.push({ name: monogorod.name, nearest: nearbyCandidates(monogorod, records) })
      return
    }
    const series = buildTownSeries(monogorod, matched, scales)
    if (!series.length) {
      unmatched.push({ name: monogorod.name, nearest: nearbyCandidates(monogorod, records) })
      return
    }
    towns.push({
      id: `t${index + 1}`,
      name: monogorod.name,
      region: monogorod.region,
      district: monogorod.district,
      industry: monogorod.industry,
      oktmo: matched[0].oktmo || '',
      munType: matched[0].munType || '',
      sourceName: matched[0].name,
      series,
    })
  })

  // Годы со неполным покрытием (<90% городов) исключаем: иначе агрегаты и‰ занижены
  const perYear = new Map()
  towns.forEach((t) => t.series.forEach((s) => perYear.set(s.year, (perYear.get(s.year) || 0) + 1)))
  const minCoverage = Math.ceil(towns.length * 0.9)
  const keptYears = new Set([...perYear.entries()].filter(([, n]) => n >= minCoverage).map(([y]) => y))
  const droppedYears = [...perYear.keys()].filter((y) => !keptYears.has(y)).sort((a, b) => a - b)

  const cleaned = towns
    .map((t) => ({ ...t, series: t.series.filter((s) => keptYears.has(s.year)) }))
    .filter((t) => t.series.length > 0)

  return { towns: cleaned, unmatched, droppedYears }
}
