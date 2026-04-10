import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "./app";

describe("app health route", () => {
  it("returns ok status", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
    expect(typeof res.body.timestamp).toBe("string");
  });
});
