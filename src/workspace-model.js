export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
export const daysBefore = (count, end = localDate()) => {
  const date = new Date(`${end}T12:00:00`);
  date.setDate(date.getDate() - count);
  return localDate(date);
};
export const taskStatus = (item) =>
  item.done ? "done" : item.status === "doing" ? "doing" : "todo";
export const goalProgress = (item) =>
  item.target > 0
    ? Math.min(
        100,
        Math.max(0, (Number(item.current || 0) / Number(item.target)) * 100)
      )
    : Math.min(100, Math.max(0, Number(item.progress) || 0));
export const habitDates = (item) =>
  Array.isArray(item.checkins) ? item.checkins : [];
export const habitStreak = (item, today = localDate()) => {
  const dates = new Set(habitDates(item));
  let day = dates.has(today) ? today : daysBefore(1, today);
  let streak = 0;
  while (dates.has(day)) {
    streak++;
    day = daysBefore(1, day);
  }
  return streak;
};
export const toggleCheckin = (item, day) => ({
  ...item,
  checkins: habitDates(item).includes(day)
    ? habitDates(item).filter((date) => date !== day)
    : [...habitDates(item), day],
});
export const workoutDone = (item) =>
  item.status ? item.status === "completed" : !!item.done;
export const total = (items, field) =>
  items.reduce((sum, item) => sum + (Number(item[field]) || 0), 0);
