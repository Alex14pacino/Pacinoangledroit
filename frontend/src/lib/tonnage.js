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
