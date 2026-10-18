const DAY_MS = 24 * 60 * 60 * 1000;

const templates = [
  {
    kind: 'practice',
    title: goal => `Practice a core step for ${goal}`,
    details: 'Work through one focused example and write down what you learned.',
    minutes: 45,
  },
  {
    kind: 'milestone',
    title: goal => `Build a first version of ${goal}`,
    details: 'Create a small, reviewable deliverable that moves the goal forward.',
    minutes: 60,
  },
  {
    kind: 'review',
    title: goal => `Review progress on ${goal}`,
    details: 'Check the result, note what is complete, and choose the next improvement.',
    minutes: 30,
  },
];

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function generateGoalPracticePlan(goal, now = new Date()) {
  const title = goal.title.trim();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const requestedTarget = goal.targetDate ? new Date(`${goal.targetDate}T00:00:00`) : null;
  const target = requestedTarget && requestedTarget > today
    ? requestedTarget
    : new Date(today.getTime() + 7 * DAY_MS);
  const availableDays = Math.max(1, Math.ceil((target - today) / DAY_MS));

  return templates.map((template, index) => {
    const dayOffset = Math.min(availableDays, Math.max(1, Math.round(availableDays * (index + 1) / templates.length)));
    const due = new Date(today.getTime() + dayOffset * DAY_MS);
    return {
      kind: template.kind,
      title: template.title(title),
      details: template.details,
      minutes: template.minutes,
      dueDate: localDate(due),
      completed: false,
      createdAt: now.toISOString(),
      quiz: createGoalPracticeQuiz(title, template.title(title), template.kind),
    };
  });
}

export function createGoalPracticeQuiz(goalTitle, taskTitle, kind = 'practice') {
  const goal = goalTitle.trim();
  const task = taskTitle.trim();
  return [
    {
      prompt: `Which result best shows progress on "${task}" for your goal "${goal}"?`,
      options: [
        'A list of unrelated ideas without taking an action',
        'A small deliverable that directly advances the goal and can be reviewed',
        'Repeating the same step without checking its result',
        'Waiting until the target date before beginning',
      ],
      answerIndex: 1,
      explanation: 'A reviewable result tied to the goal is evidence of real progress.',
    },
    {
      prompt: `How should you check work completed for "${task}"?`,
      options: [
        'Assume it works because it took time to complete',
        'Skip checking so you can move on faster',
        'Compare it with the goal, test a realistic example, and note the outcome',
        'Change several parts at once without recording what changed',
      ],
      answerIndex: 2,
      explanation: 'Checking the result against the goal makes progress measurable and exposes gaps.',
    },
    {
      prompt: kind === 'review'
        ? `Your review of "${goal}" finds a gap. What is the best next step?`
        : `If you get blocked while working on "${task}", what should you do?`,
      options: [
        'Abandon the goal without reviewing your options',
        'Mark the task complete without doing or checking the work',
        'Repeat the blocked step unchanged and avoid asking why it failed',
        'Break the gap into a smaller next action and record what would count as done',
      ],
      answerIndex: 3,
      explanation: 'A concrete next action keeps the goal moving and makes completion verifiable.',
    },
  ];
}

export function gradeGoalPracticeQuiz(quiz, answers) {
  if (!Array.isArray(quiz) || quiz.length === 0 || !Array.isArray(answers) || answers.length !== quiz.length) {
    return null;
  }
  const correct = quiz.reduce((total, question, index) =>
    total + (Number(answers[index]) === question.answerIndex ? 1 : 0), 0);
  return {
    correct,
    total: quiz.length,
    score: Math.round(correct / quiz.length * 100),
    feedback: quiz.map((question, index) => ({
      correct: Number(answers[index]) === question.answerIndex,
      explanation: question.explanation,
    })),
  };
}

export function goalProgressFromTasks(baseline, tasks) {
  if (!tasks.length) return Math.round(Math.max(0, Math.min(100, baseline)));
  const completed = tasks.filter(task => task.completed).length;
  const start = Math.max(0, Math.min(100, baseline));
  return Math.round(start + (100 - start) * completed / tasks.length);
}

export function goalProgressBaseline(progress, tasks) {
  const value = Math.max(0, Math.min(100, progress));
  if (!tasks.length) return Math.round(value);
  const completionRatio = tasks.filter(task => task.completed).length / tasks.length;
  if (completionRatio === 1) return Math.round(value);
  return Math.round(Math.max(0, Math.min(100, (value - completionRatio * 100) / (1 - completionRatio))));
}
