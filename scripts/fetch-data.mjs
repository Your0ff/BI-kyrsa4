#!/usr/bin/env node
// Импорт реальных данных: выгрузка БД ПМО Росстата «Демографические показатели
// муниципальных образований России» (публикуется проектом «Если быть точным»,
// tochno.st). Скрипт скачивает CSV, оставляет только моногорода из
// src/data/monogorods.js и пишет src/data/monogoroda.json.
//
// Использование:
//   npm run data                          — скачать с tochno.st автоматически
//   npm run data -- --url <ссылка на CSV> — скачать по прямой ссылке
//   npm run data -- --file data/raw/mun_demography.csv — использовать свой файл
//
// Требуется Node.js 18+ (встроенный fetch).

import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MONOGORODS } from '../src/data/monogorods.js'
import {
  buildDataset,
  buildRecords,
  detectDelimiter,
  detectScales,
  parseDelimited,
} from './lib/demography.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RAW_DIR = path.join(ROOT, 'data', 'raw')
const OUT_FILE = path.join(ROOT, 'src', 'data', 'monogoroda.json')

const DATASET_PAGE = 'https://tochno.st/datasets/mun_demography'
const DATASET_TITLE = 'Демографические показатели муниципальных образований России (БД ПМО Росстата)'
const DEFAULT_LOCAL = path.join(RAW_DIR, 'mun_demography.csv')

const args = process.argv.slice(2)
const argValue = (name) => {
  const i = args.indexOf(`--${name}`)
  return i !== -1 ? args[i + 1] : undefined
}

const log = (...a) => console.log(...a)

async function download(url, target) {
  log(`→ Скачиваю: ${url}`)
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      Accept: 'text/csv,application/csv,application/vnd.ms-excel,text/html;q=0.8,*/*;q=0.5',
    },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} для ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (!buf.length) throw new Error('Получен пустой файл')
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, buf)
  log(`  сохранено: ${path.relative(ROOT, target)} (${(buf.length / 1024).toFixed(0)} КБ)`)
  return buf.toString('utf8')
}

/** Ищет ссылку на файл данных на странице датасета */
async function resolveFromPage() {
  log(`→ Открываю страницу датасета: ${DATASET_PAGE}`)
  const res = await fetch(DATASET_PAGE, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    },
  })
  if (!res.ok) throw new Error(`Страница датасета недоступна: HTTP ${res.status}`)
  const html = await res.text()

  const urls = [...html.matchAll(/https?:\/\/[^\s"'<>\\)]+/g)].map((m) => m[0])
  const candidates = urls.filter((u) => /\.(csv|xlsx|zip)(\?|#|$)/i.test(u) || /download/i.test(u))
  const csv = candidates.find((u) => /\.csv/i.test(u))
  const chosen = csv || candidates[0]
  if (!chosen) {
    throw new Error(
      'На странице не нашлась ссылка на файл. Скачайте CSV вручную по ссылке ниже и повторите с --file:\n' +
        `  ${DATASET_PAGE}`,
    )
  }
  return chosen
}

async function main() {
  let text
  const fileArg = argValue('file')
  const urlArg = argValue('url')

  try {
    if (fileArg) {
      const p = path.isAbsolute(fileArg) ? fileArg : path.join(ROOT, fileArg)
      log(`→ Читаю локальный файл: ${path.relative(ROOT, p)}`)
      text = await readFile(p, 'utf8')
    } else if (urlArg) {
      text = await download(urlArg, DEFAULT_LOCAL)
    } else if (existsSync(DEFAULT_LOCAL)) {
      log(`→ Найден ранее скачанный файл: ${path.relative(ROOT, DEFAULT_LOCAL)}`)
      text = await readFile(DEFAULT_LOCAL, 'utf8')
    } else {
      const url = await resolveFromPage()
      text = await download(url, DEFAULT_LOCAL)
    }
  } catch (error) {
    console.error(`\n✖ Не удалось получить файл: ${error.message}`)
    console.error(
      '\nЧто делать:\n' +
        `  1) Откройте ${DATASET_PAGE}\n` +
        '  2) Скачайте набор в формате CSV\n' +
        '  3) Положите файл в data/raw/mun_demography.csv\n' +
        '  4) Запустите: npm run data -- --file data/raw/mun_demography.csv\n',
    )
    process.exit(1)
  }

  if (text.slice(0, 2) === 'PK' || text.includes('\u0000')) {
    console.error('✖ Похоже, скачан XLSX/ZIP-архив, а не CSV.')
    console.error('  На странице датасета выберите формат CSV и повторите запуск.')
    process.exit(1)
  }

  const delimiter = detectDelimiter(text)
  log(`→ Разбираю CSV (разделитель «${delimiter}»)`)
  const rows = parseDelimited(text, delimiter)
  if (rows.length < 2) {
    console.error('✖ В файле нет строк с данными')
    process.exit(1)
  }

  const built = buildRecords(rows)
  if (built.error) {
    console.error(`✖ ${built.error}`)
    console.error('  Заголовок файла:', (built.header || []).join(' | '))
    console.error('  Распознанные колонки:', JSON.stringify(built.columns || {}))
    process.exit(1)
  }

  const { records, columns } = built
  const scales = detectScales(records)
  log(`→ Наблюдений в файле: ${records.length}`)
  log(`  колонки: ${Object.keys(columns).join(', ')}`)
  log(
    `  масштаб: население ${scales.populationDivisor === 1000 ? 'в чел.' : 'в тыс.'}, ` +
      `коэффициенты ×${scales.rateMultiplier}`,
  )

  const { towns, unmatched, droppedYears = [] } = buildDataset(MONOGORODS, records, scales)
  if (!towns.length) {
    console.error('✖ Ни один моногород не сопоставлен. Проверьте названия в src/data/monogorods.js')
    process.exit(1)
  }

  const years = [...new Set(towns.flatMap((t) => t.series.map((s) => s.year)))].sort((a, b) => a - b)
  const dataset = {
    meta: {
      title: DATASET_TITLE,
      page: DATASET_PAGE,
      fetchedAt: new Date().toISOString(),
      rows: records.length,
      years,
      towns: towns.length,
      populationUnit: 'тыс. чел.',
      note: 'Численность — на 1 января; коэффициенты — на 1000 жителей. Прибывшие/выбывшие в источнике не публикуются, используется миграционный прирост.',
      unmatched,
      droppedYears,
      districtLevel: towns.filter((t) => /район/i.test(t.munType)).map((t) => t.name),
    },
    towns,
  }

  await mkdir(path.dirname(OUT_FILE), { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify(dataset), 'utf8')

  log('\n✔ Готово')
  log(`  файл: ${path.relative(ROOT, OUT_FILE)}`)
  log(`  городов: ${towns.length} из ${MONOGORODS.length}`)
  log(`  годы: ${years[0]}–${years[years.length - 1]}`)
  if (droppedYears.length) log(`  исключены годы с неполным покрытием: ${droppedYears.join(', ')}`)
  if (unmatched.length) {
    log(`  не сопоставлены (${unmatched.length}):`)
    unmatched.forEach((u) => log(`    - ${u.name} — ближайшие в регионе: ${u.nearest.join(' | ') || '—'}`))
  }

  const sample = towns[0]
  const last = sample.series[sample.series.length - 1]
  log(
    `\n  пример: ${sample.name} (${sample.sourceName}, ${sample.munType}), ${last.year}: ` +
      `население ${last.population} тыс., родилось ${last.births}, умерло ${last.deaths}, ` +
      `миграционный прирост ${last.migGrowth}, естественный прирост ${last.natRate} ‰`,
  )
  log('\nДальше: npm run dev')
}

main()
