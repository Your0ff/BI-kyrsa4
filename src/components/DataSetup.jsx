import React from 'react'

const STEPS = [
  {
    title: '1. Скачать выгрузку БД ПМО Росстата',
    text: (
      <>
        Датасет «Демографические показатели муниципальных образований России» (2010–2023, 31 947 наблюдений):
        численность населения, родившиеся, умершие, миграционный прирост и коэффициенты. Формат — CSV.
      </>
    ),
    link: { href: 'https://tochno.st/datasets/mun_demography', label: 'tochno.st/datasets/mun_demography' },
  },
  {
    title: '2. Положить файл в проект',
    text: <>Сохраните CSV как data/raw/mun_demography.csv (папку можно создать вручную).</>,
    code: 'data/raw/mun_demography.csv',
  },
  {
    title: '3. Собрать данные для панели',
    text: <>Скрипт отфильтрует моногорода из src/data/monogorods.js и запишет src/data/monogoroda.json.</>,
    code: 'npm run data -- --file data/raw/mun_demography.csv',
  },
]

export default function DataSetup() {
  return (
    <div className="app">
      <section className="card setup">
        <h1>Данные ещё не загружены</h1>
        <p className="subtitle">
          Панель работает только на реальных данных Росстата (БД ПМО) и не содержит сгенерированных значений. Загрузите
          выгрузку один раз — дальше приложение берёт её из <code>src/data/monogoroda.json</code>.
        </p>

        <ol className="setup-steps">
          {STEPS.map((step) => (
            <li key={step.title}>
              <div className="setup-title">{step.title}</div>
              <div className="setup-text">{step.text}</div>
              {step.link && (
                <a className="setup-link" href={step.link.href} target="_blank" rel="noreferrer">
                  {step.link.label} ↗
                </a>
              )}
              {step.code && <pre className="setup-code">{step.code}</pre>}
            </li>
          ))}
        </ol>

        <p className="card-caption">
          Альтернатива: <code>npm run data</code> без аргументов — скрипт попробует найти и скачать CSV со страницы
          датасета сам.
        </p>
      </section>
    </div>
  )
}
