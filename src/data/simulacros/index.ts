
import { simulacro1 } from './simulacro_1';
import { simulacro2 } from './simulacro_2';
import { Exam } from '../../../types';

export const ALL_SIMULACROS: Exam[] = [
  simulacro1,
  simulacro2
].map(exam => ({
  ...exam,
  preguntas: exam.preguntas.map(q => ({
    ...q,
    id: `${exam.id}-${q.id}`
  }))
}));
