# KYRGYZ ALERTS — Файлы проекта

## Страницы

| Файл | Страница | Описание |
|------|----------|----------|
| `1-landing.html` | Лендинг | Главная страница сайта |
| `2-obs-widget.html` | OBS Виджет | Алерт для Browser Source в OBS |
| `3-styles.html` | Стили | Галерея стилей алертов |
| `4-dashboard.html` | Дашборд | Личный кабинет стримера |
| `5-donate.html` | Донат | Страница доната для зрителей |

## Как подключить OBS виджет

1. Открой OBS → Sources → Add → Browser Source
2. Укажи URL: путь к файлу `2-obs-widget.html` (или хостинг URL)
3. Размер: 800x400
4. В Custom CSS добавь:
   ```css
   .demo-bar { display: none !important; }
   body { background: transparent !important; }
   ```

## Цвета бренда

- Основной фиолетовый: `#7C3AED`
- Светлый фиолетовый: `#9F7AEA` / `#A78BFA`
- Фон тёмный: `#0D0B1A`
- Фон сайдбара: `#0A0816`

## Следующие шаги

- [ ] Бэкенд: Node.js / Laravel
- [ ] База данных: PostgreSQL
- [ ] Mbank webhook интеграция
- [ ] WebSocket для реалтайм алертов
- [ ] Хостинг: kyrgyzalerts.kg
