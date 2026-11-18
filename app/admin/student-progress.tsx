import { Modal } from "@/app/components/sql/ui";
import type { Account } from "@/app/lib/accounts/store";
import { modules, tasks } from "@/app/lib/sql/course";
import { getStats, isTaskStarted } from "@/app/lib/sql/progress";
import { readStudentStudy } from "@/app/lib/sql/store";
import styles from "./student-progress.module.css";

export default function StudentProgress({ student, onClose }: {
  student: Account;
  onClose: () => void;
}) {
  const study = readStudentStudy(student.id);
  const stats = study && getStats(study);

  return (
    <Modal title="Прогресс студента" onClose={onClose}>
      <p><strong>{student.name}</strong> · {student.login}</p>
      {study && stats ? (
        <>
          <p>Решено всего: <strong>{stats.completed} из {tasks.length}</strong>
            <br />Решено самостоятельно: <strong>{stats.independent}</strong>
          </p>
          {modules.map((module) => {
            const lessons = tasks.filter((task) => task.module === module.id);
            const completed = lessons.filter((task) => study.progress[task.id]?.solvedAt).length;
            return (
              <section className={styles.module} key={module.id}>
                <h3>{module.title} <small>{completed} из {lessons.length}</small></h3>
                <ul>
                  {lessons.map((task) => {
                    let status = "Не начато";
                    if (study.progress[task.id]?.solvedAt) status = "Решено";
                    else if (isTaskStarted(study, task.id)) status = "В процессе";
                    return <li key={task.id}><span>{task.title}</span><span>{status}</span></li>;
                  })}
                </ul>
              </section>
            );
          })}
        </>
      ) : <p role="status">Данные недоступны</p>}
    </Modal>
  );
}
