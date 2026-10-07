export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function sanitizePlayerName(value) {
  const cleaned = String(value ?? '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
  return cleaned || 'Explorer';
}

export function generateMultipleChoice(correctAnswer, type, wilayaData, wilayaNames, random = Math.random) {
  const values = wilayaNames
    .map((name) => {
      if (type === 'name') return name;
      if (type === 'capital') return wilayaData[name]?.capital;
      if (type === 'region') return wilayaData[name]?.region;
      if (type === 'code') return wilayaData[name]?.code;
      return undefined;
    })
    .filter((value) => value !== undefined && value !== null && value !== '');

  const unique = [...new Set(values)];
  const distractors = shuffle(unique.filter((value) => value !== correctAnswer), random).slice(0, 3);
  return shuffle([correctAnswer, ...distractors], random);
}

export function isAnswerCorrect({ mode, guess, targetWilaya, triviaCorrectAnswer }) {
  if (mode === 'TRIVIA') return guess === triviaCorrectAnswer;
  if (mode === 'REVERSE') return guess === targetWilaya;
  return guess === targetWilaya;
}

export function calculatePoints(streak) {
  return 10 * Math.max(1, streak);
}
