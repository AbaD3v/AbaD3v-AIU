import type { Task } from "./course";
import { trainingTask, type TrainingDatabase } from "./training-database";
import { referenceCardKey, resolveName, type NameValues } from "../site-names/registry";

/** Adapt shipped examples to the training database; explicit card edits take precedence. */
export function resolveReferenceCard(task: Task, values: NameValues, config: TrainingDatabase) {
  const defaults = trainingTask(task, config);
  return {
    title: resolveName(referenceCardKey(task.id, "title"), values),
    tags: values[referenceCardKey(task.id, "tags")] ?? defaults.tags.join(" / "),
    theory: values[referenceCardKey(task.id, "theory")] ?? defaults.theory,
    example: values[referenceCardKey(task.id, "example")] ?? defaults.example,
  };
}
