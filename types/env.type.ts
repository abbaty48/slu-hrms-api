export type NODE_ENVIRONMENT = 'development' | 'production' | 'staging' | 'test'


export type ENVIRONMENT = {
    // app
    NODE_ENV: NODE_ENVIRONMENT,
    PORT: number,
    HOST: string,
    // CORS
    CORS_ORIGINS: string,
    CORS_ALLOW_HEADERS: string,
    CORS_EXPOSE_HEADERS: string,
    CORS_PREFLIGHT_MAX_AGE: string,
    CORS_ALLOW_CREDENTIALS: boolean,
    CORS_METHODS: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'PATCH',
    // Cache
    LRU_MAX: string,
    REDIS_URL: string,
    DEFAULT_CACHE_TTL: string,
    CACHE_DRIVER: 'redis' | 'memory',
    // Helmet
    HELMET_ALLOWED_ORIGINS: string,
    // Rate Limit
    RATE_LIMIT_MAX: number,
    RATE_LIMIT_TIME_WINDOW: string,
    RATE_LIMIT_SKIP_ON_ERROR: boolean,
    RATE_LIMIT_CACHE: 'redis' | 'memory'
    // Compress
    COMPRESS_TYPES: string,
    COMPRESS_LEVEL: number,
    COMPRESS_THRESHOLD: number,
    // Form Body
    BODY_LIMIT: number,
    FORM_BODY_LIMIT: number,
    // Static
    STATIC_ROOT: string,
    STATIC_PREFIX: string,
    STATIC_MAX_AGE: number,
    STATIC_DIR_LIST: boolean,
    STATIC_CONSTRAINTS: boolean,
    STATIC_CACHE_CONTROL: string,
    // JWT
    JWT_SECRET: string,
    JWT_SECRET_FILE: string,
    USE_REDIS_FOR_JWT: boolean,
    JWT_REFRESH_EXPIRES: string,
    JWT_SIGN_OPTIONS_EXPIRES_IN: string,
    JWT_ALGORITHM: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512' | 'ES256' | 'ES384' | 'ES512',
    // Swagger
    SWAGGER_HOST: string,
    SWAGGER_TITLE: string,
    SWAGGER_PREFIX: string,
    SWAGGER_VERSION: string,
    SWAGGER_DESCRIPTION: string,
    SWAGGER_HIDE_UNTAGGED: boolean,
    // POSTGRES
    POSTGRES_HOST: string,
    POSTGRES_PORT: number,
    POSTGRES_PASSWORD: string,
    POSTGRES_DATABASE: string,
}
