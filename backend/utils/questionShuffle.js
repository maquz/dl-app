function getSeededCohortQuestions(questions, assessmentId, cohortId) {
  if (!questions || questions.length === 0) return [];
  let parsedQuestions = [...questions].sort((a, b) => (a.id || 0) - (b.id || 0));
  let currentSeed = Number(assessmentId || 1) * 1000 + Number(cohortId || 1);
  function seededRandom() {
    let x = Math.sin(currentSeed++) * 10000;
    return x - Math.floor(x);
  }
  for (let i = parsedQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [parsedQuestions[i], parsedQuestions[j]] = [parsedQuestions[j], parsedQuestions[i]];
  }
  if (parsedQuestions.length > 20) parsedQuestions = parsedQuestions.slice(0, 20);
  return parsedQuestions;
}
module.exports = { getSeededCohortQuestions };
