export const ATHLETE_LIVING_CONSULT_ROOMS = Object.freeze(['HOME', 'YOU', 'YOUR_SPORT', 'PLAN'])

const ROOM_DEFAULT_CONTEXT = Object.freeze({
  HOME: Object.freeze({ destination: 'home', visibleObjectIds: [] }),
  YOU: Object.freeze({ destination: 'recognition', visibleObjectIds: [] }),
  YOUR_SPORT: Object.freeze({ destination: 'overview', visibleObjectIds: [] }),
  PLAN: Object.freeze({ destination: 'plan', visibleObjectIds: [] }),
})

const safeArray = (value) => Array.isArray(value) ? value : []

export function createPageContextEnvelope(room, context = {}) {
  const fallback = ROOM_DEFAULT_CONTEXT[room] || ROOM_DEFAULT_CONTEXT.HOME
  return {
    contract: 'page-context-envelope-v1',
    room,
    destination: context.destination || fallback.destination,
    visibleObjectIds: [...new Set(safeArray(context.visibleObjectIds || context.visible_object_ids || fallback.visibleObjectIds).filter(Boolean))],
    stateHash: context.stateHash || context.state_hash || null,
  }
}
