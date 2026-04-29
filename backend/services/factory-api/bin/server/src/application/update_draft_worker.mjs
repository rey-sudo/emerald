import * as Y from "yjs";

const mergeYjsUpdates = (existingBinary, incomingDelta) => {
  const uint8Existing = new Uint8Array(existingBinary);
  const uint8Incoming = new Uint8Array(incomingDelta);

  return Y.mergeUpdates([uint8Existing, uint8Incoming]);
};

export default mergeYjsUpdates;
