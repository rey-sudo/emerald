<script setup>
/**
 * QuizCard.vue
 * ─────────────────────────────────────────────
 * Pure quiz component. Owns only UI state.
 * Data fetching and persistence are the parent's concern.
 *
 * Props
 *   questions  – Array<{ question, options, correct, explanation }>  (required)
 *   title      – String   (default: 'Quiz')
 *   subtitle   – String   (default: '')
 *
 * Emits
 *   answer(payload)    – fired after each selection
 *     payload: { index: Number, selected: Number, correct: Number, isCorrect: Boolean }
 *
 *   complete(payload)  – fired when the last question is answered and user advances
 *     payload: { score: Number, total: Number, pct: Number, answers: Array }
 */

import { ref, computed } from "vue";

// ── Props & Emits ────────────────────────────────────────────────
const props = defineProps({
  questions: {
    type: Array,
    required: true,
    validator: (qs) =>
      qs.every(
        (q) =>
          typeof q.question === "string" &&
          Array.isArray(q.options) &&
          typeof q.correct === "number" &&
          typeof q.explanation === "string",
      ),
  },
  title: {
    type: String,
    default: "Quiz",
  },
  subtitle: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["answer", "complete"]);

// ── Internal state ───────────────────────────────────────────────
const currentIndex = ref(0);
const score = ref(0);
const selectedAns = ref(null); // null = unanswered
const showResult = ref(false);
const completed = ref(false);
const navigating = ref(false);

/** Full log of answers for the complete payload */
const answerLog = ref([]);

// ── Derived ──────────────────────────────────────────────────────
const currentQ = computed(() => props.questions[currentIndex.value]);

const progress = computed(() =>
  Math.round(((currentIndex.value + 1) / props.questions.length) * 100),
);

const pct = computed(() =>
  props.questions.length
    ? Math.round((score.value / props.questions.length) * 100)
    : 0,
);

const scoreColorClass = computed(() => {
  if (pct.value >= 70) return "score--green";
  if (pct.value >= 40) return "score--yellow";
  return "score--red";
});

const resultMessage = computed(() => {
  if (pct.value >= 90)
    return "¡Excelente! Dominas el conocimiento sobre el tema.";
  if (pct.value >= 70) return "¡Muy bien! Tienes un buen manejo del material.";
  if (pct.value >= 50)
    return "Bien. Considera repasar algunos conceptos clave.";
  return "Necesitas revisar más el material de estudio.";
});

// ── Option styling helper ────────────────────────────────────────
function optionClass(idx) {
  if (!showResult.value) return "";
  if (idx === currentQ.value.correct) return "option--correct";
  if (idx === selectedAns.value) return "option--wrong";
  return "option--muted";
}

// ── Actions ──────────────────────────────────────────────────────
function selectAnswer(idx) {
  if (selectedAns.value !== null) return;

  const isCorrect = idx === currentQ.value.correct;
  if (isCorrect) score.value++;

  selectedAns.value = idx;
  showResult.value = true;

  const payload = {
    index: currentIndex.value,
    selected: idx,
    correct: currentQ.value.correct,
    isCorrect,
  };
  answerLog.value.push(payload);
  emit("answer", payload);
}

function advance() {
  if (navigating.value) return;
  navigating.value = true;

  setTimeout(() => {
    const isLast = currentIndex.value === props.questions.length - 1;

    if (isLast) {
      completed.value = true;
      emit("complete", {
        score: score.value,
        total: props.questions.length,
        pct: pct.value,
        answers: [...answerLog.value],
      });
    } else {
      currentIndex.value++;
      selectedAns.value = null;
      showResult.value = false;
    }

    navigating.value = false;
  }, 180);
}

function restart() {
  currentIndex.value = 0;
  score.value = 0;
  selectedAns.value = null;
  showResult.value = false;
  completed.value = false;
  answerLog.value = [];
}

// Expose restart so parent can call it programmatically if needed
defineExpose({ restart });
</script>

<template>
  <!-- ── Results screen ──────────────────────────────────────── -->
  <div v-if="completed" class="results">
    <div class="results__banner">
      <span class="results__trophy" aria-hidden="true">🏆</span>
      <p class="results__label">RESULTADO FINAL</p>
      <p class="results__score">{{ pct }}%</p>
      <p class="results__fraction">
        {{ score }} / {{ questions.length }} correctas
      </p>
    </div>
    <div class="results__body">
      <p class="results__message">{{ resultMessage }}</p>
      <button class="btn btn--outline" @click="restart">
        <IconRefresh aria-hidden="true" /> Reiniciar quiz
      </button>
    </div>
  </div>

  <!-- ── Quiz card ────────────────────────────────────────────── -->
  <div v-else class="card">
    <!-- Header -->
    <header class="card__header">
      <p class="card__eyebrow">{{ subtitle || "Subtitle" }}</p>
      <h1 class="card__title">{{ title }}</h1>

      <div class="card__meta">
        <span class="card__counter">
          Pregunta {{ currentIndex + 1 }} / {{ questions.length }}
        </span>
        <span class="card__score-badge" :class="scoreColorClass">
          {{ score }}/{{ questions.length }} · {{ pct }}%
        </span>
      </div>

      <!-- Progress bar -->
      <div
        class="progress"
        role="progressbar"
        :aria-valuenow="progress"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div class="progress__fill" :style="{ width: progress + '%' }" />
      </div>
    </header>

    <!-- Body -->
    <main class="card__body">
      <p class="question">{{ currentQ.question }}</p>

      <!-- Options -->
      <ul class="options" role="list">
        <li v-for="(opt, idx) in currentQ.options" :key="idx">
          <button
            class="option"
            :class="optionClass(idx)"
            :disabled="showResult"
            :aria-pressed="selectedAns === idx"
            @click="selectAnswer(idx)"
          >
            <span class="option__label">{{ opt }}</span>
            <IconCheck
              v-if="showResult && idx === currentQ.correct"
              aria-hidden="true"
            />
            <IconX
              v-else-if="showResult && idx === selectedAns"
              aria-hidden="true"
            />
          </button>
        </li>
      </ul>

      <!-- Explanation -->
      <Transition name="slide-up">
        <div
          v-if="showResult"
          class="explanation"
          :class="
            selectedAns === currentQ.correct
              ? 'explanation--correct'
              : 'explanation--info'
          "
        >
          <strong class="explanation__title">
            {{
              selectedAns === currentQ.correct
                ? "¡Correcto!"
                : "Respuesta correcta:"
            }}
          </strong>
          <p class="explanation__text">{{ currentQ.explanation }}</p>
        </div>
      </Transition>

      <!-- Next / Finish button -->
      <Transition name="slide-up">
        <button v-if="showResult" class="btn btn--primary" @click="advance">
          {{
            currentIndex < questions.length - 1
              ? "Siguiente pregunta"
              : "Ver resultados"
          }}
          <IconArrow aria-hidden="true" />
        </button>
      </Transition>
    </main>
  </div>
</template>

<!-- ── Inline icon components ──────────────────────────────────── -->
<script>
const IconCheck = {
  template: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
};
const IconX = {
  template: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};
const IconArrow = {
  template: `<svg class="icon icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
};
const IconRefresh = {
  template: `<svg class="icon icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
};
</script>

<style scoped>
/* ── Card shell ─────────────────────────────────────────────── */
.card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
}

/* ── Header ─────────────────────────────────────────────────── */
.card__header {
  padding: 2rem 2rem 1.5rem;
  border-bottom: 1px solid var(--border);
  position: relative;
  overflow: hidden;
}

.card__header::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #f0c04009 0%, transparent 60%);
  pointer-events: none;
}

.card__eyebrow {
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.16em;
  color: var(--accent);
  margin-bottom: 0.2rem;
}

.card__title {
  font-family: var(--font-display);
  font-size: 2.4rem;
  letter-spacing: 0.04em;
  line-height: 1;
  color: var(--text-1);
  margin-bottom: 1.25rem;
}

.card__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.card__counter {
  font-size: 0.8rem;
  color: var(--text-2);
  font-weight: 300;
}

.card__score-badge {
  font-size: 0.78rem;
  font-weight: 500;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  transition:
    color var(--ease),
    border-color var(--ease);
}

.score--green {
  color: var(--ok);
  border-color: var(--ok);
}
.score--yellow {
  color: var(--accent);
  border-color: var(--accent);
}
.score--red {
  color: var(--err);
  border-color: var(--err);
}

/* ── Progress ───────────────────────────────────────────────── */
.progress {
  height: 3px;
  background: var(--border);
  border-radius: 999px;
  overflow: hidden;
}

.progress__fill {
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* ── Body ───────────────────────────────────────────────────── */
.card__body {
  padding: 2rem;
}

.question {
  font-size: 1.05rem;
  font-weight: 400;
  line-height: 1.65;
  color: var(--text-1);
  margin-bottom: 1.75rem;
}

/* ── Options ────────────────────────────────────────────────── */
.options {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.option {
  width: 100%;
  text-align: left;
  padding: 0.9rem 1.1rem;
  border-radius: var(--ui-radius);
  border: 1px solid var(--border);
  background: var(--ui-bg-muted);
  color: var(--text-1);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  transition:
    border-color var(--ease),
    background var(--ease),
    transform var(--ease),
    opacity var(--ease);
  outline: none;
}

.option:not(:disabled):hover {
  border-color: var(--ui-border);
  background: var(--ui-bg-accented);

}

.option:not(:disabled):focus-visible {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}

.option--correct {
  border-color: var(--ok) !important;
  background: var(--ok-dim) !important;
  color: var(--ok) !important;
}

.option--wrong {
  border-color: var(--err) !important;
  background: var(--err-dim) !important;
  color: var(--err) !important;
}

.option--muted {
  opacity: 0.38;
}

.option__label {
  flex: 1;
}

/* ── Explanation ────────────────────────────────────────────── */
.explanation {
  margin-top: 1.5rem;
  padding: 1rem 1.2rem;
  border-radius: var(--r-md);
  border-left: 3px solid var(--accent);
  background: var(--accent-dim);
  font-size: 0.875rem;
  line-height: 1.65;
}

.explanation--correct {
  border-color: var(--ok);
  background: var(--ok-dim);
}

.explanation--info {
  border-color: var(--accent);
  background: var(--accent-dim);
}

.explanation__title {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-1);
  margin-bottom: 0.4rem;
}

.explanation__text {
  color: var(--text-2);
}

/* ── Buttons ────────────────────────────────────────────────── */
.btn {
  margin-top: 1.5rem;
  width: 100%;
  padding: 0.9rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  border-radius: var(--r-md);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition:
    opacity var(--ease),
    transform var(--ease),
    background var(--ease),
    color var(--ease);
}

.btn--primary {
  background: var(--accent);
  color: #0d0e12;
}

.btn--primary:hover {
  opacity: 0.86;
  transform: translateY(-1px);
}
.btn--primary:active {
  transform: translateY(0);
}

.btn--outline {
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
  margin-top: 0;
}

.btn--outline:hover {
  background: var(--accent);
  color: #0d0e12;
}

/* ── Icons ──────────────────────────────────────────────────── */
.icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.icon--sm {
  width: 16px;
  height: 16px;
}

/* ── Results ────────────────────────────────────────────────── */
.results {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
}

.results__banner {
  padding: 2.5rem 2rem;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
  text-align: center;
  position: relative;
  overflow: hidden;
}

.results__banner::after {
  content: "";
  position: absolute;
  bottom: -50px;
  left: 50%;
  transform: translateX(-50%);
  width: 240px;
  height: 240px;
  background: radial-gradient(circle, var(--accent-dim) 0%, transparent 70%);
  pointer-events: none;
}

.results__trophy {
  font-size: 3.5rem;
  line-height: 1;
  display: block;
  margin-bottom: 0.75rem;
  animation: pop 450ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.results__label {
  font-family: var(--font-display);
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  color: var(--text-3);
  margin-bottom: 0.4rem;
}

.results__score {
  font-family: var(--font-display);
  font-size: 5rem;
  letter-spacing: 0.02em;
  line-height: 1;
  color: var(--accent);
}

.results__fraction {
  font-family: var(--font-display);
  font-size: 1.15rem;
  color: var(--text-2);
  margin-top: 0.3rem;
}

.results__body {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.results__message {
  font-size: 1rem;
  color: var(--text-2);
  line-height: 1.65;
  text-align: center;
}

/* ── Transitions ────────────────────────────────────────────── */
.slide-up-enter-active {
  transition: all 250ms ease;
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

/* ── Keyframes ──────────────────────────────────────────────── */
@keyframes pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* ── Responsive ─────────────────────────────────────────────── */
@media (max-width: 480px) {
  .card__header {
    padding: 1.5rem 1.25rem 1.25rem;
  }
  .card__body {
    padding: 1.5rem 1.25rem;
  }
  .card__title {
    font-size: 1.9rem;
  }
  .results__score {
    font-size: 4rem;
  }
}
</style>
