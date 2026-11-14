// Pruebas de las medidas: venta por unidad, kilo o metro, y recetas con centímetros y metros.
// Correr con:  npm run test:medidas

import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { formatQuantity, lineTotal, parseQuantity, quantityText, roundQuantity, saleUnitOf, validQuantity } from "../src/lib/units"
import { convert, itemCost } from "../src/lib/recipes"

describe("cantidades de venta", () => {
  test("por unidad solo enteros", () => {
    assert.equal(validQuantity(2, "u"), true)
    assert.equal(validQuantity(1.5, "u"), false)
    assert.equal(validQuantity(0, "u"), false)
  })
  test("por metro hasta centímetros, por kilo hasta gramos", () => {
    assert.equal(validQuantity(1.5, "m"), true)
    assert.equal(validQuantity(1.25, "m"), true)
    assert.equal(validQuantity(1.255, "m"), false)
    assert.equal(validQuantity(0.355, "kg"), true)
    assert.equal(validQuantity(0.3555, "kg"), false)
  })
  test("lee lo que escribe la persona", () => {
    assert.equal(parseQuantity("1,5", "m"), 1.5)
    assert.equal(parseQuantity("1.5", "m"), 1.5)
    assert.equal(parseQuantity("0,350", "kg"), 0.35)
    assert.equal(parseQuantity("abc", "m"), null)
    assert.equal(parseQuantity("0", "m"), null)
  })
  test("muestra la medida", () => {
    assert.equal(formatQuantity(1.5, "m"), "1,5 m")
    assert.equal(formatQuantity(3, "u"), "3")
    assert.equal(quantityText(1.5, "m", "Tela"), "1,5 m de Tela")
    assert.equal(quantityText(2, "u", "Pan"), "2 × Pan")
  })
  test("total en pesos enteros y sin errores de decimales", () => {
    assert.equal(lineTotal(1.5, 3990), 5985)
    assert.equal(lineTotal(0.35, 2400), 840)
    assert.equal(roundQuantity(0.1 + 0.2, "m"), 0.3)
  })
  test("medida desconocida se trata como unidad", () => {
    assert.equal(saleUnitOf("litro"), "u")
    assert.equal(saleUnitOf(undefined), "u")
  })
})

describe("recetas con largo", () => {
  test("metros y centímetros se convierten", () => {
    assert.equal(convert(1.5, "m", "cm"), 150)
    assert.equal(convert(50, "cm", "m"), 0.5)
    assert.equal(convert(1, "m", "kg"), null)
  })
  test("costo de 80 cm de una tela de rollo de 50 m a $100.000", () => {
    assert.equal(itemCost({ quantity: 80, unit: "cm", material: { unit: "m", packQty: 50, packPrice: 100000 } }), 1600)
  })
})

describe("rubros textiles ven Recetas", () => {
  test("textil, costura y confección", async () => {
    const { makesRecipes } = await import("../src/lib/business-kind")
    for (const r of ["Textil", "Costura y arreglos", "Confección de ropa", "Venta de telas", "Bordados", "Tapicería", "Cortinas a medida"]) assert.equal(makesRecipes(r), true, r)
    assert.equal(makesRecipes("Almacén o minimarket"), false)
    assert.equal(makesRecipes("Estela"), false)
  })
})
