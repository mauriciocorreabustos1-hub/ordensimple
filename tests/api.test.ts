// Pruebas de la API v1 (la que usa OrdenCRM): claves, paginación, identificadores, estados y webhooks.
// Correr con:  npm run test:api

import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { describe, test } from "node:test"
import {
  apiKeyHint,
  bearerKey,
  hashApiKey,
  isApiKeyFormat,
  isPrivateIp,
  newApiKey,
  pageMeta,
  parseId,
  parseListQuery,
  QUOTE_STATE,
  quoteStatusesFor,
  signWebhook,
  wantsEvent,
  webhookUrlProblem,
} from "@/lib/api-v1"

describe("claves", () => {
  test("formato os_live_ + 40 caracteres, todas distintas", () => {
    const keys = new Set(Array.from({ length: 200 }, newApiKey))
    assert.equal(keys.size, 200)
    for (const k of keys) assert.ok(isApiKeyFormat(k), k)
  })
  test("rechaza formatos raros", () => {
    assert.equal(isApiKeyFormat("os_test_" + "a".repeat(40)), false)
    assert.equal(isApiKeyFormat("os_live_" + "a".repeat(39)), false)
    assert.equal(isApiKeyFormat("os_live_" + "a".repeat(39) + "-"), false)
  })
  test("se guarda la huella, no la clave; la pista no revela la clave", () => {
    const k = newApiKey()
    assert.equal(hashApiKey(k).length, 64)
    assert.notEqual(hashApiKey(k), k)
    assert.equal(apiKeyHint(k), `${k.slice(0, 12)}…${k.slice(-4)}`)
  })
  test("lee el encabezado Authorization", () => {
    assert.equal(bearerKey("Bearer abc"), "abc")
    assert.equal(bearerKey("bearer   abc "), "abc")
    assert.equal(bearerKey("Basic abc"), null)
    assert.equal(bearerKey(null), null)
  })
})

describe("paginación", () => {
  const q = (s: string) => parseListQuery(new URLSearchParams(s))
  test("valores por defecto", () => assert.deepEqual(q(""), { page: 1, limit: 50, since: null }))
  test("límites", () => {
    assert.ok("error" in q("limit=201"))
    assert.ok("error" in q("limit=0"))
    assert.ok("error" in q("page=0"))
    assert.ok("error" in q("page=1.5"))
    assert.ok("error" in q("updated_since=ayer"))
    assert.ok("error" in q("updated_since=12345"))
  })
  test("updated_since ISO", () => {
    const r = q("updated_since=2026-11-25T12:00:00Z")
    assert.ok(!("error" in r) && r.since?.toISOString() === "2026-11-25T12:00:00.000Z")
  })
  test("next_page", () => {
    assert.equal(pageMeta({ page: 1, limit: 50, since: null }, 120).next_page, 2)
    assert.equal(pageMeta({ page: 3, limit: 50, since: null }, 120).next_page, null)
    assert.equal(pageMeta({ page: 2, limit: 60, since: null }, 120).next_page, null)
    assert.equal(pageMeta({ page: 1, limit: 50, since: null }, 0).next_page, null)
  })
})

describe("identificadores y estados", () => {
  test("parseId acepta solo prefijos conocidos e ids reales", () => {
    assert.deepEqual(parseId("cli_cmh1abcdefghijklmnopqrst"), { kind: "cli", raw: "cmh1abcdefghijklmnopqrst" })
    assert.equal(parseId("cli_../../etc"), null)
    assert.equal(parseId("xxx_cmh1abcdefghijklmnopqrst"), null)
    assert.equal(parseId("cli_"), null)
    assert.equal(parseId("ven_' OR 1=1 --"), null)
  })
  test("estados de cotización para OrdenCRM", () => {
    assert.equal(QUOTE_STATE.PENDING, "pendiente")
    assert.equal(QUOTE_STATE.ACCEPTED, "en_proceso")
    assert.equal(QUOTE_STATE.SOLD, "completada")
    assert.equal(QUOTE_STATE.REJECTED, "cancelada")
    assert.deepEqual(quoteStatusesFor("completada"), ["SOLD"])
  })
})

describe("webhooks", () => {
  test("firma HMAC-SHA256 que OrdenCRM puede verificar", () => {
    const body = '{"evento":"orden.creada"}'
    assert.equal(signWebhook(body, "secreto"), "sha256=" + createHmac("sha256", "secreto").update(body).digest("hex"))
  })
  test("eventos", () => {
    assert.ok(wantsEvent(["*"], "orden.creada"))
    assert.ok(wantsEvent(["orden.creada"], "orden.creada"))
    assert.equal(wantsEvent(["cliente.creado"], "orden.creada"), false)
  })
  test("solo https a dominios públicos", () => {
    assert.equal(webhookUrlProblem("https://abc.supabase.co/functions/v1/ordensimple?e=x"), null)
    assert.ok(webhookUrlProblem("http://abc.supabase.co/x"))
    assert.ok(webhookUrlProblem("https://localhost/x"))
    assert.ok(webhookUrlProblem("https://127.0.0.1/x"))
    assert.ok(webhookUrlProblem("https://[::1]/x"))
    assert.ok(webhookUrlProblem("https://169.254.169.254/latest"))
    assert.ok(webhookUrlProblem("https://user:pass@abc.com/x"))
    assert.ok(webhookUrlProblem("https://abc.com:8080/x"))
    assert.ok(webhookUrlProblem("https://servidor.internal/x"))
    assert.ok(webhookUrlProblem("javascript:alert(1)"))
  })
  test("IPs internas (por si un dominio apunta a la red interna)", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "192.168.1.5", "172.16.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
      assert.ok(isPrivateIp(ip), ip)
    }
    for (const ip of ["8.8.8.8", "104.18.2.3", "172.32.0.1", "2606:4700::1111"]) assert.equal(isPrivateIp(ip), false, ip)
  })
})
