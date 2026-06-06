import { describe, expect, test } from "bun:test"
import { buildServiceRegisterBody } from "./service-register"

describe("buildServiceRegisterBody", () => {
  test("minimal id-only body", () => {
    const body = buildServiceRegisterBody({ serviceId: "my_sidecar" })
    expect(body.service_id).toBe("my_sidecar")
    expect(body.auto_allocate).toBe(true)
    expect(body.overwrite).toBe(false)
  })

  test("working_dir + entry_point + explicit ports disable auto_allocate", () => {
    const body = buildServiceRegisterBody({
      serviceId: "my_sidecar",
      workingDir: "dataproai",
      entryPoint: "src/main.py",
      ports: { api: 10950 },
      schemaRef: "schemas/service-registry-v1.schema.json",
      startable: true,
    })
    expect(body.working_dir).toBe("dataproai")
    expect(body.entry_point).toBe("src/main.py")
    expect(body.auto_allocate).toBe(false)
    expect(body.startable).toBe(true)
  })
})
