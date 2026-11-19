# Движки QuestPlayer

Интерпретаторы живут здесь, а не в `QuestPlayer.html`. Ядро страницы не содержит
кода VM: движок лежит отдельным файлом и выполняется только когда пользователь
открыл игру его формата. До этого в памяти лежат только ядро и UI.

```
QuestPlayer.html        ядро: UI, палитра, i18n, сейвы, мост, загрузчик, реестр движков
engines/
  glulx.js              GlkOte + Quixe + Glk + Dialog + Blorb + GiDispa + GiLoad
  README.md             этот файл
```

Один файл на движок. Не дробить `engines/glulx.js` на `glkote.js` + `quixe.js`:
ленивость достигается на уровне движка, а не библиотек.

## Реестр (в ядре)

Две таблицы: `FORMATS` — как узнать файл, `ENGINES` — чем его запускать.

```js
var FORMATS = {
  glulx:    { name: 'Glulx',     ext: ['gblorb', 'blorb', 'ulx', 'blb'] },
  zmachine: { name: 'Z-machine', ext: ['zblorb', 'z1', …, 'z8'] }
};

var ENGINES = {
  glulx: [
    { id: 'quixe', file: 'engines/glulx.js', global: 'GlulxEngine',
      name: 'Glulx', version: '2.2.6' }
  ]
};
```

Ключ `ENGINES` — формат, значение — **массив**: уже сейчас, чтобы в будущем
можно было держать несколько движков одного формата (`quixe` и `git`) без смены
структуры. `cfg.preferredEngine[format]` выбирает движок из массива; если не
задан — первый.

Отсюда же берутся фильтр в выборе файла (`accept`) и текст ошибки: в сообщении
`unknownFormat` перечислены только форматы, у которых есть движок. Добавили
движок — сообщение и фильтр обновились сами, разметку и тексты править не нужно.

Определение формата — `detectFormat(u8, filename)` в ядре: сначала расширение по
`FORMATS`, потом сигнатура (Glul в первых байтах, `FORM…IFRS` + `GLUL` или
`ZCOD` внутри Blorb). Не распознано → `unknownFormat`; формат есть, движка нет →
`formatUnsupported`.

### Как добавить движок или формат

1. Новый движок существующего формата (например Z-machine): положить
   `engines/zmachine.js`, зарегистрировать `window.<global>` по контракту ниже,
   дописать элемент в `ENGINES.zmachine`. Больше ничего.
2. Новый формат: строка в `FORMATS` (`name` + `ext`) и запись в `ENGINES`.
   Пока движка нет — файл всё равно распознаётся и получает понятное
   «формат пока не поддерживается», а не «не понял, что это».

## Контракт модуля

`engines/<id>.js` — IIFE, который по загрузке регистрирует `window.<global>`
(для Glulx — `window.GlulxEngine`):

```js
window.GlulxEngine = {
  id: 'glulx',
  name: 'Glulx',
  version: '2.2.6',

  /* id папки сейвов по байтам игры. Вызывается ДО init. */
  getSignature: function (u8) { /* → 'строка' */ },

  /* Запуск игры. opts: { gameBytes, gameId, localize, onReady, onError } */
  init: function (opts) { /* …; opts.onReady() */ }
};
```

Обязательны `init` и `getSignature`. `init` обязан вызвать
`onReady` после старта игры или `onError(message)` при ошибке — ядро по
`onReady` включает патч сейвов, быстрые кнопки, автосохранение и т.п.

Модуль **не знает** про интерфейс плеера: палитру, i18n, кнопки, свои сейвы он
не трогает. Разрешённый DOM — `#gameport`/`#windowport` (через GlkOte).
Строки интерфейса движка приходят в `opts.localize` (карта ключ → текст).

На время работы модуль оставляет в `window` имена, которых ждёт сам GiLoad
(`GlkOteClass`, `BlorbClass`, `GiDispaClass`, инстансы `GlkOte`, `Quixe`,
`Dialog`, `Glk`, `GiLoad`) — ядро использует `Dialog` для патча сейвов и
`Quixe.get_signature()` для уточнения id игры.

## Правила

- Не ESM и не `import()`: Quixe и GlkOte — классические скрипты.
- Не подключать движки тегом `<script>` в HTML: смысл в ленивой загрузке.
- `eval` обязателен (`(0, eval)(code)`), поэтому CSP без `'unsafe-eval'` сломает загрузку.
- Не грузить все движки сразу и не забывать `engineCache` — иначе двойной `eval`.

Перезагрузка страницы нужна только для смены игры: загруженный движок в памяти
не сбросить, поэтому `reloadToPicker()` вызывается лишь когда движок уже
стартовал (`gameLoadAttempted`). Файл не того формата движка не грузит —
выбор следующего файла идёт в той же странице, без перезагрузки.

## Как добавить движок (пример: Z-machine)

1. Положить `engines/zmachine.js`, который регистрирует `window.ZMachineEngine`
   с тем же контрактом (`init`, `getSignature`).
2. Добавить в `ENGINES` ядре:

```js
zmachine: [
  { id: 'zvm', file: 'engines/zmachine.js', global: 'ZMachineEngine',
    name: 'Z-machine', version: '1.0.0' }
]
```

Больше ничего править не нужно: `detectFormat` уже возвращает `zmachine`
для `.z5`/`.z8` и для Blorb с чанком `ZCOD`, `loadEngine` подхватит новый id.

## Приёмка изменений

- До запуска игры: `window.GlulxEngine === undefined`, `window.Quixe === undefined`.
- `.gblorb` → грузится `engines/glulx.js`, игра стартует.
- Повторный запуск в той же сессии не делает второй `fetch` движка.
- `.z5` и `.txt` дают понятную ошибку, без краша.
- `window.__tqGameId` для той же игры совпадает с прежним (иначе поедут сейвы).
- В `QuestPlayer.html` нет `QuixeClass`, `GlkOteClass`, `DialogClass`,
  `BlorbClass`, `GlkClass`, `GiDispaClass`, `GiLoadClass`.
- `smoke.html` проходит (он же проверяет, что движок не загружен до старта).

Проверка в браузере: `python -m http.server` в корне проекта, открыть
`smoke.html`, нажать «Запустить тест», ждать PASS. Для реального WebView —
`assets/engines/glulx.js` в APK отдаётся тем же `WebViewAssetLoader`, что и
`assets/index.html` (адрес `https://appassets.local/engines/glulx.js`).
