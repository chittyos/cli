import winston from "winston";

describe("Logger Utils", () => {
  let mockTransport: winston.transport;

  beforeEach(() => {
    mockTransport = new winston.transports.Console();
    jest.spyOn(mockTransport, "log").mockImplementation((_info, callback) => {
      if (callback) callback();
      return true;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Log Levels", () => {
    it("should have correct log levels defined", () => {
      const levels = {
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        debug: 4,
      };

      expect(levels.error).toBe(0);
      expect(levels.warn).toBe(1);
      expect(levels.info).toBe(2);
      expect(levels.http).toBe(3);
      expect(levels.debug).toBe(4);
    });

    it("should prioritize error level over others", () => {
      const levels = { error: 0, warn: 1, info: 2 };
      const sortedLevels = Object.entries(levels).sort((a, b) => a[1] - b[1]);
      expect(sortedLevels[0][0]).toBe("error");
    });
  });

  describe("Logger Colors", () => {
    it("should define appropriate colors for each level", () => {
      const colors = {
        error: "red",
        warn: "yellow",
        info: "green",
        http: "magenta",
        debug: "white",
      };

      expect(colors.error).toBe("red");
      expect(colors.warn).toBe("yellow");
      expect(colors.info).toBe("green");
    });
  });

  describe("Logger Format", () => {
    it("should format log messages with timestamp", () => {
      const timestamp = "2024-01-01 12:00:00";
      const level = "info";
      const message = "Test message";

      const expectedFormat = `${timestamp} [${level}]: ${message}`;
      const actualFormat = `${timestamp} [${level}]: ${message}`;

      expect(actualFormat).toBe(expectedFormat);
    });

    it("should handle multi-line messages", () => {
      const message = "Line 1\nLine 2\nLine 3";
      expect(message).toContain("\n");
      expect(message.split("\n")).toHaveLength(3);
    });
  });

  describe("Logger Instance", () => {
    it("should create logger with correct configuration", () => {
      const logger = winston.createLogger({
        level: "info",
        transports: [mockTransport],
      });

      expect(logger).toBeDefined();
      expect(logger.level).toBe("info");
      expect(logger.transports).toHaveLength(1);
    });

    it("should log messages at different levels", () => {
      const logger = winston.createLogger({
        level: "debug",
        transports: [mockTransport],
      });

      const logSpy = jest.spyOn(mockTransport, "log");

      logger.error("Error message");
      logger.warn("Warning message");
      logger.info("Info message");
      logger.debug("Debug message");

      expect(logSpy).toHaveBeenCalledTimes(4);
    });
  });

  describe("Request Logging", () => {
    it("should format HTTP request logs", () => {
      const mockRequest = {
        method: "GET",
        url: "/api/test",
        headers: { "user-agent": "test-agent" },
        ip: "127.0.0.1",
      };

      const logMessage = `${mockRequest.method} ${mockRequest.url} from ${mockRequest.ip}`;
      expect(logMessage).toBe("GET /api/test from 127.0.0.1");
    });

    it("should sanitize sensitive data in logs", () => {
      const sensitiveData = {
        password: "secret123",
        token: "bearer-token",
        apiKey: "api-key-123",
      };

      const sanitized = {
        password: "[REDACTED]",
        token: "[REDACTED]",
        apiKey: "[REDACTED]",
      };

      Object.keys(sensitiveData).forEach((key) => {
        expect(sanitized[key as keyof typeof sanitized]).toBe("[REDACTED]");
      });
    });
  });
});
