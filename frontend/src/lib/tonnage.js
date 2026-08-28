// Tonnage (a.k.a. volume) = weight × reps over completed sets.
//
// Rule for bodyweight work: a set with no external load counts as weight 1, so 0 kg × 12 reps
// is worth 12 rather than 0 (otherwise every calisthenics set would vanish from the tonnage).
// Timed holds and cardio carry no reps, so they contribute nothing here — by design.
//
// Everything is derived from the raw séances (S.workouts), each stamped with the plan it was
// trained under, so a plan's numbers never borrow from another plan that shares an exercise.
export const setTonnage = s => (s && s.done ? (s.w > 0 ? s.w : 1) * (s.r || 0) : 0)
export const entryTonnage = e => (e?.sets || []).reduce((n, s) => n + setTonnage(s), 0)
export const workoutTonnage = w => (w?.entries || []).reduce((n, e) => n + entryTonnage(e), 0)

// The séances stamped with a given plan, chronological.
export const planWorkouts = (S, planId) =>
  (S.workouts || []).filter(w => w.planId === planId).sort((a, b) => (a.start || 0) - (b.start || 0))

// Break a plan's séances into CYCLES — a cycle closes once every entraînement of the plan has
// been trained at least once (in any order). Sessions repeated before the cycle closes still
// count toward it. This is calendar-independent on purpose: a "cycle" is one full pass through
// the plan, however many days it took, so cycle-over-cycle is always a like-for-like comparison.
// Returns [{ n, tonnage, startDate, endDate, done, need, complete }]. The trailing partial cycle
// (if any) comes back with complete:false so the UI can flag it "in progress".
export function planCycles(S, plan) {
  const target = new Set((plan?.routines || []).map(r => r.id))
  const N = target.size
  const cycles = []
  if (!N) return cycles
  let acc = 0, seen = new Set(), startDate = null
  for (const w of planWorkouts(S, plan.id)) {
    if (!target.has(w.routineId)) continue   // only the plan's own entraînements delimit a cycle
    if (!seen.size) startDate = w.d
    acc += workoutTonnage(w)
    seen.add(w.routineId)
    if (seen.size >= N) {
      cycles.push({ n: cycles.length + 1, tonnage: acc, startDate, endDate: w.d, done: N, need: N, complete: true })
      acc = 0; seen = new Set(); startDate = null
    }
  }
  if (seen.size) cycles.push({ n: cycles.length + 1, tonnage: acc, startDate, endDate: null, done: seen.size, need: N, complete: false })
  return cycles
}
