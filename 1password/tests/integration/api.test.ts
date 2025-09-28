import request from "supertest";
import express, { Application } from "express";

describe("API Integration Tests", () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    app.get("/health", (_req, res) => {
      res
        .status(200)
        .json({ status: "ok", timestamp: new Date().toISOString() });
    });

    app.post("/api/data", (req, res) => {
      const { name, value } = req.body;
      if (!name || !value) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      return res
        .status(201)
        .json({ id: Math.random().toString(36), name, value });
    });

    app.get("/api/data/:id", (req, res) => {
      const { id } = req.params;
      if (!id) {
        return res.status(404).json({ error: "Not found" });
      }
      return res.json({ id, name: "Test Item", value: 100 });
    });
  });

  describe("Health Check Endpoint", () => {
    it("should return 200 OK status", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body.status).toBe("ok");
      expect(response.body.timestamp).toBeDefined();
    });

    it("should return valid JSON response", async () => {
      const response = await request(app)
        .get("/health")
        .expect("Content-Type", /json/);

      expect(response.body).toBeInstanceOf(Object);
    });
  });

  describe("POST /api/data", () => {
    it("should create new data entry", async () => {
      const newData = { name: "Test", value: 123 };

      const response = await request(app)
        .post("/api/data")
        .send(newData)
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe(newData.name);
      expect(response.body.value).toBe(newData.value);
    });

    it("should return 400 for missing fields", async () => {
      const response = await request(app)
        .post("/api/data")
        .send({ name: "Test" })
        .expect(400);

      expect(response.body.error).toBe("Missing required fields");
    });

    it("should handle empty body", async () => {
      const response = await request(app)
        .post("/api/data")
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/data/:id", () => {
    it("should retrieve data by ID", async () => {
      const testId = "test123";

      const response = await request(app)
        .get(`/api/data/${testId}`)
        .expect(200);

      expect(response.body.id).toBe(testId);
      expect(response.body.name).toBeDefined();
      expect(response.body.value).toBeDefined();
    });

    it("should handle special characters in ID", async () => {
      const specialId = "test-123_abc";

      const response = await request(app)
        .get(`/api/data/${specialId}`)
        .expect(200);

      expect(response.body.id).toBe(specialId);
    });
  });

  describe("Error Handling", () => {
    it("should return 404 for non-existent routes", async () => {
      await request(app).get("/non-existent").expect(404);
    });

    it("should handle malformed JSON", async () => {
      await request(app)
        .post("/api/data")
        .set("Content-Type", "application/json")
        .send('{"invalid json}')
        .expect(400);
    });
  });

  describe("Headers and CORS", () => {
    it("should set appropriate response headers", async () => {
      const response = await request(app).get("/health");

      expect(response.headers["content-type"]).toContain("application/json");
    });

    it("should handle different content types", async () => {
      await request(app)
        .post("/api/data")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("name=test&value=123")
        .expect(400);
    });
  });
});
