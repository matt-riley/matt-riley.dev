import { site } from "../content/site";

const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: site.openingHours.timeZone,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function openingHoursAt(date: Date) {
  const time = clock.format(date);
  const hour = Number(time.split(":")[0]);
  const isOpen = hour >= 7 && hour < 22;
  return {
    time,
    isOpen,
    text: isOpen
      ? `Open. It is ${time} in Yorkshire.`
      : site.openingHours.closed,
  };
}
