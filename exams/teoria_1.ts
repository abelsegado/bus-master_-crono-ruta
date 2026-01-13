
import { Exam } from '../types';

export const teoria1: Exam = {
  id: "teoria-1",
  examen: "Teoría I - Convocatoria EMT 2026",
  temario: "Líneas 3-8-11-N1, Ordenanza Art. 1-10, Plan de Igualdad hasta Eje 1",
  preguntas: [
    {
      id: 1,
      enunciado: "Línea 3, parada Cmno. del Pato, ¿cuál es la siguiente parada?",
      opciones: ["a) Av. Gregorio Prieto", "b) Av. Gregorio Diego", "c) Av. Los Guindos", "d) Ninguna es correcta"],
      respuesta: "b"
    },
    {
      id: 2,
      enunciado: "¿Cuántas paradas tiene la Línea 3 en Av. Juan Sebastián Elcano dirección Puerta Blanca?",
      opciones: ["a) 5", "b) 6", "c) 7", "d) 8"],
      respuesta: "d"
    },
    {
      id: 3,
      enunciado: "¿Cuál es el artículo de la Ordenanza que define el objeto de la misma?",
      opciones: ["a) Artículo 1", "b) Artículo 5", "c) Artículo 10", "d) Artículo 2"],
      respuesta: "a"
    },
    {
      id: 4,
      enunciado: "En el Plan de Igualdad, el Eje 1 se centra principalmente en:",
      opciones: ["a) Selección y Contratación", "b) Formación y Promoción", "c) Conciliación", "d) Comunicación y Lenguaje No Sexista"],
      respuesta: "d"
    },
    {
      id: 5,
      enunciado: "La línea N1 en horario nocturno, ¿qué frecuencia aproximada tiene los fines de semana?",
      opciones: ["a) 15 minutos", "b) 30 minutos", "c) 45 minutos", "d) 60 minutos"],
      respuesta: "b"
    }
  ]
};
