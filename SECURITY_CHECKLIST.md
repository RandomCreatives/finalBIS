# 🔒 BIS NOC Security Checklist

## 📋 Overview

This checklist ensures the BIS NOC application meets security best practices before production deployment.

---

## 🎯 Security Categories

### ✅ Completed | ⚠️ In Progress | ❌ Not Started | ⬜ Not Applicable

---

## 🔐 Authentication & Authorization

- [ ] **JWT Secrets** - JWT_SECRET is at least 32 characters and randomly generated
- [ ] **Password Hashing** - Uses bcrypt with cost factor 12
- [ ] **Timing-Safe Comparison** - Password comparison uses bcrypt.compare (not ===)
- [ ] **Session Validation** - User session validated on every request
- [ ] **Deactivated Users** - Deactivated users cannot access the system
- [ ] **Role-Based Access** - All endpoints check user roles
- [ ] **No Self-Registration** - Users can only be created by admins
- [ ] **Rate Limiting** - Auth endpoints limited to 10 attempts per IP+email per 15 min
- [ ] **API Rate Limiting** - API limited to 300 requests per IP per 15 min
- [ ] **Failed Attempts Only** - Only failed auth attempts count toward rate limit
- [ ] **Gmail Verification** - Gmail addresses must be verified before passwordless login
- [ ] **Code Expiration** - Verification codes expire after 10 minutes
- [ ] **Password Requirements** - Minimum 10 characters enforced

---

## 🗃️ Database Security

- [ ] **RLS Enabled** - Row Level Security enabled on all tables
- [ ] **No Permissive Policies** - Anon and authenticated roles can read nothing
- [ ] **Service Role Key** - Backend uses SUPABASE_SERVICE_KEY (not anon key)
- [ ] **Service Key Secret** - SUPABASE_SERVICE_KEY is never exposed to frontend
- [ ] **Constraints** - All tables have proper constraints (unique, check, foreign keys)
- [ ] **GIST Indexes** - Timetable uses GIST indexes to prevent double-booking
- [ ] **Triggers** - updated_at triggers exist on all relevant tables
- [ ] **Cascade Behaviors** - Proper ON DELETE CASCADE/SET NULL configured
- [ ] **Backups** - Database backup strategy in place
- [ ] **Encryption at Rest** - Sensitive data encrypted in database

---

## 🌐 API Security

- [ ] **CORS Strict** - CORS uses strict origin validation (not wildcard)
- [ ] **Origin Validation** - isAllowedOrigin prevents lookalike attacks
- [ ] **Helmet Enabled** - Security headers middleware is enabled
- [ ] **X-Powered-By Disabled** - Framework not disclosed in responses
- [ ] **X-Frame-Options** - Header prevents clickjacking
- [ ] **X-Content-Type-Options** - nosniff header configured
- [ ] **CSP Configured** - Content Security Policy set for production
- [ ] **HSTS** - HTTP Strict Transport Security enabled in production
- [ ] **Referrer Policy** - no-referrer policy configured
- [ ] **Input Validation** - All inputs validated with express-validator
- [ ] **Error Handling** - Errors don't leak sensitive information
- [ ] **Trust Proxy** - Proper IP detection behind proxies
- [ ] **Request Size Limit** - Request body size limited (1mb)

---

## 📦 Dependency Security

- [ ] **Backend Audit** - No high/critical vulnerabilities in backend
- [ ] **Frontend Audit** - No high/critical vulnerabilities in frontend
- [ ] **Dependencies Updated** - All packages updated to latest secure versions
- [ ] **Unused Dependencies** - No unused packages in package.json
- [ ] **License Compliance** - All dependencies have compatible licenses
- [ ] **Dependency Lock** - package-lock.json committed and up to date

---

## 🔒 Application Security

- [ ] **Environment Variables** - No secrets committed to repository
- [ ] **.env in .gitignore** - .env files excluded from version control
- [ ] **Environment Validation** - Script validates required env vars on startup
- [ ] **Secure Defaults** - Application fails securely if misconfigured
- [ ] **Logging** - No sensitive data logged (passwords, tokens, PII)
- [ ] **Error Messages** - User-friendly errors without technical details
- [ ] **CSRF Protection** - CSRF tokens used for state-changing operations
- [ ] **Session Management** - Proper session expiration and renewal
- [ ] **Password Reset** - Secure password reset flow (if implemented)
- [ ] **Account Lockout** - Temporary lockout after too many failed attempts

---

## 🖥️ Frontend Security

- [ ] **Token Storage** - JWT stored securely (HttpOnly cookies or secure storage)
- [ ] **Token Transmission** - Tokens sent via Authorization header (not URL)
- [ ] **Axios Interceptors** - Token attached to all requests automatically
- [ ] **401 Handling** - Automatic redirect to login on session expiration
- [ ] **XSS Prevention** - User-generated content properly escaped
- [ ] **CSP Meta Tag** - Frontend has proper CSP meta tag
- [ ] **Secure Cookies** - Cookies have Secure, HttpOnly, SameSite flags
- [ ] **No LocalStorage for Secrets** - Sensitive data not in localStorage

---

## 🔍 Monitoring & Auditing

- [ ] **Error Tracking** - Sentry or similar configured for error monitoring
- [ ] **Logging** - All critical operations logged
- [ ] **Audit Trail** - User actions logged for auditing
- [ ] **Alerts** - Alerts configured for security events
- [ ] **Health Checks** - /health endpoint returns system status
- [ ] **Uptime Monitoring** - External uptime monitoring in place
- [ ] **Performance Monitoring** - Response times and performance tracked
- [ ] **Security Headers Scan** - Regular scans with securityheaders.com

---

## 🚀 Deployment Security

- [ ] **HTTPS Everywhere** - All traffic uses HTTPS in production
- [ ] **TLS Configuration** - Strong TLS configuration (TLS 1.2+)
- [ ] **Certificate Valid** - SSL certificate valid and not expired
- [ ] **CORS Origins** - CORS_ORIGINS configured for production domains
- [ ] **Secrets Management** - Production secrets stored securely (not in code)
- [ ] **Environment Separation** - Separate configs for dev, staging, production
- [ ] **Rollback Plan** - Deployment rollback procedure documented
- [ ] **Disaster Recovery** - Backup and restore procedure in place
- [ ] **Incident Response** - Security incident response plan documented

---

## 👥 Access Control

- [ ] **Role Definitions** - All roles clearly defined (admin, main_teacher, etc.)
- [ ] **Role Hierarchy** - Proper role hierarchy enforced
- [ ] **Admin Only** - Admin-only endpoints protected
- [ ] **Teacher Access** - Teachers can only access their own data
- [ ] **School Isolation** - Users can only access their school's data
- [ ] **Object-Level Security** - Users can only access objects they own
- [ ] **Permission Reviews** - Regular access permission reviews

---

## 📊 Data Protection

- [ ] **PII Identification** - All personally identifiable information identified
- [ ] **Data Minimization** - Only necessary data collected
- [ ] **Data Retention** - Data retention policy defined and enforced
- [ ] **Data Deletion** - User data can be deleted on request
- [ ] **Data Encryption** - Sensitive data encrypted in transit and at rest
- [ ] **Backup Encryption** - Backups encrypted
- [ ] **GDPR Compliance** - GDPR requirements met (if applicable)

---

## 🧪 Security Testing

- [ ] **Unit Tests** - Security logic covered by unit tests
- [ ] **Integration Tests** - API endpoints tested for security
- [ ] **Penetration Testing** - Regular penetration tests performed
- [ ] **Vulnerability Scanning** - Automated vulnerability scanning in place
- [ ] **OWASP Top 10** - Protected against OWASP Top 10 vulnerabilities
- [ ] **Snyk/Dependabot** - Dependency vulnerability scanning enabled
- [ ] **Security Review** - Code review includes security checks

---

## 📝 Security Documentation

- [ ] **Security Policy** - Security policy documented
- [ ] **Incident Response Plan** - Incident response procedure documented
- [ ] **Disclosure Policy** - Vulnerability disclosure policy documented
- [ ] **Security Contacts** - Security team contact information available
- [ ] **Runbook** - Security incident runbook exists
- [ ] **Architecture** - Security architecture documented

---

## 🔄 Maintenance

- [ ] **Dependency Updates** - Regular dependency updates scheduled
- [ ] **Security Patches** - Security patches applied promptly
- [ ] **Secret Rotation** - Secrets rotated periodically
- [ ] **Access Reviews** - User access reviewed regularly
- [ ] **Audit Logs** - Audit logs reviewed periodically
- [ ] **Security Training** - Team receives security training

---

## 📅 Checklist Usage

### Before Production Deployment:
All ✅ (Completed) items must be verified.

### Regular Audits (Quarterly):
- Review all security items
- Update as needed
- Document changes

### Incident Response:
- Use this checklist to verify security posture after an incident
- Update checklist based on lessons learned

---

## 🎯 Scoring

**Score:** [X/XX] completed

- 90-100%: Production Ready
- 70-89%: Needs work before production
- 50-69%: Significant security gaps
- Below 50%: Not ready for production

---

## 📞 Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)

---

**Last Updated:** [Date]
**Owner:** [Security Team]
**Next Review:** [Date]
