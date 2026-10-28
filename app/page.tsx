"use client";

import { useState } from "react";
import styles from "./page.module.css";

const answers = ["6", "10", "15", "Ошибка"];

export default function Home() {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.logo} href="#top" aria-label="CodeProof — главная"><span className={styles.logoMark}>&lt;/&gt;</span> code<span>proof</span><i>.</i></a>
        <nav className={styles.nav} aria-label="Навигация"><a href="#how">Как это работает</a><a href="#practice">Практика</a><a href="#demo">Пример задания</a></nav>
        <a className={styles.headerButton} href="#demo">Попробовать <span>↗</span></a>
      </header>

      <main id="top">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}><span /> ТВОЙ КОД. ТВОЯ УВЕРЕННОСТЬ.</div>
            <h1>Понимай код.<br /><em>Защищай</em> уверенно<span className={styles.dot}>.</span></h1>
            <p>Подготовься к защите лабораторной работы: разбирай свой код, отвечай на вопросы и учись на ошибках.</p>
            <div className={styles.heroActions}><a className={styles.primaryButton} href="#demo">Попробовать задание <span>↗</span></a><a className={styles.textLink} href="#how">Как это работает <span>↓</span></a></div>
            <div className={styles.heroFoot}><span className={styles.avatarStack}><b>А</b><b>М</b><b>Д</b></span><span>Практика для студентов<br /><strong>перед защитой кода</strong></span></div>
          </div>
          <div className={styles.codeVisual} aria-label="Пример разбора кода">
            <div className={styles.windowTop}><div className={styles.windowDots}><i /><i /><i /></div><span>your_code.py</span><span className={styles.windowTag}>PYTHON</span></div>
            <div className={styles.codeLines}><div><small>01</small><code><b>def</b> calculate(numbers):</code></div><div><small>02</small><code>    total = <strong>0</strong></code></div><div className={styles.highlight}><small>03</small><code>    <b>for</b> number <b>in</b> numbers:</code></div><div className={styles.highlight}><small>04</small><code>        total += number</code></div><div><small>05</small><code>    <b>return</b> total</code></div><div><small>06</small><code> </code></div><div><small>07</small><code>print(calculate([<strong>2</strong>, <strong>3</strong>, <strong>5</strong>]))</code></div></div>
            <div className={styles.visualQuestion}><span className={styles.questionIcon}>✦</span><div><small>ВОПРОС ПО КОДУ</small><p>Что делает этот цикл?</p><span>Строки 03–04</span></div><b>↗</b></div>
            <div className={styles.visualNote}><span>✳</span> Разбирайся в каждой строке</div>
          </div>
        </section>

        <section className={styles.strip} aria-label="Возможности"><span><b>01</b> ВСТАВЬ СВОЙ КОД</span><i>✳</i><span><b>02</b> ОТВЕЧАЙ НА ВОПРОСЫ</span><i>✳</i><span><b>03</b> УЗНАЙ, ЧТО ПОВТОРИТЬ</span></section>

        <section id="how" className={styles.section}>
          <div className={styles.sectionHeading}><div><div className={styles.label}>/ КАК ЭТО РАБОТАЕТ</div><h2>От кода к пониманию<span>.</span></h2></div><p>Три простых шага, чтобы подготовиться к вопросам преподавателя.</p></div>
          <div className={styles.steps}><article><span className={styles.stepNo}>01 / КОД</span><div className={styles.stepIcon}>⌘</div><h3>Добавь свою работу</h3><p>Вставь код, выбери язык и уровень сложности для тренировки.</p></article><article><span className={styles.stepNo}>02 / ПРАКТИКА</span><div className={styles.stepIcon}>? <span>↗</span></div><h3>Ответь на вопросы</h3><p>Объясни, как работают фрагменты кода, и предскажи результат изменений.</p></article><article><span className={styles.stepNo}>03 / РАЗБОР</span><div className={styles.stepIcon}>✓</div><h3>Разбери ошибки</h3><p>Получи обратную связь и узнай, какие темы стоит повторить.</p></article></div>
        </section>

        <section id="practice" className={styles.practice}><div className={styles.practiceCopy}><div className={styles.label}>/ НЕ ПРОСТО ЗАПОМНИТЬ</div><h2>Главное —<br /><em>понять, как это работает.</em></h2><p>На защите важно не только написать программу, но и объяснить её. Тренируйся на знакомом коде и готовься к вопросам заранее.</p><div className={styles.tags}><span>JavaScript</span><span>Python</span><span>Java</span></div></div><div className={styles.practiceArt}><span className={styles.orbit}>✳</span><div className={styles.practiceCard}><small>ПОДГОТОВКА К ЗАЩИТЕ</small><strong>Понимание<br />начинается<br />с вопроса<span>.</span></strong><div><span>CODEPROOF / PRACTICE</span><b>↗</b></div></div></div></section>

        <section id="demo" className={`${styles.section} ${styles.demoSection}`}><div className={styles.sectionHeading}><div><div className={styles.label}>/ ПОПРОБУЙ СЕЙЧАС</div><h2>Небольшая практика<span>.</span></h2></div><p>Пример вопроса, который поможет проверить понимание кода.</p></div><div className={styles.demo}><div className={styles.demoCode}><div className={styles.demoTop}><span>ПРИМЕР КОДА</span><span>PYTHON</span></div><pre><code>{"numbers = [2, 3, 5]\ntotal = 0\n\nfor number in numbers:\n    total += number\n\nprint(total)"}</code></pre></div><div className={styles.quiz}><div className={styles.quizTop}><span>МИНИ-ТЕСТ</span><span>01 / 01</span></div><h3>Что выведет программа?</h3><p>Выбери один вариант ответа.</p><div className={styles.answers}>{answers.map((answer, index) => <button key={answer} type="button" onClick={() => { setSelected(answer); setChecked(false); }} className={`${styles.answer} ${selected === answer ? styles.selected : ""}`} aria-pressed={selected === answer}><span>{String.fromCharCode(65 + index)}</span>{answer}<i>{selected === answer ? "●" : "○"}</i></button>)}</div><button className={styles.checkButton} type="button" disabled={!selected} onClick={() => setChecked(true)}>Проверить ответ <span>↗</span></button>{checked && <div className={styles.feedback} role="status"><strong>{selected === "10" ? "Верно!" : "Почти! Правильный ответ — 10."}</strong> Цикл складывает все числа: 2 + 3 + 5 = 10.</div>}</div></div><p className={styles.demoNote}>Это демонстрационное задание. Ответы не сохраняются.</p></section>
      </main>
      <footer className={styles.footer}><a className={styles.logo} href="#top"><span className={styles.logoMark}>&lt;/&gt;</span> code<span>proof</span><i>.</i></a><p>Учись понимать свой код.</p><span>СДЕЛАНО ДЛЯ СТУДЕНТОВ ✳</span></footer>
    </div>
  );
}
