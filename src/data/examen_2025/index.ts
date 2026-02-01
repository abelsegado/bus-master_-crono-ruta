import { testLineas } from './test_lineas';
import { testIgualdad } from './test_igualdad';
import { testOrdenanzas } from './test_ordenanzas';
import { Exam } from '../../../types';

export const EXAMENES_2025: Exam[] = [
  testLineas,
  testIgualdad,
  testOrdenanzas
].map(exam => ({
  ...exam,
  preguntas: exam.preguntas.map(q => ({
    ...q,
    id: `${exam.id}-${q.id}`
  }))
}));
