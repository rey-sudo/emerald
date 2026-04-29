// update_draft_worker.mjs
import * as Y from "yjs";

/**
 * Recibe el estado actual y el delta entrante,
 * devuelve el nuevo estado completo como Buffer.
 * Se ejecuta en un worker thread de Piscina.
 */
export function mergeYjsState({ rawState, incomingDelta }) {
  const doc = new Y.Doc();

  if (rawState) {
    Y.applyUpdate(doc, rawState);
  }

  Y.applyUpdate(doc, incomingDelta);

  // encodeStateAsUpdate produce el estado completo del doc como Uint8Array.
  // El Worker de snapshots también puede partir de esto para su Y.Doc interno.
  return Buffer.from(Y.encodeStateAsUpdate(doc));
}