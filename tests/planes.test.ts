// Pruebas del aviso de que el plan vence: cuándo se manda, cuántos días quedan y que no se repita.
// Correr con:  npm run test:planes

import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { alreadyNotified, calendarDaysBetween, cleanDateLabel, planNoticeStage } from "@/lib/plan-notice"

describe("aviso de plan por vencer", () => {
  test("cuenta días de calendario (también entre meses y años)", () => {
    assert.equal(calendarDaysBetween("2026-11-24", "2026-11-28"), 4)
    assert.equal(calendarDaysBetween("2026-11-30", "2026-12-01"), 1)
    assert.equal(calendarDaysBetween("2026-12-31", "2027-01-02"), 2)
    assert.equal(calendarDaysBetween("2026-11-24", "2026-11-23"), -1)
  })
  test("no avisa con más de 5 días", () => {
    assert.equal(planNoticeStage(6), null)
    assert.equal(planNoticeStage(30), null)
  })
  test("primer aviso con 5 días o menos", () => {
    assert.equal(planNoticeStage(5), "5")
    assert.equal(planNoticeStage(1), "5")
  })
  test("segundo aviso el día que vence (y al día siguiente, por si el aviso diario no corrió)", () => {
    assert.equal(planNoticeStage(0), "0")
    assert.equal(planNoticeStage(-1), "0")
    assert.equal(planNoticeStage(-2), null)
  })
  test("no repite el mismo aviso ni manda el de 5 días después del del día", () => {
    assert.equal(alreadyNotified(null, "2026-11-30", "5"), false)
    assert.equal(alreadyNotified("2026-11-30:5", "2026-11-30", "5"), true)
    assert.equal(alreadyNotified("2026-11-30:5", "2026-11-30", "0"), false)
    assert.equal(alreadyNotified("2026-11-30:0", "2026-11-30", "5"), true)
    // Si renueva y el plan vence en otra fecha, vuelve a avisar.
    assert.equal(alreadyNotified("2026-11-30:0", "2026-12-30", "5"), false)
  })
  test("fecha sin la coma del formato", () => {
    assert.equal(cleanDateLabel("el sábado, 28 de noviembre"), "el sábado 28 de noviembre")
  })
})
