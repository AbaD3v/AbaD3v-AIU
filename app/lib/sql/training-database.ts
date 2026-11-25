import type { Task } from "./course";
import { createShopData, shopData, tables, type Cell } from "./schema";

export type TrainingDatabase = {
  names: Record<string, string>;
  rows: Record<string, Cell[][]>;
};

export const defaultTrainingDatabase: TrainingDatabase = { names: {}, rows: {} };
const identifiers = new Set(tables.flatMap(table => [table.name, ...table.fields.map(field => field.name)]));

export function databaseIdentifier(config: TrainingDatabase, name: string) {
  return Object.hasOwn(config.names, name) ? config.names[name] : name;
}

export function parseTrainingDatabase(value: unknown): TrainingDatabase {
  if (!value || typeof value !== "object" || !("names" in value) || !("rows" in value)
      || !value.names || typeof value.names !== "object" || Array.isArray(value.names)
      || !value.rows || typeof value.rows !== "object" || Array.isArray(value.rows)) {
    throw new Error("Некорректный формат учебной базы.");
  }

  const names: Record<string, string> = {};
  const used = new Set<string>();
  for (const [original, name] of Object.entries(value.names)) {
    if (!identifiers.has(original) || typeof name !== "string" || !/^[a-z][a-z0-9_]{0,47}$/.test(name)
        || name.startsWith("sqlite_") || (identifiers.has(name) && original !== name) || used.has(name)) {
      throw new Error(`Недопустимое или повторяющееся имя: ${String(name)}.`);
    }
    if (name !== original) names[original] = name;
    used.add(name);
  }

  const rows: TrainingDatabase["rows"] = {};
  for (const [key, entries] of Object.entries(value.rows)) {
    const table = tables.find(item => item.name === key);
    if (!table || !Array.isArray(entries) || entries.length > 500) {
      throw new Error(`В таблице ${key} должно быть не больше 500 строк.`);
    }
    const ids = new Set<number>();
    for (const [index, row] of entries.entries()) {
      if (!Array.isArray(row) || row.length !== table.fields.length) {
        throw new Error(`${key}, строка ${index + 1}: число ячеек не совпадает со схемой.`);
      }
      for (const [column, field] of table.fields.entries()) {
        const cell: unknown = row[column];
        const valid = field.type === "TEXT"
          ? typeof cell === "string" && cell.length <= 2000
          : typeof cell === "number" && Number.isFinite(cell)
            && (field.type !== "INTEGER" || Number.isSafeInteger(cell))
            && (!field.key || (cell > 0 && cell <= 1_000_000_000));
        if (!valid) throw new Error(`${key}, строка ${index + 1}, ${field.name}: ожидается ${field.type}.`);
      }
      if (ids.has(row[0])) throw new Error(`${key}: повторяется ID ${row[0]}.`);
      ids.add(row[0]);
    }
    if (JSON.stringify(entries) !== JSON.stringify(shopData[key])) rows[key] = entries;
  }

  const config = { names, rows };
  if (new TextEncoder().encode(JSON.stringify(config)).length > 450_000) {
    throw new Error("Учебная база слишком большая. Сократите число строк или длину значений.");
  }
  return config;
}

export function trainingRows(config: TrainingDatabase, variant = 0) {
  const data = createShopData(variant);
  if (!variant) return { ...data, ...config.rows };

  const shift = variant * 100;
  for (const table of tables) {
    const custom = config.rows[table.name];
    if (!custom) continue;
    const original = new Map(shopData[table.name].map(row => [row[0], row]));
    const hidden = new Map(data[table.name].map(row => [Number(row[0]) - shift, row]));
    const customIds = new Set(custom.map(row => row[0]));
    const revised = custom.map(row => {
      const base = original.get(row[0]);
      const alternate = hidden.get(Number(row[0]));
      return row.map((cell, index) => {
        if (base && alternate && cell === base[index]) return alternate[index];
        return table.fields[index].key ? Number(cell) + shift : cell;
      });
    });
    for (const [id, row] of hidden) {
      if (!original.has(id) && !customIds.has(id)) revised.push(row);
    }
    data[table.name] = revised;
  }

  // Retain the base reference when a hidden variant points to a removed parent.
  // Variant-only rows can be omitted when their parent no longer exists.
  for (const table of tables) {
    const base = new Map((config.rows[table.name] ?? shopData[table.name]).map(row => [Number(row[0]) + shift, row]));
    const references = table.fields.flatMap((field, index) => field.reference
      ? [{ index, ids: new Set(data[field.reference.split(".")[0]].map(row => row[0])) }]
      : []);
    data[table.name] = data[table.name].filter(row => references.every(({ index, ids }) => {
      if (ids.has(row[index])) return true;
      const original = base.get(Number(row[0]));
      if (!original) return false;
      row[index] = Number(original[index]) + shift;
      return true;
    }));
  }
  return data;
}

export function trainingTables(config: TrainingDatabase) {
  return tables.map(table => ({
    ...table,
    originalName: table.name,
    name: databaseIdentifier(config, table.name),
    description: renameText(table.description, config),
    fields: table.fields.map(field => ({
      ...field,
      name: databaseIdentifier(config, field.name),
      reference: field.reference?.split(".").map(part => databaseIdentifier(config, part)).join("."),
    })),
  }));
}

function renameText(text: string, config: TrainingDatabase) {
  return text.replace(/[a-z_][a-z0-9_]*/gi, word => databaseIdentifier(config, word));
}

export function trainingSql(sql: string, config: TrainingDatabase) {
  // Preserve literals, comments and already quoted tokens in course snippets.
  return sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|[a-z_][a-z0-9_]*/gi, token => {
    const name = databaseIdentifier(config, token.toLowerCase());
    return name === token.toLowerCase() ? token : `"${name}"`;
  });
}

export function trainingTask(task: Task, config: TrainingDatabase): Task {
  return {
    ...task,
    tables: task.tables.map(name => databaseIdentifier(config, name)),
    columns: task.columns.map(name => databaseIdentifier(config, name)),
    starter: trainingSql(task.starter, config),
    example: trainingSql(task.example, config),
    solution: trainingSql(task.solution, config),
    description: renameText(task.description, config),
    requirement: renameText(task.requirement, config),
    theory: renameText(task.theory, config),
    explanation: renameText(task.explanation, config),
    hints: task.hints.map(hint => renameText(hint, config)),
  };
}
