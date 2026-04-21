import { Mark, mergeAttributes } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MultiSelectOptions {
  /**
   * Additional HTML attributes merged into every <mark> element.
   * @default {}
   */
  HTMLAttributes: Record<string, any>

  /**
   * Color palette cycled through on each new selection.
   * Supports any valid CSS color string.
   */
  colors: string[]
}

export interface SelectionEntry {
  /** Unique identifier assigned to this selection. */
  id: string
  /**
   * Monotonic index reflecting the order in which this selection was created.
   * Selections removed and re-added always receive a higher number than all
   * previous ones; the counter never resets during a session.
   */
  order: number
  /**
   * Full text content of the selection, as it appears in the document.
   * Adjacent text nodes belonging to the same mark are concatenated.
   */
  text: string
  /** CSS color assigned to this selection. */
  color: string
}

export interface MultiSelectStorage {
  /** @internal Monotonic counter – do not mutate directly. */
  _counter: number
  /** @internal Cycles through the color palette – do not mutate directly. */
  _colorIndex: number

  /**
   * Returns all selections currently in the document, sorted by the order
   * in which they were created (not by their position in the document).
   *
   * @example
   * const entries = editor.storage.multiSelect.getSelectionsInOrder(editor.state.doc)
   * entries.forEach(e => console.log(`#${e.order}: "${e.text}"`))
   */
  getSelectionsInOrder(doc: ProseMirrorNode): SelectionEntry[]

  /**
   * Returns the number of distinct selections currently in the document.
   *
   * @example
   * const count = editor.storage.multiSelect.getSelectionCount(editor.state.doc)
   */
  getSelectionCount(doc: ProseMirrorNode): number
}

// ─────────────────────────────────────────────────────────────────────────────
// Command augmentation
// ─────────────────────────────────────────────────────────────────────────────

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    multiSelect: {
      /**
       * Toggle a selection mark on the current editor selection range.
       *
       * - If the range has **no** multiSelect mark → a new numbered, colored
       *   mark is added and the selection counter is incremented.
       * - If the range **already has** a multiSelect mark → the mark is removed.
       *
       * Returns `false` (no-op) when the current selection is collapsed (empty).
       *
       * @example
       * editor.commands.toggleSelection()
       */
      toggleSelection: () => ReturnType

      /**
       * Remove **every** multiSelect mark from the entire document in a single
       * transaction and reset the color-cycling index.
       *
       * Note: the monotonic order counter is intentionally NOT reset so that
       * newly added selections after a clear always carry higher numbers, making
       * them easy to distinguish in external logs or undo history.
       *
       * @example
       * editor.commands.clearAllSelections()
       */
      clearAllSelections: () => ReturnType
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const MARK_NAME = 'multiSelect'

/**
 * Walk the document and aggregate all multiSelect marks into SelectionEntry
 * objects, concatenating adjacent text nodes that share the same mark id.
 * The returned array is sorted by `order` (creation order).
 */
function collectSelections(doc: ProseMirrorNode): SelectionEntry[] {
  const map = new Map<string, SelectionEntry>()

  doc.descendants(node => {
    if (!node.isText) return

    for (const mark of node.marks) {
      if (mark.type.name !== MARK_NAME) continue

      const { id, order, color } = mark.attrs as {
        id: string
        order: number
        color: string
      }

      const existing = map.get(id)
      if (existing) {
        existing.text += node.text ?? ''
      } else {
        map.set(id, { id, order, color, text: node.text ?? '' })
      }
    }
  })

  return [...map.values()].sort((a, b) => a.order - b.order)
}

function countDistinctSelections(doc: ProseMirrorNode): number {
  const ids = new Set<string>()
  doc.descendants(node => {
    for (const mark of node.marks) {
      if (mark.type.name === MARK_NAME) ids.add(mark.attrs.id as string)
    }
  })
  return ids.size
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension
// ─────────────────────────────────────────────────────────────────────────────

export const MultiSelect = Mark.create<MultiSelectOptions, MultiSelectStorage>({
  name: MARK_NAME,

  addOptions() {
    return {
      HTMLAttributes: {},
      colors: [
        '#FFD166', // amber
        '#06D6A0', // mint
        '#118AB2', // ocean
        '#EF476F', // rose
        '#A8DADC', // powder blue
        '#C77DFF', // lavender
        '#F4845F', // coral
        '#B7E4C7', // sage
      ],
    }
  },

  // ── Storage: mutable state + public API methods ──────────────────────────

  addStorage(): MultiSelectStorage {
    return {
      _counter: 0,
      _colorIndex: 0,

      getSelectionsInOrder(doc: ProseMirrorNode): SelectionEntry[] {
        return collectSelections(doc)
      },

      getSelectionCount(doc: ProseMirrorNode): number {
        return countDistinctSelections(doc)
      },
    }
  },

  // ── Attributes ────────────────────────────────────────────────────────────

  addAttributes() {
    return {
      /** Unique selection identifier (used to aggregate text across text nodes). */
      id: {
        default: null,
        parseHTML: el => el.getAttribute('data-ms-id'),
        renderHTML: attrs => ({ 'data-ms-id': attrs.id }),
      },

      /** Creation order – drives the numbered badge and sorted extraction. */
      order: {
        default: 0,
        parseHTML: el => Number(el.getAttribute('data-ms-order') ?? 0),
        renderHTML: attrs => ({ 'data-ms-order': attrs.order }),
      },

      /** Background color for this selection. */
      color: {
        default: '#FFD166',
        parseHTML: el => el.getAttribute('data-ms-color'),
        renderHTML: attrs => ({
          'data-ms-color': attrs.color,
          style: `background-color: ${attrs.color}40; border-bottom: 2px solid ${attrs.color};`,
        }),
      },
    }
  },

  // ── HTML serialization ────────────────────────────────────────────────────

  parseHTML() {
    return [{ tag: 'mark[data-ms-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'mark',
      mergeAttributes(
        { class: 'ms-mark' },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      0, // content hole
    ]
  },

  // ── Lifecycle: inject styles once on mount ────────────────────────────────

  onCreate() {
    injectStyles()
  },

  // ── Commands ──────────────────────────────────────────────────────────────

  addCommands() {
    return {
      // ── toggleSelection ────────────────────────────────────────────────────
      toggleSelection:
        () =>
        ({ commands, state }) => {
          const { from, to, empty } = state.selection

          // Collapsed cursor – nothing to mark
          if (empty) return false

          const markType = state.schema.marks[this.name]
          const hasMark = state.doc.rangeHasMark(from, to, markType!)

          if (hasMark) {
            // Remove the mark from the selected range only
            return commands.unsetMark(this.name)
          }

          // Assign creation order and color, then apply the mark
          const order = ++this.storage._counter
          const color =
            this.options.colors[this.storage._colorIndex++ % this.options.colors.length]
          // Compact collision-resistant id: timestamp base-36 + 5 random chars
          const id = `ms-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 7)}`

          return commands.setMark(this.name, { id, order, color })
        },

      // ── clearAllSelections ─────────────────────────────────────────────────
      clearAllSelections:
        () =>
        ({ tr, dispatch, state }) => {
          const markType = state.schema.marks[this.name]

          // Collect all ranges to remove in a single pass
          state.doc.descendants((node, pos) => {
            if (!node.isText) return
            for (const mark of node.marks) {
              if (mark.type === markType) {
                tr.removeMark(pos, pos + node.nodeSize, markType)
              }
            }
          })

          // Reset color cycling so the palette starts fresh
          this.storage._colorIndex = 0
          // NOTE: _counter is intentionally NOT reset (see JSDoc above).

          if (dispatch) dispatch(tr)
          return true
        },
    }
  },

  // ── Keyboard shortcut ─────────────────────────────────────────────────────

  addKeyboardShortcuts() {
    return {
      // Cmd/Ctrl + Shift + X → toggle selection
      'Mod-Shift-x': () => this.editor.commands.toggleSelection(),
    }
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// Style injection
// ─────────────────────────────────────────────────────────────────────────────

const STYLE_ID = 'tiptap-multi-select-styles'

function injectStyles(): void {
  if (typeof document === 'undefined') return // SSR guard
  if (document.getElementById(STYLE_ID)) return // already injected

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = /* css */ `

    /* ── Base mark ─────────────────────────────────────────────── */
    .ms-mark {
      border-radius: 2px;
      padding: 1px 2px;
      position: relative;
      cursor: pointer;
      transition:
        filter        0.15s ease,
        box-shadow    0.15s ease,
        outline-color 0.15s ease;
      /* Subtle lift so the mark reads above plain text */
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.08);
    }

    /* ── Hover ──────────────────────────────────────────────────── */
    .ms-mark:hover {
      filter: brightness(0.85) saturate(1.3);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
      outline: 1.5px solid currentColor;
      outline-offset: 1px;
      z-index: 1;
    }

    /* ── Numbered badge (top-right corner) ──────────────────────── */
    /*
     * Uses the data-ms-order attribute set by renderHTML so no JS
     * update is needed – the browser always reads the live value.
     */
    .ms-mark::after {
      content: attr(data-ms-order);
      position: absolute;
      top: -8px;
      right: -6px;

      /* Size & shape */
      min-width: 14px;
      height: 14px;
      padding: 0 3px;
      border-radius: 999px;

      /* Typography */
      font-size: 8px;
      font-weight: 800;
      font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
      line-height: 14px;
      text-align: center;
      letter-spacing: -0.3px;

      /* Colors */
      background: #111;
      color: #fff;

      /* Stacking */
      pointer-events: none;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    }

    /* ── Focus ring (for keyboard navigation) ───────────────────── */
    .ms-mark:focus-visible {
      outline: 2px solid #111;
      outline-offset: 2px;
    }

  `

  document.head.appendChild(style)
}