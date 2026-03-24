<template>
  <div class="preview w-full">
    <div class="button-grid">
      <UButton
        v-for="(btn, index) in buttons"
        :key="index"
        :icon="btn.icon"
        size="lg"
        :color="btn.color"
        variant="outline"
        >{{ btn.label }}</UButton
      >
    </div>

    <div>
      <Quiz
        :questions="questions"
        title="Quiz"
        subtitle="Mid level"
        @answer="onAnswer"
        @complete="onComplete"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const buttons = ref([
  {
    label: "All",
    color: "neutral",
    icon: "i-lucide-menu",
  },
  {
    label: "",
    color: "neutral",
    icon: "i-lucide-settings",
  },
  {
    label: "Quiz Questions",
    color: "success",
    icon: "i-lucide-book-open-check",
  },
  {
    label: "Concepts",
    color: "error",
    icon: "i-lucide-lightbulb",
  },
  {
    label: "Mind Map",
    color: "warning",
    icon: "i-lucide-brain",
  },
]);

function setArtifact(name) {}

// ── localStorage helpers ─────────────────────────────────────────
const LS_KEY = "quiz_session";

function sessionLoad() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function sessionSave(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {}
}

function sessionClear() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}

// ── State ────────────────────────────────────────────────────────
const questions = ref([
  {
    question:
      "El artículo 1.1.1 del Acuerdo No. 001 de 2024 establece el objeto del mismo. ¿Cuál es el objeto principal de este acuerdo expedido por el Consejo Directivo del Archivo General de la Nación en cumplimiento de la Ley 594 de 2000?",
    options: [
      "Crear el Archivo General de la Nación Jorge Palacios Preciado y regular su estructura interna",
      "Establecer los criterios técnicos y jurídicos para implementar la función archivística en el Estado colombiano",
      "Reglamentar el uso de documentos electrónicos exclusivamente en entidades privadas que cumplen funciones públicas",
      "Definir los salarios y perfiles del personal archivístico de las entidades del Estado",
    ],
    correct: 1,
    explanation:
      "El artículo 1.1.1 del Acuerdo 001 de 2024 dispone que su objeto es establecer los criterios técnicos y jurídicos para implementar la función archivística en el Estado Colombiano y fijar otras disposiciones, en cumplimiento de la Ley 594 de 2000 y el Decreto 1080 de 2015.",
  },
  {
    question:
      "Conforme al artículo 1.1.2 del Acuerdo No. 001 de 2024, una empresa de servicios públicos domiciliarios presta una función pública por mandato legal. ¿Está obligada a cumplir este Acuerdo?",
    options: [
      "No, porque es una empresa privada y el Acuerdo solo aplica a entidades del orden nacional",
      "Solo si tiene más de 200 empleados y maneja archivos físicos en sus instalaciones",
      "Sí, porque el ámbito de aplicación comprende a la administración pública y a las entidades privadas que cumplen funciones públicas",
      "Solo parcialmente, en lo referente a los títulos sobre conservación y patrimonio documental",
    ],
    correct: 2,
    explanation:
      "El artículo 1.1.2 establece que el Acuerdo comprende a la administración pública en sus niveles nacional, departamental, distrital y municipal, así como a las entidades privadas que cumplen funciones públicas reguladas por la Ley 594 de 2000, lo que incluye a los prestadores de servicios públicos por mandato legal.",
  },
]);

const loading = ref(true);
const error = ref(null);

// ── Fetch ────────────────────────────────────────────────────────
onMounted(async () => {});

// ── Event handlers from QuizCard ─────────────────────────────────
function onAnswer({ index, selected, correct, isCorrect }) {
  // Persist incremental progress so a page refresh mid-quiz
  // can restore state in a future enhancement.
  sessionSave({ lastAnsweredIndex: index, selected, isCorrect });
  console.debug("[Quiz] answer", { index, selected, correct, isCorrect });
}

function onComplete({ score, total, pct, answers }) {
  sessionClear();
  console.info(`[Quiz] complete — ${score}/${total} (${pct}%)`, answers);
}
</script>

<style lang="css" scoped>
.preview {
  display: flex;
  flex-direction: column;
}

.button-grid {
  background: var(--ui-bg);
  padding: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.grid-button {
  flex: 1 1 auto;
}
</style>
