export default {
  type: "object",
  required: [
    "NODE_ENV",
    "PORT",
    "CORS_ORIGINS",
    "CACHE_DRIVER",
    "COOKIE_SECRET",
    "DEFAULT_CACHE_TTL",
    "RATE_LIMIT_MAX",
    "RATE_LIMIT_TIME_WINDOW",
    "COMPRESS_THRESHOLD",
    "COMPRESS_LEVEL",
    "BODY_LIMIT",
    "FORM_BODY_LIMIT",
    "JWT_SIGN_OPTIONS_EXPIRES_IN",
    "SWAGGER_TITLE",
    "SWAGGER_PREFIX",
    "DATABASE_URL",
  ],
  properties: {
    // app
    NODE_ENV: {
      type: "string",
      enum: ["development", "production", "staging", "test"],
      default: "production",
    },
    PORT: {
      type: "string",
      pattern: "^\\d+$",
      default: "3000",
    },
    HOST: {
      type: "string",
      default: "0.0.0.0",
    },
    SERVER_VERSION: {
      type: "string",
      default: "1.0.0",
    },
    COOKIE_SECRET: {
      type: "string",
      minLength: 32,
    },
    COOKIE_REFRESH_TTL_SEC: {
      type: "string",
      default: "60 * 60 * 24 * 7",
    },
    // CORS
    CORS_ORIGINS: {
      type: "string",
      description: "Comma-separated list of allowed origins",
      default: "http: //0.0.0.0:3500",
    },
    CORS_METHODS: {
      type: "string",
      default: "GET,PUT,POST,DELETE,PATCH",
    },
    CORS_ALLOW_HEADERS: {
      type: "string",
      default: "Content-Type,Authorization",
    },
    CORS_EXPOSE_HEADERS: {
      type: "string",
      default: "",
    },
    CORS_ALLOW_CREDENTIALS: {
      type: "boolean",
      default: false,
    },
    CORS_PREFLIGHT_MAX_AGE: {
      type: "string",
      pattern: "^\\d+$",
      default: "86400",
    },
    // Cache
    CACHE_DRIVER: {
      type: "string",
      default: "redis",
      enum: ["redis", "memory"],
    },
    REDIS_URL: {
      type: "string",
      default: "redis://127.0.0.1:6379",
    },
    DEFAULT_CACHE_TTL: {
      type: "string",
      default: "60",
      pattern: "^\\d+$",
    },
    LRU_MAX: {
      type: "string",
      default: "5000",
      pattern: "^\\d+$",
    },
    // Helmet
    HELMET_ALLOWED_ORIGINS: {
      type: "string",
      default: "",
    },
    // Rate Limit
    RATE_LIMIT_MAX: {
      type: "string",
      default: "100",
      pattern: "^\\d+$",
    },
    RATE_LIMIT_TIME_WINDOW: {
      type: "string",
      default: "15 minutes",
    },
    RATE_LIMIT_CACHE: {
      type: "string",
      default: "redis",
      enum: ["redis", "memory"],
    },
    RATE_LIMIT_SKIP_ON_ERROR: {
      type: "string",
      default: "true",
      enum: ["true", "false"],
    },
    // Compress
    COMPRESS_THRESHOLD: {
      type: "string",
      pattern: "^\\d+$",
      default: "1024",
    },
    COMPRESS_LEVEL: {
      type: "string",
      default: "6",
      pattern: "^[1-9]$",
    },
    COMPRESS_TYPES: {
      type: "string",
      default:
        "application/json,text/html,text/plain,text/css,application/javascript,application/xml",
    },
    // Form Body
    BODY_LIMIT: {
      type: "string",
      default: "1024",
      pattern: "^\\d+$",
    },
    FORM_BODY_LIMIT: {
      type: "string",
      default: "1048576",
      pattern: "^\\d+$",
    },
    // Static
    STATIC_ROOT: {
      type: "string",
      default: "./public",
    },
    STATIC_PREFIX: {
      type: "string",
      default: "/public",
    },
    STATIC_MAX_AGE: {
      type: "string",
      pattern: "^\\d+$",
      default: "86400000",
    },
    STATIC_CACHE_CONTROL: {
      type: "string",
      default: "public, max-age=86400",
    },
    STATIC_CONSTRAINTS: {
      type: "string",
      default: true,
    },
    // JWT
    JWT_SECRET: {
      type: "string",
      minLength: 32,
      description: "Minimum 32 characters for HS256",
    },
    JWT_SECRET_FILE: {
      type: "string",
      description: "Optional: path to file containing JWT secret",
    },
    JWT_ALGORITHM: {
      type: "string",
      enum: [
        "HS256",
        "HS384",
        "HS512",
        "RS256",
        "RS384",
        "RS512",
        "ES256",
        "ES384",
        "ES512",
      ],
      default: "RS256",
    },
    JWT_SIGN_OPTIONS_EXPIRES_IN: {
      type: "string",
      default: "5m",
    },
    JWT_REFRESH_EXPIRES: {
      type: "string",
      default: "3d",
    },
    USE_REDIS_FOR_JWT: {
      type: "string",
      enum: ["true", "false"],
      default: "true",
    },
    // Swagger
    SWAGGER_TITLE: {
      type: "string",
      default: "SLUK HRMS Api",
    },
    SWAGGER_DESCRIPTION: {
      type: "string",
      default: "Sule lamido university human resource management system api.",
    },
    SWAGGER_VERSION: {
      type: "string",
      default: "1.0.0",
    },
    SWAGGER_PREFIX: {
      type: "string",
      default: "/docs",
    },
    SWAGGER_HOST: {
      type: "string",
      default: "localhost: 3500",
    },
    SWAGGER_HIDE_UNTAGGED: {
      type: "boolean",
      default: false,
    },
    DATABASE_URL: {
      type: "string",
    },
  },
  additionalProperties: true, // allow extra env vars
};
