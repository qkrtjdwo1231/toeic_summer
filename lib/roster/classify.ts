import { CLASS_TYPES } from "./classes";
import type { ClassifiedClassType, RawRosterRow } from "./types";

export function classifyStudents(
  students: RawRosterRow[]
): ClassifiedClassType[] {
  return CLASS_TYPES.map((classType) => ({
    classType,
    am: students.filter((s) => s.appliedClass === classType.amRawName),
    pm: students.filter((s) => s.appliedClass === classType.pmRawName),
  }));
}
