"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { examples, languages, type Language } from "../lib/languages";
import { createLesson, parseWorkspace, workspaceKey, type Workspace } from "../lib/workspace";
import { useSession } from "./session-provider";
import AuthScreen from "./auth-screen";
import { Icon } from "./ui-icon";
import s from "./study-tools.module.css";

type Section = "history" | "examples" | "notes" | "checklist";
const headings = {
  history: ["Мои занятия", "Возвращайся к своему коду и продолжай разговор с того же места."],
  examples: ["Библиотека примеров", "Один алгоритм на разных языках. Выбирай, сравнивай и разбирайся."],
  notes: ["Мои заметки", "Сохраняй объяснения, вопросы и выводы после практики."],
  checklist: ["Готовность к защите", "Проверь себя перед встречей с преподавателем. Отмечай то, что уже можешь объяснить."],
};
const checklist = [
  ["Задача программы", "Могу своими словами объяснить, какую задачу решает мой код."],
  ["Переменные и типы", "Знаю, что хранит каждая переменная и почему выбран этот тип."],
  ["Условия и циклы", "Могу пройти по коду вручную и объяснить каждую итерацию."],
  ["Результат работы", "Могу предсказать результат для обычных и граничных входных данных."],
  ["Изменение кода", "Понимаю, как изменится результат при изменении условия или начального значения."],
  ["Ошибки и улучшения", "Могу назвать ограничения программы и предложить улучшение."],
];
function subscribe(fn: () => void) { window.addEventListener("storage",fn);window.addEventListener("codeproof-tools",fn);return()=>{window.removeEventListener("storage",fn);window.removeEventListener("codeproof-tools",fn);}; }
function read(key: string) { try{return localStorage.getItem(key);}catch{return null;} }
function useStored(key: string) {return useSyncExternalStore(subscribe,()=>read(key),()=>null);}
function parseNotes(raw: string|null): {id:string;title:string;text:string}[] {try{const v=JSON.parse(raw||"[]");return Array.isArray(v)?v.filter(n=>n&&typeof n.id==="string"&&typeof n.title==="string"&&typeof n.text==="string"):[];}catch{return [];}}
function parseChecks(raw: string|null): number[] {try{const v=JSON.parse(raw||"[]");return Array.isArray(v)?[...new Set(v.filter((n:unknown)=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<checklist.length))] as number[]:[];}catch{return [];}}

function ToolsContent({section,accountId}:{section:Section;accountId:string}) {
  const router=useRouter();
  const key=workspaceKey(accountId);
  const workspace=parseWorkspace(useStored(key));
  const notesKey=`codeproof.notes.v1.${accountId}`;
  const checksKey=`codeproof.checklist.v1.${accountId}`;
  const notes=parseNotes(useStored(notesKey));
  const checked=parseChecks(useStored(checksKey));
  const [query,setQuery]=useState("");
  const [language,setLanguage]=useState<Language>("Python");
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [editing,setEditing]=useState<string|null>(null);
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  function save(storageKey:string,value:unknown){try{localStorage.setItem(storageKey,JSON.stringify(value));window.dispatchEvent(new Event("codeproof-tools"));setError("");return true;}catch{setError("Не удалось сохранить данные. Проверь настройки и свободное место в браузере.");return false;}}
  function currentWorkspace(){const raw=read(key);const value=parseWorkspace(raw);if(raw&&!value){setError("Сохранённые занятия не удалось прочитать. Открой рабочее пространство, чтобы восстановить данные.");return undefined;}return value;}
  function openLesson(id:string){const latest=currentWorkspace();if(latest&&latest.lessons.some(l=>l.id===id)&&save(key,{...latest,activeId:id}))router.push("/");}
  function addExample(){const latest=currentWorkspace();if(latest===undefined)return;if(latest&&latest.lessons.length>=20){setError("Достигнут лимит 20 занятий. Удали ненужное занятие в истории перед добавлением примера.");return;}const lesson=createLesson(language,true);const next:Workspace={version:2,activeId:lesson.id,lessons:[lesson,...(latest?.lessons??[])]};if(save(key,next))router.push("/");}
  function removeLesson(id:string){if(!confirm("Удалить занятие вместе с кодом и диалогом?"))return;const latest=currentWorkspace();if(!latest)return;const remaining=latest.lessons.filter(l=>l.id!==id);if(!remaining.length)remaining.push(createLesson(language));if(save(key,{...latest,lessons:remaining,activeId:remaining.some(l=>l.id===latest.activeId)?latest.activeId:remaining[0].id}))setNotice("Занятие удалено.");}
  const filtered=workspace?.lessons.filter(l=>`${l.title} ${l.language}`.toLowerCase().includes(query.toLowerCase()))??[];
  return <main className={s.page}>
    <header className={s.top}><Link href="/" className={s.back}>← Рабочее пространство</Link><span className={s.badge}>Твой CodeProof</span></header>
    <span className={s.eyebrow}>МАЛЕНЬКИЕ ШАГИ К УВЕРЕННОСТИ</span><h1>{headings[section][0]}<span>.</span></h1><p className={s.subtitle}>{headings[section][1]}</p>
    {error&&<p className={s.error} role="alert">{error}</p>}{notice&&<p className={s.notice} role="status">{notice}</p>}
    {section==="history"&&<><div className={s.toolbar}><label className={s.search}>Поиск занятия<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название или язык…"/></label><span className={s.badge}>{workspace?.lessons.length??0} / 20 занятий</span></div><div className={s.list}>{filtered.map(lesson=><article className={s.card} key={lesson.id}><div className={s.cardRow}><span className={s.symbol}><Icon name="code"/></span><div className={s.grow}><h2>{lesson.title}</h2><p>{lesson.language} · {lesson.code.split("\n").length} строк · {lesson.answered} ответов</p></div>{workspace?.activeId===lesson.id&&<span className={s.badge}>Текущее</span>}</div><div className={s.actions}><button className={s.primary} onClick={()=>openLesson(lesson.id)}>Продолжить <Icon name="arrow" size={16}/></button><button className={s.secondary} onClick={()=>removeLesson(lesson.id)}>Удалить</button></div></article>)}</div>{!filtered.length&&<div className={s.empty}><Icon name="clock" size={32}/><h2>{query?"Ничего не найдено":"Начнём первое занятие?"}</h2><p>{query?"Попробуй другое название или язык.":"Твой код и разговор появятся здесь после сохранения в рабочем пространстве."}</p><Link className={s.primary} href="/">К моему коду →</Link></div>}</>}
    {section==="examples"&&<div className={s.columns}><section className={s.card}><span className={s.badge}>Циклы + условия</span><h2>Сумма чётных чисел</h2><p>Пройди по числам 1, 2, 3, 4. Условие пропускает нечётные числа, а переменная total накапливает сумму. Результат: 6.</p><label className={s.field}>Язык примера<select value={language} onChange={e=>setLanguage(e.target.value as Language)}>{languages.map(l=><option key={l.name}>{l.name}</option>)}</select></label><div className={s.tip}><b>Попробуй объяснить</b><p>Зачем нужен остаток от деления? Что получится, если суммировать нечётные числа?</p></div><button className={s.primary} onClick={addExample}>Открыть как новое занятие <Icon name="arrow" size={16}/></button><p className={s.small}>Текущий код останется в истории. Пример не запускает программу.</p></section><section className={s.codeCard} aria-label="Код примера"><div className={s.codeHeader}><Icon name="code" size={18}/><span>example.{languages.find(l=>l.name===language)?.extension}</span><button onClick={async()=>{try{await navigator.clipboard.writeText(examples[language]);setNotice("Код скопирован.");}catch{setError("Не удалось скопировать. Выдели код и скопируй вручную.");}}}>Копировать</button></div><pre><code>{examples[language]}</code></pre></section></div>}
    {section==="notes"&&<div className={s.columns}><form className={s.card} onSubmit={e=>{e.preventDefault();if(!title.trim()||!body.trim()){setError("Заполни название и текст заметки.");return;}const latest=parseNotes(read(notesKey));if(!editing&&latest.length>=100){setError("Можно хранить до 100 заметок. Удали ненужную заметку.");return;}const note={id:editing??crypto.randomUUID(),title:title.trim(),text:body.trim()};if(save(notesKey,[note,...latest.filter(n=>n.id!==note.id)])){setTitle("");setBody("");setEditing(null);setNotice("Заметка сохранена.");}}}><h2>{editing?"Редактировать заметку":"Запиши, пока помнишь"}</h2><label className={s.field}>Название<input required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Например: как работает цикл"/></label><label className={s.field}>Твоя заметка<textarea required maxLength={5000} rows={8} value={body} onChange={e=>setBody(e.target.value)} placeholder="Что стало понятно? Что спросить у преподавателя?"/></label><div className={s.actions}><button className={s.primary}>Сохранить</button>{editing&&<button type="button" className={s.secondary} onClick={()=>{setEditing(null);setTitle("");setBody("");}}>Отменить</button>}</div></form><section className={s.list} aria-label="Сохранённые заметки">{!notes.length&&<div className={s.empty}><Icon name="book" size={30}/><h2>Здесь будут твои мысли</h2><p>Добавь первую заметку в форме слева.</p></div>}{notes.map(note=><article key={note.id} className={s.card}><h2>{note.title}</h2><p className={s.noteText}>{note.text}</p><div className={s.actions}><button className={s.secondary} onClick={()=>{setEditing(note.id);setTitle(note.title);setBody(note.text);}}>Изменить</button><button className={s.secondary} onClick={()=>{if(confirm("Удалить заметку?")){if(save(notesKey,parseNotes(read(notesKey)).filter(n=>n.id!==note.id))){if(editing===note.id){setEditing(null);setTitle("");setBody("");}setNotice("Заметка удалена.");}}}}>Удалить</button></div></article>)}</section></div>}
    {section==="checklist"&&<><section className={s.progressCard}><div><span className={s.eyebrow}>МОЯ САМОПРОВЕРКА</span><h2>{checked.length} из {checklist.length} шагов</h2><p>{checked.length===checklist.length?"Всё отмечено! Попробуй объяснить программу вслух без подсказок.":"Отмечай пункты после практики. Это твоя самооценка, а не оценка ИИ."}</p></div><progress value={checked.length} max={checklist.length} aria-label="Готовность к защите"/></section><div className={s.list}>{checklist.map(([label,description],i)=><label className={`${s.check} ${checked.includes(i)?s.done:""}`} key={label}><input type="checkbox" checked={checked.includes(i)} onChange={()=>{const latest=parseChecks(read(checksKey));save(checksKey,latest.includes(i)?latest.filter(n=>n!==i):[...latest,i]);}}/><span><b>{label}</b><span>{description}</span></span></label>)}</div><div className={s.actions}><Link href="/" className={s.primary}>Потренироваться с кодом →</Link><button className={s.secondary} disabled={!checked.length} onClick={()=>{if(confirm("Снять все отметки для новой подготовки?"))save(checksKey,[]);}}>Сбросить отметки</button></div></>}
    <footer className={s.footer}>Сохраняется в этом браузере для текущего учебного профиля. Очистка данных браузера удалит записи.</footer>
  </main>;
}
export default function StudyTools({section}:{section:Section}){const {account}=useSession();return account?<ToolsContent key={`${account.id}-${section}`} accountId={account.id} section={section}/>:<AuthScreen/>;}
