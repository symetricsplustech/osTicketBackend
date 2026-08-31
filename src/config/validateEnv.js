// Environment variable validation — fails fast on missing critical vars
const REQUIRED = ['MONGODB_URI', 'JWT_SECRET'];
const RECOMMENDED = ['PORT', 'NODE_ENV'];
const SECURITY = ['FIELD_ENC_KEY'];

function validateEnv() {
  const errors = [];
  const warnings = [];

  for (const key of REQUIRED) {
    if (!process.env[key]) errors.push(`Missing REQUIRED env var: ${key}`);
  }
  for (const key of RECOMMENDED) {
    if (!process.env[key]) warnings.push(`Missing recommended env var: ${key} (using default)`);
  }
  if (process.env.NODE_ENV === 'production') {
    for (const key of SECURITY) {
      if (!process.env[key]) errors.push(`Missing SECURITY env var in production: ${key}`);
    }
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production');
    }
    // Warn about insecure defaults
    if (!process.env.CORS_ORIGINS) {
      warnings.push('CORS_ORIGINS not set — API will reject all browser origins except same-domain');
    }
  }
  if (errors.length) {
    console.error('\n❌ ENVIRONMENT VALIDATION FAILED:');
    errors.forEach(e => console.error(`   ${e}`));
    process.exit(1);
  }
  if (warnings.length) {
    console.warn('\n⚠️  Environment warnings:');
    warnings.forEach(w => console.warn(`   ${w}`));
  }
  console.log('✅ Environment validated');
}

module.exports = { validateEnv };
