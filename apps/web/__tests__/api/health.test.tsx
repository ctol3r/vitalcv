import { GET } from "@/app/api/healthz/route"
import { GET as readyGet } from "@/app/api/readyz/route"

describe("Health Check APIs", () => {
  describe("/api/healthz", () => {
    it("returns healthy status", async () => {
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe("healthy")
    })
  })

  describe("/api/readyz", () => {
    it("returns ready status", async () => {
      const response = await readyGet()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe("ready")
    })
  })
})
