/* booking.js — клиентская часть записи на приём.
   Слои: DATA (справочники) → API (имитация сервера, localStorage) → UI (модальное окно). */
(() => {
  'use strict';

  /* ---------- DATA: справочники ---------- */
  const SPECIALTIES = {
    cardio: 'Терапия и кардиология',
    surgery: 'Хирургия и травматология',
    pediatrics: 'Педиатрия',
    diagnostics: 'Диагностика'
  };

  const DOCTORS = [
    { id: 1, spec: 'cardio', name: 'Иванова Мария Петровна', pos: 'Кардиолог', exp: '15 лет', room: 204 },
    { id: 2, spec: 'cardio', name: 'Смирнов Алексей Игоревич', pos: 'Терапевт', exp: '9 лет', room: 207 },
    { id: 3, spec: 'surgery', name: 'Кузнецов Дмитрий Олегович', pos: 'Хирург', exp: '18 лет', room: 312 },
    { id: 4, spec: 'surgery', name: 'Орлова Елена Сергеевна', pos: 'Травматолог', exp: '11 лет', room: 315 },
    { id: 5, spec: 'pediatrics', name: 'Соколова Анна Викторовна', pos: 'Педиатр', exp: '13 лет', room: 105 },
    { id: 6, spec: 'pediatrics', name: 'Морозов Павел Андреевич', pos: 'Педиатр', exp: '7 лет', room: 106 },
    { id: 7, spec: 'diagnostics', name: 'Волков Сергей Николаевич', pos: 'Врач УЗИ', exp: '12 лет', room: 118 },
    { id: 8, spec: 'diagnostics', name: 'Лебедева Ольга Игоревна', pos: 'Врач-эндоскопист', exp: '10 лет', room: 120 }
  ];

  /* ---------- Вспомогательные функции ---------- */
  const $ = (s, root = document) => root.querySelector(s);
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const digits = s => s.replace(/\D/g, '');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = s => new Date(s + 'T00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtChip = s => new Date(s + 'T00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });

  function fmtPhone(v) {
    let d = digits(v);
    if (d[0] === '7' || d[0] === '8') d = d.slice(1);
    d = d.slice(0, 10);
    let r = '+7';
    if (d.length > 0) r += ` (${d.slice(0, 3)}`;
    if (d.length >= 3) r += ') ';
    if (d.length > 3) r += d.slice(3, 6);
    if (d.length >= 6) r += '-';
    if (d.length > 6) r += d.slice(6, 8);
    if (d.length >= 8) r += '-';
    if (d.length > 8) r += d.slice(8, 10);
    return r;
  }

  // 7 приёмных дней начиная с даты start (воскресенье — выходной)
  function workDays(start) {
    const out = [];
    const d = new Date(start + 'T00:00');
    while (out.length < 7) {
      if (d.getDay() !== 0) out.push(iso(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  /* ---------- API: имитация серверной части (localStorage) ---------- */
  const KEY = 'appointments';
  const db = {
    all() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } },
    save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }
  };

  const api = {
    getDoctors: spec => DOCTORS.filter(d => d.spec === spec),

    // Слоты с 9:00 до 17:30 через 30 минут; часть «занята» условно
    getSlots(docId, date) {
      const taken = db.all().filter(a => a.docId === docId && a.date === date).map(a => a.time);
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const slots = [];
      for (let m = 540, i = 0; m <= 1050; m += 30, i++) {
        const time = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
        const busy = (docId * 5 + Number(date.slice(-2)) + i) % 4 === 0 || taken.includes(time);
        const past = date === iso(now) && m <= nowMin;
        slots.push({ time, free: !busy && !past });
      }
      return slots;
    },

    create(rec) {
      const list = db.all();
      if (list.some(a => a.docId === rec.docId && a.date === rec.date && a.time === rec.time)) {
        throw new Error('Это время уже занято. Выберите другое.');
      }
      const item = { ...rec, id: 'A' + Date.now().toString().slice(-6) };
      list.push(item);
      db.save(list);
      return item;
    },

    byPhone: phone => db.all()
      .filter(a => digits(a.phone) === digits(phone))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),

    cancel: id => db.save(db.all().filter(a => a.id !== id))
  };

  /* ---------- UI: модальное окно ---------- */
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="modal__box" role="dialog" aria-modal="true">
      <button class="modal__close" data-action="close" aria-label="Закрыть">&times;</button>
      <div id="modalBody"></div>
    </div>`;
  document.body.appendChild(modal);
  const bodyEl = $('#modalBody', modal);

  let S = {};   // состояние: view, step, spec, doc, date, time, name, phone, error, my

  function show() { modal.hidden = false; document.body.style.overflow = 'hidden'; }
  function hide() { modal.hidden = true; document.body.style.overflow = ''; }

  function openWizard(init = {}) {
    const today = iso(new Date());
    const date = /^\d{4}-\d{2}-\d{2}$/.test(init.date || '') && init.date >= today ? init.date : today;
    S = { view: 'wizard', step: 1, spec: init.spec || '', doc: null, date, time: '',
          name: init.name || '', phone: init.phone || '', error: '', resched: init.resched || null };
    if (init.doc) {                       // врач уже известен — сразу к выбору времени
      S.doc = DOCTORS.find(d => d.id === init.doc);
      S.spec = S.doc.spec;
      S.step = 2;
    }
    render(); show();
  }

  function openMy() {
    S = { view: 'my', phone: '', list: null };
    render(); show();
  }

  function render() {
    if (S.view === 'my') return renderMy();
    const steps = ['Врач', 'Время', 'Данные', 'Готово'];
    const bar = `<ol class="steps">${steps.map((t, i) =>
      `<li class="${i + 1 === S.step ? 'is-current' : i + 1 < S.step ? 'is-done' : ''}">${i + 1}. ${t}</li>`).join('')}</ol>`;
    const err = S.error ? `<p class="form-error">${esc(S.error)}</p>` : '';
    bodyEl.innerHTML = bar + err + [null, step1, step2, step3, step4][S.step]();
  }

  // Шаг 1 — выбор специальности и врача
  function step1() {
    const opts = Object.entries(SPECIALTIES).map(([k, v]) =>
      `<option value="${k}" ${k === S.spec ? 'selected' : ''}>${v}</option>`).join('');
    const docs = S.spec ? api.getDoctors(S.spec).map(d => `
      <button class="doctor" data-action="pick-doc" data-id="${d.id}">
        <strong>${d.name}</strong>
        <span>${d.pos} · стаж ${d.exp} · кабинет ${d.room}</span>
      </button>`).join('') : '<p class="modal__hint">Выберите направление, чтобы увидеть врачей.</p>';
    return `<h3 class="modal__title">Выберите врача</h3>
      <div class="form-group"><label for="mSpec">Специальность</label>
        <select id="mSpec" data-field="spec"><option value="">Выберите направление</option>${opts}</select></div>
      <div class="doctors">${docs}</div>`;
  }

  // Шаг 2 — выбор даты и времени
  function step2() {
    const days = workDays(S.date < iso(new Date()) ? iso(new Date()) : S.date);
    if (!days.includes(S.date)) S.date = days[0];
    const chips = days.map(d => `<button class="chip ${d === S.date ? 'is-active' : ''}"
      data-action="pick-date" data-date="${d}">${fmtChip(d)}</button>`).join('');
    const slots = api.getSlots(S.doc.id, S.date);
    const grid = slots.map(s => `<button class="slot" data-action="pick-time" data-time="${s.time}"
      ${s.free ? '' : 'disabled'}>${s.time}</button>`).join('');
    const any = slots.some(s => s.free);
    return `<h3 class="modal__title">${S.doc.name}</h3>
      <p class="modal__hint">${S.doc.pos}, кабинет ${S.doc.room}. Выберите дату и время:</p>
      <div class="chips">${chips}</div>
      ${any ? `<div class="slots">${grid}</div>` : '<p class="modal__hint">На эту дату свободных окон нет.</p>'}
      <div class="modal__actions"><button class="btn btn--ghost" data-action="back">Назад</button></div>`;
  }

  // Шаг 3 — данные пациента
  function step3() {
    return `<h3 class="modal__title">Ваши данные</h3>
      <p class="modal__summary">${S.doc.name}<br>${fmtDate(S.date)}, ${S.time}</p>
      <div class="form-group"><label for="mName">ФИО</label>
        <input id="mName" type="text" placeholder="Иванов Иван Иванович" value="${esc(S.name)}"></div>
      <div class="form-group"><label for="mPhone">Телефон</label>
        <input id="mPhone" type="tel" placeholder="+7 (___) ___-__-__" value="${esc(S.phone)}" data-mask></div>
      <label class="modal__check"><input id="mConsent" type="checkbox">
        Согласен на обработку персональных данных</label>
      <div class="modal__actions">
        <button class="btn btn--ghost" data-action="back">Назад</button>
        <button class="btn btn--primary" data-action="confirm">Записаться</button>
      </div>`;
  }

  // Шаг 4 — результат
  function step4() {
    return `<div class="success">
      <div class="success__icon">✓</div>
      <h3 class="modal__title">${S.resched ? 'Запись перенесена!' : 'Вы записаны!'}</h3>
      <p class="modal__summary">${esc(S.done.name)}<br>${S.doc.name} (${S.doc.pos})<br>
        ${fmtDate(S.done.date)}, ${S.done.time}, кабинет ${S.doc.room}</p>
      <p class="modal__hint">Номер записи: <strong>${S.done.id}</strong>.
        Отменить или перенести запись можно в разделе «Мои записи».</p>
      <p class="modal__hint">🔔 SMS-напоминание придёт на ${esc(S.done.phone)} за сутки до приёма.</p>
      <button class="btn btn--primary" data-action="close">Готово</button></div>`;
  }

  // «Мои записи»
  function renderMy() {
    let list = '';
    if (S.list) {
      list = S.list.length ? S.list.map(a => {
        const d = DOCTORS.find(x => x.id === a.docId);
        return `<div class="appt"><div><strong>${fmtChip(a.date)}, ${a.time}</strong><br>
          <span>${d.name} · ${d.pos}</span></div>
          <div class="appt__btns">
            <button class="btn btn--ghost" data-action="resched" data-id="${a.id}">Перенести</button>
            <button class="btn btn--ghost" data-action="cancel" data-id="${a.id}">Отменить</button></div></div>`;
      }).join('') : '<p class="modal__hint">Записей по этому номеру не найдено.</p>';
    }
    bodyEl.innerHTML = `<h3 class="modal__title">Мои записи</h3>
      <div class="form-group"><label for="mMyPhone">Телефон, указанный при записи</label>
        <input id="mMyPhone" type="tel" placeholder="+7 (___) ___-__-__" value="${esc(S.phone)}" data-mask></div>
      <button class="btn btn--primary" data-action="find">Показать записи</button>
      <div class="appts">${list}</div>`;
  }

  /* ---------- Обработчики ---------- */
  modal.addEventListener('click', e => {
    if (e.target === modal) return hide();
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const act = el.dataset.action;

    if (act === 'close') return hide();

    if (act === 'resched') {              // перенос: тот же врач, новая дата и время
      const a = db.all().find(x => x.id === el.dataset.id);
      return openWizard({ doc: a.docId, name: a.name, phone: a.phone, resched: a.id });
    }

    if (act === 'pick-doc') { S.doc = DOCTORS.find(d => d.id === +el.dataset.id); S.step = 2; S.error = ''; }
    if (act === 'pick-date') { S.date = el.dataset.date; }
    if (act === 'pick-time') { S.time = el.dataset.time; S.step = 3; S.error = ''; }
    if (act === 'back') { saveInputs(); S.step--; S.error = ''; }

    if (act === 'confirm') {
      saveInputs();
      const consent = $('#mConsent', modal).checked;
      if (S.name.trim().split(/\s+/).length < 2) S.error = 'Введите фамилию и имя полностью.';
      else if (digits(S.phone).length !== 11) S.error = 'Введите телефон полностью.';
      else if (!consent) S.error = 'Необходимо согласие на обработку данных.';
      else {
        try {
          S.done = api.create({ docId: S.doc.id, date: S.date, time: S.time, name: S.name.trim(), phone: S.phone });
          if (S.resched) api.cancel(S.resched);   // старая запись удаляется только после успешной новой
          S.step = 4; S.error = '';
        } catch (err) { S.error = err.message; S.step = 2; }
      }
    }

    if (act === 'find') {
      S.phone = $('#mMyPhone', modal).value;
      S.list = digits(S.phone).length === 11 ? api.byPhone(S.phone) : [];
    }
    if (act === 'cancel' && confirm('Отменить запись?')) {
      api.cancel(el.dataset.id);
      S.list = api.byPhone(S.phone);
    }
    render();
  });

  modal.addEventListener('change', e => {
    if (e.target.dataset.field === 'spec') { S.spec = e.target.value; render(); }
  });

  modal.addEventListener('input', e => {
    if (e.target.hasAttribute('data-mask')) e.target.value = fmtPhone(e.target.value);
  });

  function saveInputs() {
    const n = $('#mName', modal), p = $('#mPhone', modal);
    if (n) S.name = n.value;
    if (p) S.phone = p.value;
  }

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) hide(); });

  /* ---------- Подключение к странице ---------- */
  const form = $('#bookingForm');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      openWizard({
        spec: $('#specialty').value,
        date: $('#date').value,
        phone: $('#phone').value
      });
    });
  }

  document.querySelectorAll('[data-open-booking]').forEach(a =>
    a.addEventListener('click', e => { e.preventDefault(); openWizard(); }));

  const my = $('#myBookingsLink');
  if (my) my.addEventListener('click', e => { e.preventDefault(); openMy(); });

  /* ---------- Секция «Врачи» ---------- */
  const grid = $('#doctorsGrid');
  const tabs = $('#departments');

  function renderDoctors(spec = '') {
    if (!grid) return;
    tabs.innerHTML = [['', 'Все отделения'], ...Object.entries(SPECIALTIES)].map(([k, v]) =>
      `<button class="chip ${k === spec ? 'is-active' : ''}" data-spec="${k}">${v}</button>`).join('');
    grid.innerHTML = DOCTORS.filter(d => !spec || d.spec === spec).map(d => `
      <article class="doc-card">
        <div class="doc-card__avatar" aria-hidden="true">${d.name.split(' ').slice(0, 2).map(w => w[0]).join('')}</div>
        <h3 class="doc-card__name">${d.name}</h3>
        <p class="doc-card__pos">${d.pos}</p>
        <p class="doc-card__meta">${SPECIALTIES[d.spec]}<br>Стаж ${d.exp} · кабинет ${d.room}</p>
        <button class="btn btn--primary" data-book="${d.id}">Записаться</button>
      </article>`).join('');
  }

  if (grid) {
    renderDoctors();
    tabs.addEventListener('click', e => {
      const b = e.target.closest('[data-spec]');
      if (b) renderDoctors(b.dataset.spec);
    });
    grid.addEventListener('click', e => {
      const b = e.target.closest('[data-book]');
      if (b) openWizard({ doc: +b.dataset.book });
    });
  }

  // «Подробнее» в карточках услуг → врачи нужного отделения
  const specKeys = Object.keys(SPECIALTIES);
  document.querySelectorAll('.service-card__link').forEach((a, i) =>
    a.addEventListener('click', e => {
      e.preventDefault();
      renderDoctors(specKeys[i]);
      tabs.scrollIntoView({ behavior: 'smooth' });
    }));

      /* ---------- Окно «Срочная помощь» ---------- */
  const HOSPITAL_ADDRESS = 'г. Сергиев-Посад, ул. Новоугличское ш., 62А, корп.2, 141301';   // поменяй на свой
  const EMERGENCY_PHONE = '+7 (495) 123-45-68';                // телефон приёмного отделения (условный)

  function openUrgent() {
    S = { view: 'urgent' };
    const mapUrl = 'https://yandex.ru/maps/?text=' + encodeURIComponent(HOSPITAL_ADDRESS);
    bodyEl.innerHTML = `
      <h3 class="modal__title urgent__title">Срочная помощь</h3>
      <p class="urgent__lead">При угрозе жизни немедленно звоните в скорую:</p>
      <div class="urgent__calls">
        <a class="btn urgent__btn" href="tel:103">📞 103</a>
        <a class="btn urgent__btn" href="tel:112">📞 112</a>
      </div>
      <p class="modal__hint"><strong>Звоните в скорую, если:</strong></p>
      <ul class="urgent__list">
        <li>потеря сознания или спутанность речи</li>
        <li>сильная боль в груди, затруднённое дыхание</li>
        <li>сильное кровотечение, тяжёлая травма</li>
        <li>признаки инсульта: перекос лица, слабость в руке или ноге</li>
      </ul>
      <div class="modal__summary">
        <strong>Приёмное отделение (круглосуточно)</strong><br>
        ${HOSPITAL_ADDRESS}<br>
        <a href="tel:${EMERGENCY_PHONE.replace(/[^\d+]/g, '')}">${EMERGENCY_PHONE}</a>
      </div>
      <div class="modal__actions">
        <a class="btn btn--primary" href="${mapUrl}" target="_blank" rel="noopener">Построить маршрут</a>
        <button class="btn btn--ghost" data-action="close">Закрыть</button>
      </div>`;
    show();
  }

  document.querySelectorAll('[data-open-urgent]').forEach(a =>
    a.addEventListener('click', e => { e.preventDefault(); openUrgent(); }));
})();
