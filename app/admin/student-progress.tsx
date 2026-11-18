import { Modal } from "@/app/components/sql/ui";
import type { Account } from "@/app/lib/accounts/store";
import { useSiteNames } from "@/app/lib/site-names/store";
import { modules, tasks } from "@/app/lib/sql/course";
import { getStats, isTaskStarted } from "@/app/lib/sql/progress";
import { readStudentStudy } from "@/app/lib/sql/store";
import styles from "./student-progress.module.css";

export default function StudentProgress({ student, onClose }: {
  student: Account;
  onClose: () => void;
}) {
  const name = useSiteNames();
  const study = readStudentStudy(student.id);
  const stats = study && getStats(study);

  return (
    <Modal title={name("admin.studentProgress")} onClose={onClose}>
      <p><strong>{student.name}</strong> · {student.login}</p>
      {study && stats ? (
        <>
          <p>{name("admin.studentProgressSolved")} <strong>{stats.completed} из {tasks.length}</strong>
            <br />{name("admin.studentProgressIndependent")} <strong>{stats.independent}</strong>
          </p>
          {modules.map((module) => {
            const lessons = tasks.filter((task) => task.module === module.id);
            const completed = lessons.filter((task) => study.progress[task.id]?.solvedAt).length;
            return (
              <section className={styles.module} key={module.id}>
                <h3>{name(`module.${module.id}`)} <small>{completed} из {lessons.length}</small></h3>
                <ul>
                  {lessons.map((task) => {
                    const status = study.progress[task.id]?.solvedAt
                      ? "common.solved"
                      : isTaskStarted(study, task.id) ? "common.inProgress" : "common.notStarted";
                    return <li key={task.id}><span>{name(`task.${task.id}`)}</span><span>{name(status)}</span></li>;
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
