<script setup>
// Emerald
// Copyright (C) 2026 Juan José Caballero Rey - https://github.com/rey-sudo
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import { ref } from "vue";
import WidgetButton from "./WidgetButton.vue";
import QuizFlow from "./QuizFlow.vue";

const views = {
  quiz: QuizFlow,
};

const currentView = shallowRef("quiz");

const openView = (viewKey) => {
  currentView.value = views[viewKey];
};

const goBack = () => {
  currentView.value = null;
};

const buttons = ref([
  {
    label: "Chat",
    color: "success",
    icon: "material-symbols:chat-outline-rounded",
  },
  {
    label: "Quiz",
    color: "success",
    icon: "material-symbols:quiz-outline-rounded",
  },
  {
    label: "Concepts",
    color: "error",
    icon: "material-symbols:lightbulb-2-outline-rounded",
  },
  {
    label: "Mind map",
    color: "warning",
    icon: "material-symbols:mindfulness-outline-rounded",
  },
]);

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

<template>
  <div class="preview w-full">
    <div v-if="currentView" class="view-overlay">
      <div class="preview-header">
        <UButton
          icon="material-symbols:arrow-back-ios-new-rounded"
          size="sm"
          color="neutral"
          variant="ghost"
          @click="goBack"
        />
      </div>
      <component :is="currentView" />
    </div>

    <div class="button-grid">
      <WidgetButton
        v-for="(btn, index) in buttons"
        :key="index"
        :label="btn.label"
        :icon="btn.icon"
        @click="openView('quiz')"
      />
    </div>
  </div>
</template>

<style lang="css" scoped>
.preview {
  display: flex;
  flex-direction: column;
  position: relative;
}

.button-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  padding: 1rem;
  border-top: none;
  border-bottom-left-radius: calc(var(--ui-radius) * 2);
  border-bottom-right-radius: calc(var(--ui-radius) * 2);
}

.grid-button {
  flex: 1 1 auto;
}

.view-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--ui-bg);
  z-index: 10;
}

.preview-header {
  gap: 0.5rem;
  z-index: 10;
  display: flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid transparent;
  border-bottom-left-radius: calc(var(--ui-radius) * 0);
  border-bottom-right-radius: calc(var(--ui-radius) * 0);
}
</style>
