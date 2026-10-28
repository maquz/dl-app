function getSeededCohortQuestions(questions, assessmentId, cohortId, seedExtra) {
  if (!questions || questions.length === 0) return [];
  let parsedQuestions = [...questions].sort((a, b) => (a.id || 0) - (b.id || 0));
  let currentSeed = Number(assessmentId || 1) * 1000 + Number(cohortId || 1);
  if (seedExtra) {
    const extraNum = String(seedExtra).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    currentSeed += extraNum;
  }
  function seededRandom() {
    let x = Math.sin(currentSeed++) * 10000;
    return x - Math.floor(x);
  }
  for (let i = parsedQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [parsedQuestions[i], parsedQuestions[j]] = [parsedQuestions[j], parsedQuestions[i]];
  }
  // For master trainer assessments (1, 2, 3), retain original 20-item cap if there are more
  if (Number(assessmentId) <= 3 && parsedQuestions.length > 20) {
    parsedQuestions = parsedQuestions.slice(0, 20);
  }
  return parsedQuestions;
}
module.exports = { getSeededCohortQuestions };

